import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateDailyTasks } from "@/lib/scheduler";
import { today } from "@/lib/id";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId");
  const date = searchParams.get("date") || today();

  const db = getDb();

  // Auto-generate tasks for all active plans (or specific plan)
  if (planId) {
    generateDailyTasks(planId);
  } else {
    const activePlans = db.prepare("SELECT id FROM plans WHERE status = 'active'").all() as { id: string }[];
    for (const p of activePlans) {
      generateDailyTasks(p.id);
    }
  }

  let tasks;
  if (planId) {
    tasks = db.prepare(`
      SELECT dt.*, t.title as topic_title, t.category, t.mastery, t.difficulty, t.priority, t.repetitions, t.id as topic_id
      FROM daily_tasks dt
      JOIN topics t ON dt.topic_id = t.id
      WHERE dt.date = ? AND t.plan_id = ?
      ORDER BY dt.type DESC, t.priority DESC
    `).all(date, planId);
  } else {
    tasks = db.prepare(`
      SELECT dt.*, t.title as topic_title, t.category, t.mastery, t.difficulty, t.priority, t.repetitions, t.id as topic_id, p.title as plan_title
      FROM daily_tasks dt
      JOIN topics t ON dt.topic_id = t.id
      JOIN plans p ON t.plan_id = p.id
      WHERE dt.date = ?
      ORDER BY dt.type DESC, t.priority DESC
    `).all(date);
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN type = 'new' THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN type = 'review' THEN 1 ELSE 0 END) as review_count
    FROM daily_tasks WHERE date = ?
  `).get(date);

  return NextResponse.json({ tasks, stats, date });
}
