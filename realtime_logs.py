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
from queue import Queue
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import random

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
            event_code INTEGER,
            category TEXT,
            source TEXT,
            time_generated TEXT,
            event_type INTEGER,
            severity TEXT,
            message TEXT,
            record_id INTEGER UNIQUE
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_time_generated ON logs (time_generated)")
    conn.commit()
    conn.close()

def get_latest_time_generated(category):
    conn = sqlite3.connect("security_logs.db", check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("SELECT MAX(time_generated) FROM logs WHERE category = ?", (category,))
    result = cursor.fetchone()[0]
    conn.close()
    return result if result else "Thu Jan 01 00:00:00 1970"

def classify_severity(event_type):
    if event_type == 1:
        return "Critical"
    elif event_type in [2, 3]:
        return "Warning"
    else:
        return "Normal"

def get_all_log_categories():
    categories = ["Application", "Security", "System"]
    additional_logs = [
        "Microsoft-Windows-PowerShell/Operational",
        "Microsoft-Windows-TaskScheduler/Operational",
        "Microsoft-Windows-WindowsUpdateClient/Operational",
        "Microsoft-Windows-WMI-Activity/Operational"
    ]
    return categories + additional_logs

def process_category(category, queue):
    try:
        hand = win32evtlog.OpenEventLog(None, category)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

        total_records = win32evtlog.GetNumberOfEventLogRecords(hand)
        print(f"Processing {category} with {total_records} records")

        latest_time = get_latest_time_generated(category)
        latest_dt = datetime.strptime(latest_time, "%a %b %d %H:%M:%S %Y")
        batch_size = 1000
        log_entries = []
        processed_records = 0

        while processed_records < total_records:
            events = win32evtlog.ReadEventLog(hand, flags, 0)
            if not events:
                break

            for event in events:
                record_id = event.RecordNumber
                processed_records += 1

                time_str = event.TimeGenerated.Format()
                try:
                    event_dt = datetime.strptime(time_str, "%a %b %d %H:%M:%S %Y")
                except ValueError as e:
                    print(f"Failed to parse time '{time_str}' for {category}/{record_id}: {e}")
                    continue

                if event_dt <= latest_dt:
                    continue  # Skip events older than or equal to the latest in DB

                event_code = event.EventID & 0xFFFF
                full_event_id = event.EventID
                try:
                    message = win32evtlogutil.SafeFormatMessage(event, category)
                    if not message:
                        message = "No description available"
                except Exception as e:
                    print(f"Failed to format message for {category}/{record_id}: {e}")
                    message = "Error retrieving message"

                log_entry = (
                    full_event_id,
                    event_code,
                    category,
                    event.SourceName,
                    time_str,
                    event.EventType,
                    classify_severity(event.EventType),
                    message,
                    record_id
                )
                log_entries.append(log_entry)

                if len(log_entries) >= batch_size:
                    queue.put(log_entries)
                    log_entries = []

            print(f"Processed {processed_records}/{total_records} records in {category}")

        if log_entries:
            queue.put(log_entries)

        win32evtlog.CloseEventLog(hand)

    except Exception as e:
        print(f"Failed to process {category}: {e}")

def batch_insert_logs(queue):
    conn = sqlite3.connect("security_logs.db", check_same_thread=False)
    cursor = conn.cursor()
    
    while True:
        log_entries = queue.get()
        if log_entries is None:
            break
        try:
            record_ids = [entry[8] for entry in log_entries]
            cursor.executemany("DELETE FROM logs WHERE record_id = ?", [(rid,) for rid in record_ids])
            
            cursor.executemany("""
                INSERT INTO logs 
                (event_id, event_code, category, source, time_generated, event_type, severity, message, record_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, log_entries)
            conn.commit()
            print(f"Inserted {len(log_entries)} logs into database")
        except Exception as e:
            print(f"Error inserting logs: {e}")
        finally:
            queue.task_done()
    
    conn.close()

def collect_logs():
    log_categories = get_all_log_categories()
    log_queue = Queue()

    insert_thread = threading.Thread(target=batch_insert_logs, args=(log_queue,))
    insert_thread.daemon = True
    insert_thread.start()

    while True:
        try:
            with ThreadPoolExecutor(max_workers=4) as executor:
                executor.map(lambda cat: process_category(cat, log_queue), log_categories)
        except Exception as e:
            print(f"Error collecting logs: {e}")
        time.sleep(5)

    log_queue.put(None)
    insert_thread.join()

def stream_logs():
    conn = sqlite3.connect("security_logs.db", check_same_thread=False)
    cursor = conn.cursor()
    categories = get_all_log_categories()
    logs_per_category = 1000 // len(categories)
    all_logs = []

    ten_days_ago = datetime.now() - timedelta(days=10)
    ten_days_ago_str = ten_days_ago.strftime("%a %b %d %H:%M:%S %Y")
    cursor.execute("""
        SELECT event_id, event_code, category, source, time_generated, event_type, severity, message, record_id
        FROM logs 
        WHERE time_generated >= ?
        ORDER BY RANDOM()
        LIMIT 1000
    """, (ten_days_ago_str,))
    initial_logs = [{
        "event_id": row[0],
        "event_code": row[1],
        "category": row[2],
        "source": row[3],
        "time_generated": row[4],
        "event_type": row[5],
        "severity": row[6],
        "message": row[7],
        "record_id": row[8]
    } for row in cursor.fetchall()]
    if initial_logs:
        socketio.emit('log_update', initial_logs)
        print("Sent initial random logs from last 10 days")

    while True:
        all_logs.clear()
        for category in random.sample(categories, len(categories)):
            cursor.execute("""
                SELECT event_id, event_code, category, source, time_generated, event_type, severity, message, record_id
                FROM logs 
                WHERE category = ?
                ORDER BY RANDOM()
                LIMIT ?
            """, (category, logs_per_category))
            logs = [{
                "event_id": row[0],
                "event_code": row[1],
                "category": row[2],
                "source": row[3],
                "time_generated": row[4],
                "event_type": row[5],
                "severity": row[6],
                "message": row[7],
                "record_id": row[8]
            } for row in cursor.fetchall()]
            all_logs.extend(logs)

        random.shuffle(all_logs)
        socketio.emit('log_update', all_logs[:1000])
        time.sleep(5)

    conn.close()

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
    
    # Initialize database before clearing it
    init_db()
    
    # Clear database for a fresh start
    conn = sqlite3.connect("security_logs.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM logs")
    conn.commit()
    conn.close()

    start_background_tasks()
    socketio.run(app, port=5000)