import os
import sqlite3
from flask import Flask, request, jsonify

try:
    import pg8000
except ImportError:
    pg8000 = None

app = Flask(__name__)

DB_PATH = os.environ.get("DB_PATH", "skytebane.db")
USE_SUPABASE = os.environ.get("USE_SUPABASE", "0") == "1"

# --- DB Connection ---
def get_db_connection():
    if USE_SUPABASE and pg8000:
        # Supabase/PostgreSQL
        return pg8000.connect(
            user=os.environ["SUPABASE_USER"],
            password=os.environ["SUPABASE_PASSWORD"],
            host=os.environ["SUPABASE_HOST"],
            database=os.environ["SUPABASE_DB"],
            port=int(os.environ.get("SUPABASE_PORT", 5432)),
            ssl_context=True
        )
    else:
        # SQLite
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

# --- DB Init ---
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            current_lat REAL NOT NULL,
            current_lng REAL NOT NULL,
            target_lat REAL,
            target_lng REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# --- API Endepunkt ---
@app.route("/api/posts", methods=["GET", "POST"])
def posts():
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json()
        name = data["name"]
        current_lat = data["current_lat"]
        current_lng = data["current_lng"]
        target_lat = data.get("target_lat")
        target_lng = data.get("target_lng")
        cur.execute(
            """
            INSERT INTO posts (name, current_lat, current_lng, target_lat, target_lng)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, current_lat, current_lng, target_lat, target_lng)
        )
        conn.commit()
        return jsonify({"id": cur.lastrowid}), 201
    else:
        cur.execute("SELECT * FROM posts")
        rows = cur.fetchall()
        posts = [dict(row) for row in rows]
        return jsonify(posts)

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
