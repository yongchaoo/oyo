import { NextResponse } from "next/server";
import { getDb, type Topic } from "@/lib/db";
import { scoreFeynmanSession } from "@/lib/ai";
import { updateTopicAfterStudy } from "@/lib/scheduler";
import { today } from "@/lib/id";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const db = getDb();
  const session = db.prepare("SELECT * FROM study_sessions WHERE id = ?").get(sessionId) as {
    id: string; topic_id: string; messages: string;
  } | undefined;
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const topic = db.prepare("SELECT * FROM topics WHERE id = ?").get(session.topic_id) as Topic;
  const messages = JSON.parse(session.messages);

  try {
    const { score, weakPoints, summary } = await scoreFeynmanSession(topic, messages);

    // Update session
    db.prepare(
      "UPDATE study_sessions SET score = ?, weak_points = ? WHERE id = ?"
    ).run(score, JSON.stringify(weakPoints), sessionId);

    // Update topic via SM-2
    updateTopicAfterStudy(topic.id, score);

    // Mark daily task as done
    db.prepare(
      "UPDATE daily_tasks SET status = 'done', completed_at = ? WHERE topic_id = ? AND date = ? AND status = 'pending'"
    ).run(new Date().toISOString(), topic.id, today());

    const updatedTopic = db.prepare("SELECT * FROM topics WHERE id = ?").get(topic.id);

    return NextResponse.json({ score, weakPoints, summary, topic: updatedTopic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
