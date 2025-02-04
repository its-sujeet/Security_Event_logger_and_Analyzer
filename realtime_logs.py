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
            event_id INTEGER,
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

def event_exists(event_id, category):
    conn = sqlite3.connect("security_logs.db")
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM logs WHERE event_id = ? AND category = ?", (event_id, category))
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

def collect_logs():
    log_categories = ["Application", "Security", "System"]  # Fetch logs from multiple categories

    while True:
        try:
            for category in log_categories:
                hand = win32evtlog.OpenEventLog(None, category)
                flags = win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

                while True:
                    events = win32evtlog.ReadEventLog(hand, flags, 0)
                    if not events:
                        break

                    for event in events:
                        if event_exists(event.EventID, category):
                            continue

                        message = win32evtlogutil.SafeFormatMessage(event, category)
                        log_entry = (
                            event.EventID,
                            category,
                            event.SourceName,
                            event.TimeGenerated.Format(),
                            event.EventType,
                            classify_severity(event.EventType),
                            message,
                            event.RecordNumber
                        )

                        conn = sqlite3.connect("security_logs.db")
                        cursor = conn.cursor()
                        try:
                            cursor.execute("""
                                INSERT INTO logs 
                                (event_id, category, source, time_generated, event_type, severity, message, record_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """, log_entry)
                            conn.commit()
                        except sqlite3.IntegrityError:
                            pass
                        finally:
                            conn.close()

                win32evtlog.CloseEventLog(hand)

        except Exception as e:
            print(f"Error collecting logs: {e}")

        time.sleep(10)

def stream_logs():
    while True:
        conn = sqlite3.connect("security_logs.db")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT event_id, category, source, time_generated, event_type, severity, message 
            FROM logs 
            ORDER BY time_generated DESC
        """)
        logs = [{
            "event_id": row[0],
            "category": row[1],
            "source": row[2],
            "time_generated": row[3],
            "event_type": row[4],
            "severity": row[5],
            "message": row[6]
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
