import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const OYO_DIR = path.join(os.homedir(), ".oyo");
const DB_PATH = path.join(OYO_DIR, "oyo.db");

function ensureDir() {
  if (!fs.existsSync(OYO_DIR)) {
    fs.mkdirSync(OYO_DIR, { recursive: true });
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  ensureDir();
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;

  if (version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        target_date TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT,
        content TEXT,
        difficulty INTEGER DEFAULT 3,
        priority INTEGER DEFAULT 3,
        ease_factor REAL DEFAULT 2.5,
        interval INTEGER DEFAULT 0,
        repetitions INTEGER DEFAULT 0,
        next_review TEXT,
        mastery INTEGER DEFAULT 0,
        status TEXT DEFAULT 'new',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_sessions (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        messages TEXT NOT NULL,
        score INTEGER,
        weak_points TEXT,
        duration INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_tasks (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        completed_at TEXT,
        UNIQUE(date, topic_id)
      );

      CREATE INDEX IF NOT EXISTS idx_topics_plan ON topics(plan_id);
      CREATE INDEX IF NOT EXISTS idx_topics_next_review ON topics(next_review);
      CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
      CREATE INDEX IF NOT EXISTS idx_daily_tasks_date ON daily_tasks(date);
      CREATE INDEX IF NOT EXISTS idx_study_sessions_topic ON study_sessions(topic_id);
    `);
    db.pragma("user_version = 1");
  }

  if (version < 2) {
    db.exec(`ALTER TABLE topics ADD COLUMN source_file TEXT`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_source ON topics(plan_id, source_file)`);
    db.pragma("user_version = 2");
  }
}

export type Plan = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  created_at: string;
};

export type Topic = {
  id: string;
  plan_id: string;
  title: string;
  category: string | null;
  content: string | null;
  difficulty: number;
  priority: number;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string | null;
  mastery: number;
  status: string;
  source_file: string | null;
  created_at: string;
};

export type StudySession = {
  id: string;
  topic_id: string;
  mode: string;
  messages: string;
  score: number | null;
  weak_points: string | null;
  duration: number | null;
  created_at: string;
};

export type DailyTask = {
  id: string;
  date: string;
  topic_id: string;
  type: string;
  status: string;
  completed_at: string | null;
};
