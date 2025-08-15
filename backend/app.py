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
    if USE_SUPABASE and pg8000:
        cur.execute('''
            CREATE TABLE IF NOT EXISTS points (
                id SERIAL PRIMARY KEY,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                category VARCHAR(50) NOT NULL,
                creator_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cur.execute('''
            CREATE TABLE IF NOT EXISTS points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                category TEXT NOT NULL,
                creator_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    conn.commit()
    conn.close()

# --- API Endepunkt ---
@app.route("/api/points", methods=["GET", "POST"])
def points():
    conn = get_db_connection()
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json()
        lat = data["latitude"]
        lon = data["longitude"]
        category = data["category"]
        creator_id = data["creator_id"]
        if USE_SUPABASE and pg8000:
            cur.execute(
                """
                INSERT INTO points (latitude, longitude, category, creator_id)
                VALUES (%s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (lat, lon, category, creator_id)
            )
            result = cur.fetchone()
            conn.commit()
            return jsonify({"id": result[0], "created_at": result[1]}), 201
        else:
            cur.execute(
                """
                INSERT INTO points (latitude, longitude, category, creator_id)
                VALUES (?, ?, ?, ?)
                """,
                (lat, lon, category, creator_id)
            )
            conn.commit()
            return jsonify({"id": cur.lastrowid}), 201
    else:
        cur.execute("SELECT * FROM points")
        rows = cur.fetchall()
        points = [dict(row) for row in rows]
        return jsonify(points)

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
