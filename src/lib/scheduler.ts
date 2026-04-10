import { getDb, type Topic } from "./db";
import { genId, today } from "./id";

/**
 * SM-2 Spaced Repetition Algorithm
 * quality: 0-5
 *   0 = complete blackout
 *   1 = incorrect, but remembered upon seeing answer
 *   2 = incorrect, but answer seemed easy to recall
 *   3 = correct with serious difficulty
 *   4 = correct after hesitation
 *   5 = perfect response
 */
export function calculateNextReview(
  topic: Pick<Topic, "ease_factor" | "interval" | "repetitions">,
  quality: number
): { easeFactor: number; interval: number; repetitions: number; nextReview: string } {
  let { ease_factor: ef, interval, repetitions } = topic;

  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ef);
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }

  ef = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  const next = new Date();
  next.setDate(next.getDate() + interval);
  const nextReview = next.toISOString().split("T")[0];

  return { easeFactor: ef, interval, repetitions, nextReview };
}

/** Map a 0-100 score to SM-2 quality 0-5 */
export function scoreToQuality(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

/** Update topic after a study session */
export function updateTopicAfterStudy(topicId: string, score: number) {
  const db = getDb();
  const topic = db.prepare("SELECT * FROM topics WHERE id = ?").get(topicId) as Topic;
  if (!topic) throw new Error(`Topic not found: ${topicId}`);

  const quality = scoreToQuality(score);
  const { easeFactor, interval, repetitions, nextReview } = calculateNextReview(topic, quality);

  const mastery = Math.min(100, Math.max(0,
    Math.round(topic.mastery * 0.6 + score * 0.4)
  ));

  let status = topic.status;
  if (mastery >= 90) status = "mastered";
  else if (repetitions > 0) status = "reviewing";
  else status = "learning";

  db.prepare(`
    UPDATE topics SET
      ease_factor = ?, interval = ?, repetitions = ?,
      next_review = ?, mastery = ?, status = ?
    WHERE id = ?
  `).run(easeFactor, interval, repetitions, nextReview, mastery, status, topicId);
}

/** Get topics due for review today */
export function getDueTopics(planId?: string): Topic[] {
  const db = getDb();
  const d = today();

  if (planId) {
    return db.prepare(
      `SELECT * FROM topics WHERE plan_id = ? AND next_review <= ? AND status != 'mastered' ORDER BY next_review ASC`
    ).all(planId, d) as Topic[];
  }
  return db.prepare(
    `SELECT * FROM topics WHERE next_review <= ? AND status != 'mastered' ORDER BY next_review ASC`
  ).all(d) as Topic[];
}

/** Get new topics to learn today */
export function getNewTopics(planId: string, limit: number = 5): Topic[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM topics WHERE plan_id = ? AND status = 'new' ORDER BY priority DESC, difficulty ASC LIMIT ?`
  ).all(planId, limit) as Topic[];
}

/** Generate daily tasks for today */
export function generateDailyTasks(planId: string, newPerDay: number = 5) {
  const db = getDb();
  const d = today();

  const existing = db.prepare(
    "SELECT COUNT(*) as count FROM daily_tasks WHERE date = ? AND topic_id IN (SELECT id FROM topics WHERE plan_id = ?)"
  ).get(d, planId) as { count: number };

  if (existing.count > 0) return; // already generated

  const due = getDueTopics(planId);
  const newTopics = getNewTopics(planId, newPerDay);

  const insert = db.prepare(
    "INSERT OR IGNORE INTO daily_tasks (id, date, topic_id, type, status) VALUES (?, ?, ?, ?, 'pending')"
  );

  const tx = db.transaction(() => {
    for (const topic of due) {
      insert.run(genId(), d, topic.id, "review");
    }
    for (const topic of newTopics) {
      insert.run(genId(), d, topic.id, "new");
    }
  });
  tx();
}
