#!/usr/bin/env npx tsx
/**
 * OYO Daily Notification Script
 * Run via launchd to remind you about pending reviews.
 *
 * Setup:
 *   1. npm install -g tsx (or use npx tsx)
 *   2. Copy the launchd plist to ~/Library/LaunchAgents/
 *   3. launchctl load ~/Library/LaunchAgents/com.oyo.notify.plist
 */

import Database from "better-sqlite3";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const DB_PATH = path.join(os.homedir(), ".oyo", "oyo.db");

function today(): string {
  return new Date().toLocaleDateString("sv");
}

function notify(title: string, message: string) {
  // Use macOS osascript for native notifications
  const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
  try {
    execSync(`osascript -e '${script}'`);
  } catch {
    console.log(`[${title}] ${message}`);
  }
}

function main() {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const d = today();

    // Count due reviews
    const dueCount = db.prepare(
      "SELECT COUNT(*) as count FROM topics WHERE next_review <= ? AND status != 'mastered'"
    ).get(d) as { count: number };

    // Count today's pending tasks
    const pendingCount = db.prepare(
      "SELECT COUNT(*) as count FROM daily_tasks WHERE date = ? AND status = 'pending'"
    ).get(d) as { count: number };

    db.close();

    if (dueCount.count > 0 || pendingCount.count > 0) {
      const parts: string[] = [];
      if (pendingCount.count > 0) parts.push(`${pendingCount.count} pending tasks`);
      if (dueCount.count > 0) parts.push(`${dueCount.count} reviews due`);

      notify("OYO Learning", `You have ${parts.join(" and ")} today. Open http://localhost:3000`);
    }
  } catch (err) {
    // DB might not exist yet — silently skip
    console.error("OYO notify error:", err);
  }
}

main();
