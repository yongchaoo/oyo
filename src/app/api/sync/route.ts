import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { genId } from "@/lib/id";
import type { Plan } from "@/lib/db";
import fs from "fs";
import path from "path";

const TOPICS_DIR = path.join(process.cwd(), "topics");

function parseMd(content: string): { title: string; content: string } {
  const lines = content.trim().split("\n");
  const h1Idx = lines.findIndex((l) => /^#\s+/.test(l));
  const title = h1Idx >= 0 ? lines[h1Idx].replace(/^#\s+/, "").trim() : "Untitled";
  const body = h1Idx >= 0 ? lines.slice(h1Idx + 1).join("\n").trim() : content.trim();
  return { title, content: body };
}

export async function POST() {
  if (!fs.existsSync(TOPICS_DIR)) {
    return NextResponse.json({ error: "topics/ directory not found" }, { status: 404 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  const folders = fs.readdirSync(TOPICS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."));

  for (const folder of folders) {
    const category = folder.name;
    const folderPath = path.join(TOPICS_DIR, category);

    // Find or create plan for this folder
    let plan = db.prepare("SELECT * FROM plans WHERE title = ?").get(category) as Plan | undefined;
    if (!plan) {
      const planId = genId();
      db.prepare("INSERT INTO plans (id, title, description, status, created_at) VALUES (?, ?, ?, 'active', ?)")
        .run(planId, category, `Imported from topics/${category}/`, now);
      plan = { id: planId, title: category, description: null, target_date: null, status: "active", created_at: now };
    }

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { title, content } = parseMd(raw);
      // Stable key: "category/filename.md"
      const sourceFile = `${category}/${file}`;

      // Match by source_file (stable), fallback to title (for pre-migration data)
      const existing = db.prepare(
        "SELECT id FROM topics WHERE plan_id = ? AND (source_file = ? OR (source_file IS NULL AND title = ?))"
      ).get(plan.id, sourceFile, title) as { id: string } | undefined;

      if (existing) {
        db.prepare("UPDATE topics SET title = ?, content = ?, source_file = ? WHERE id = ?")
          .run(title, content, sourceFile, existing.id);
        updated++;
      } else {
        db.prepare(
          "INSERT INTO topics (id, plan_id, title, category, content, difficulty, priority, status, source_file, created_at) VALUES (?, ?, ?, ?, ?, 3, 3, 'new', ?, ?)"
        ).run(genId(), plan.id, title, category, content, sourceFile, now);
        created++;
      }
    }
  }

  return NextResponse.json({ created, updated, folders: folders.length });
}
