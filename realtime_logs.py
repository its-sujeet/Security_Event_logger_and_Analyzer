import sqlite3
import time
import win32evtlog
import win32evtlogutil
import ctypes
import sys
from flask import Flask, jsonify
from flask_socketio import SocketIO
import threading
from flask_cors import CORS

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app, origins=["http://localhost:5173"])

def init_db():
    conn = sqlite3.connect("security_logs.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,  -- Full 32-bit Event ID
            event_code INTEGER,  -- Masked 16-bit event code
            category TEXT,
            source TEXT,
            time_generated TEXT,
            event_type INTEGER,
            severity TEXT,
            message TEXT,
            record_id INTEGER UNIQUE
        )
    """)
    conn.commit()
    conn.close()

def event_exists(record_id):
    conn = sqlite3.connect("security_logs.db")
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM logs WHERE record_id = ?", (record_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

def classify_severity(event_type):
    if event_type == 1:
        return "Critical"
    elif event_type in [2, 3]:
        return "Warning"
    else:
        return "Normal"

def get_all_log_categories():
    # Basic classic logs
    categories = ["Application", "Security", "System"]
    # Add more logs dynamically (example: some common modern logs)
    additional_logs = [
        "Microsoft-Windows-PowerShell/Operational",
        "Microsoft-Windows-TaskScheduler/Operational",
        "Microsoft-Windows-WindowsUpdateClient/Operational",
        "Microsoft-Windows-WMI-Activity/Operational"
    ]
    return categories + additional_logs

def collect_logs():
    log_categories = get_all_log_categories()

    while True:
        try:
            for category in log_categories:
                try:
                    hand = win32evtlog.OpenEventLog(None, category)
                    # Use backwards reading to get latest events first
                    flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

                    total_records = win32evtlog.GetNumberOfEventLogRecords(hand)
                    print(f"Processing {category} with {total_records} records")

                    while True:
                        events = win32evtlog.ReadEventLog(hand, flags, 0)
                        if not events:
                            break

                        for event in events:
                            record_id = event.RecordNumber
                            if event_exists(record_id):
                                continue

                            event_code = event.EventID & 0xFFFF  # Masked event code
                            full_event_id = event.EventID  # Full 32-bit ID
                            message = win32evtlogutil.SafeFormatMessage(event, category)
                            log_entry = (
                                full_event_id,  # Store full EventID
                                event_code,     # Store masked event code
                                category,
                                event.SourceName,
                                event.TimeGenerated.Format(),
                                event.EventType,
                                classify_severity(event.EventType),
                                message,
                                record_id
                            )

                            conn = sqlite3.connect("security_logs.db")
                            cursor = conn.cursor()
                            try:
                                cursor.execute("""
                                    INSERT INTO logs 
                                    (event_id, event_code, category, source, time_generated, event_type, severity, message, record_id)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """, log_entry)
                                conn.commit()
                            except sqlite3.IntegrityError:
                                pass
                            finally:
                                conn.close()

                    win32evtlog.CloseEventLog(hand)

                except Exception as e:
                    print(f"Failed to process {category}: {e}")

        except Exception as e:
            print(f"Error collecting logs: {e}")

        time.sleep(5)  # Reduced interval to catch events faster

def stream_logs():
    while True:
        conn = sqlite3.connect("security_logs.db")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT event_id, event_code, category, source, time_generated, event_type, severity, message 
            FROM logs 
            ORDER BY time_generated DESC
            LIMIT 1000  -- Limit to avoid overwhelming the client
        """)
        logs = [{
            "event_id": row[0],    # Full Event ID
            "event_code": row[1],  # Masked event code
            "category": row[2],
            "source": row[3],
            "time_generated": row[4],
            "event_type": row[5],
            "severity": row[6],
            "message": row[7]
        } for row in cursor.fetchall()]
        conn.close()

        socketio.emit('log_update', logs)
        time.sleep(5)

def start_background_tasks():
    collector = threading.Thread(target=collect_logs)
    collector.daemon = True
    collector.start()
    
    streamer = threading.Thread(target=stream_logs)
    streamer.daemon = True
    streamer.start()

if __name__ == "__main__":
    if not is_admin():
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
        sys.exit()
    
    init_db()
    start_background_tasks()
    socketio.run(app, port=5000)