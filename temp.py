import sqlite3
import time
import win32evtlog
import win32evtlogutil
import ctypes
import sys
from flask import Flask, jsonify
from flask_socketio import SocketIO
import threading

from flask import send_from_directory
from flask_cors import CORS

# Admin check
def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

# Flask setup
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


CORS(app, origins=["http://localhost:5173"])


# @app.route('/')
# def serve_react():
#     return send_from_directory('build', 'index.html')



# Database setup
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
            message TEXT,
            record_id INTEGER UNIQUE
        )
    """)
    conn.commit()
    conn.close()


def collect_logs():
    last_record_id = 0
    while True:
        try:
            hand = win32evtlog.OpenEventLog(None, 'Security')
            flags = win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
            
            while True:
                events = win32evtlog.ReadEventLog(hand, flags, 0)
                if not events:
                    break

                for event in events:
                    if event.RecordNumber <= last_record_id:
                        continue

                    message = win32evtlogutil.SafeFormatMessage(event, 'Security')
                    log_entry = (
                        event.EventID,
                        event.SourceName,
                        event.TimeGenerated.Format(),
                        event.EventCategory,
                        event.EventType,
                        message,
                        event.RecordNumber
                    )

                    conn = sqlite3.connect("security_logs.db")
                    cursor = conn.cursor()
                    try:
                        cursor.execute("""
                            INSERT INTO logs 
                            (event_id, source, time_generated, category, event_type, message, record_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, log_entry)
                        conn.commit()
                        last_record_id = event.RecordNumber
                    except sqlite3.IntegrityError:
                        pass  # Skip duplicate records
                    finally:
                        conn.close()

        except Exception as e:
            print(f"Error collecting logs: {e}")
        finally:
            win32evtlog.CloseEventLog(hand)
        
        time.sleep(10)




# API endpoint
# @app.route('/logs', methods=['GET'])
# def get_logs():
#     conn = sqlite3.connect("security_logs.db")
#     cursor = conn.cursor()
#     cursor.execute("""
#         SELECT event_id, source, time_generated, category, event_type, message 
#         FROM logs 
#         ORDER BY time_generated DESC 
#         LIMIT 20
#     """)
#     logs = [{
#         "event_id": row[0],
#         "source": row[1],
#         "time_generated": row[2],
#         "category": row[3],
#         "event_type": row[4],
#         "message": row[5]
#     } for row in cursor.fetchall()]
#     conn.close()
#     return jsonify(logs)

# Real-time streaming
def stream_logs():
    while True:
        conn = sqlite3.connect("security_logs.db")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT event_id, source, time_generated, category, event_type, message 
            FROM logs 
            ORDER BY time_generated DESC 
            
        """)
        logs = [{
            "event_id": row[0],
            "source": row[1],
            "time_generated": row[2],
            "category": row[3],
            "event_type": row[4],
            "message": row[5]
        } for row in cursor.fetchall()]
        conn.close()
        
        socketio.emit('log_update', logs)
        time.sleep(5)

# Start background tasks
def start_background_tasks():
    collector = threading.Thread(target=collect_logs)
    collector.daemon = True
    collector.start()
    
    streamer = threading.Thread(target=stream_logs)
    streamer.daemon = True
    streamer.start()

# Main entry
if __name__ == "__main__":
    if not is_admin():
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
        sys.exit()
    
    init_db()
    start_background_tasks()
    socketio.run(app, port=5000)