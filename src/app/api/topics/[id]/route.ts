import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const topic = db.prepare("SELECT * FROM topics WHERE id = ?").get(id);
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessions = db.prepare(
    "SELECT * FROM study_sessions WHERE topic_id = ? ORDER BY created_at DESC"
  ).all(id);

  return NextResponse.json({ ...topic, sessions });
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await _req.json();
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of ["title", "category", "content", "difficulty", "priority", "status", "mastery"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
  values.push(id);

  db.prepare(`UPDATE topics SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const topic = db.prepare("SELECT * FROM topics WHERE id = ?").get(id);
  return NextResponse.json(topic);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM topics WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
