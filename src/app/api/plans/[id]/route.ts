import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const topics = db.prepare("SELECT * FROM topics WHERE plan_id = ? ORDER BY priority DESC, category").all(id);
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered,
      SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
      SUM(CASE WHEN status = 'learning' THEN 1 ELSE 0 END) as learning,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
      AVG(mastery) as avg_mastery
    FROM topics WHERE plan_id = ?
  `).get(id);

  return NextResponse.json({ ...plan, topics, stats });
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await _req.json();
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push("title = ?"); values.push(body.title); }
  if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
  if (body.targetDate !== undefined) { fields.push("target_date = ?"); values.push(body.targetDate); }
  if (body.status !== undefined) { fields.push("status = ?"); values.push(body.status); }

  if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  values.push(id);
  db.prepare(`UPDATE plans SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(id);
  return NextResponse.json(plan);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM plans WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
