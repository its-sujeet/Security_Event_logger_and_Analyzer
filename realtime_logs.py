import sqlite3
import time
import win32evtlog
import win32evtlogutil
import win32con
from flask import Flask, jsonify
from flask_socketio import SocketIO
import threading

# Flask Setup
app = Flask(__name__)
socketio = SocketIO(app)

# SQLite Database Setup
def init_db():
    conn = sqlite3.connect("security_logs.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            source TEXT,
            time_generated TEXT,
            category INTEGER,
            event_type INTEGER,
            message TEXT
        )
    """)
    conn.commit()
    conn.close()

# Log Collection Function
def collect_logs():
    while True:
        server = 'localhost'
        logtype = 'Security'
        
        # Open the event log
        hand = win32evtlog.OpenEventLog(server, logtype)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        total_events = win32evtlog.GetNumberOfEventLogRecords(hand)

        for i in range(min(10, total_events)):  # Read latest 10 events
            events = win32evtlog.ReadEventLog(hand, flags, 0)
            for event in events:
                log_entry = (
                    event.EventID,
                    event.SourceName,
                    event.TimeGenerated.Format(),
                    event.EventCategory,
                    event.EventType,
                    win32evtlogutil.SafeFormatMessage(event, logtype)
                )
                # Insert into SQLite Database
                conn = sqlite3.connect("security_logs.db")
                cursor = conn.cursor()
                cursor.execute("INSERT INTO logs (event_id, source, time_generated, category, event_type, message) VALUES (?, ?, ?, ?, ?, ?)", log_entry)
                conn.commit()
                conn.close()

        win32evtlog.CloseEventLog(hand)
        time.sleep(10)  # Delay between fetching logs

# API Endpoint to Fetch Logs
@app.route('/logs', methods=['GET'])
def get_logs():
    conn = sqlite3.connect("security_logs.db")
    cursor = conn.cursor()
    cursor.execute("SELECT event_id, source, time_generated, category, event_type, message FROM logs ORDER BY time_generated DESC LIMIT 20")
    logs = [{"event_id": row[0], "source": row[1], "time_generated": row[2], "category": row[3], "event_type": row[4], "message": row[5]} for row in cursor.fetchall()]
    conn.close()
    return jsonify(logs)

# Real-Time Log Streaming using SocketIO
def stream_logs():
    while True:
        conn = sqlite3.connect("security_logs.db")
        cursor = conn.cursor()
        cursor.execute("SELECT event_id, source, time_generated, category, event_type, message FROM logs ORDER BY time_generated DESC LIMIT 5")
        logs = [{"event_id": row[0], "source": row[1], "time_generated": row[2], "category": row[3], "event_type": row[4], "message": row[5]} for row in cursor.fetchall()]
        conn.close()

        socketio.emit('log_update', logs)
        time.sleep(5)  # Stream logs every 5 seconds

# Start Log Collection in Background
def start_log_collection():
    thread = threading.Thread(target=collect_logs)
    thread.daemon = True
    thread.start()

# Start Flask app
if __name__ == "__main__":
    init_db()  # Initialize SQLite Database
    start_log_collection()  # Start the log collection in the background
    socketio.run(app, port=5000)
