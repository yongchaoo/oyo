import { NextResponse } from "next/server";
import { getDb, type Topic } from "@/lib/db";
import { startFeynmanSession, continueFeynmanSession } from "@/lib/ai";
import { genId } from "@/lib/id";

/** Resume an unfinished session for a topic */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get("topicId");
  if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

  const db = getDb();
  const session = db.prepare(
    "SELECT * FROM study_sessions WHERE topic_id = ? AND score IS NULL ORDER BY created_at DESC LIMIT 1"
  ).get(topicId) as { id: string; messages: string } | undefined;

  if (!session) return NextResponse.json({ session: null });

  return NextResponse.json({
    sessionId: session.id,
    messages: JSON.parse(session.messages),
  });
}

/** Start a new Feynman study session */
export async function POST(req: Request) {
  const { topicId } = await req.json();
  const db = getDb();
  const topic = db.prepare("SELECT * FROM topics WHERE id = ?").get(topicId) as Topic | undefined;
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  try {
    const firstMessage = await startFeynmanSession(topic);
    const sessionId = genId();
    const messages = [{ role: "assistant", content: firstMessage }];

    db.prepare(
      "INSERT INTO study_sessions (id, topic_id, mode, messages, created_at) VALUES (?, ?, 'feynman', ?, ?)"
    ).run(sessionId, topicId, JSON.stringify(messages), new Date().toISOString());

    return NextResponse.json({ sessionId, message: firstMessage, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Continue a study session */
export async function PUT(req: Request) {
  const { sessionId, userMessage } = await req.json();
  const db = getDb();
  const session = db.prepare("SELECT * FROM study_sessions WHERE id = ?").get(sessionId) as {
    id: string; topic_id: string; messages: string;
  } | undefined;
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const topic = db.prepare("SELECT * FROM topics WHERE id = ?").get(session.topic_id) as Topic;
  const messages = JSON.parse(session.messages);
  messages.push({ role: "user", content: userMessage });

  try {
    const { message: reply, feedback } = await continueFeynmanSession(topic, messages);
    messages.push({ role: "assistant", content: reply });

    db.prepare("UPDATE study_sessions SET messages = ? WHERE id = ?")
      .run(JSON.stringify(messages), sessionId);

    return NextResponse.json({ message: reply, messages, feedback });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
