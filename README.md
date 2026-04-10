# OYO ✦

File-driven knowledge learning system. Put any knowledge into markdown files, AI helps you truly understand and remember it through Feynman-style sessions and spaced repetition.

Works for anything: interview prep, programming languages, system design, history, medicine, law, language learning — any structured knowledge you want to master.

## How It Works

```
topics/                  <- Your knowledge base (markdown files)
  sql/                   <- Folder name = study plan
    delete-vs-truncate.md
    index-types.md
  javascript/
    closure.md
    event-loop.md
```

Each `.md` file = one topic. Format:

```markdown
# Topic Title

Your content here (any markdown)
```

**Flow:** Add files to `topics/` -> Sync -> Study -> Review

## Quick Start

```bash
# 1. Install
pnpm install

# 2. Configure AI (Zhipu GLM)
cp .env.example .env.local
# Edit .env.local with your API key from https://open.bigmodel.cn/

# 3. Add your knowledge to topics/
#    (examples are already included)

# 4. Run
pnpm dev
```

Open http://localhost:3000, go to Study Plans, click **Sync from Files**.

## Tech Stack

- **Frontend:** Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui
- **AI:** Zhipu GLM (OpenAI-compatible API)
- **Database:** SQLite (better-sqlite3), stored at `~/.oyo/oyo.db`
- **Algorithm:** SM-2 spaced repetition

## Project Structure

```
src/
  app/
    page.tsx                  # Dashboard - today's tasks
    plan/page.tsx             # Study plans list + sync
    plan/[id]/page.tsx        # Plan detail - topic list
    study/[id]/page.tsx       # Feynman study session (AI chat)
    review/page.tsx           # Review queue + AI review report
    progress/page.tsx         # Mastery overview
    api/
      sync/                   # Scan topics/ folder -> DB
      plans/                  # Plans API
      topics/[id]/            # Topics API
      study/                  # Start/continue/resume session
      study/[id]/finish/      # Score session, update SM-2
      daily-tasks/            # Auto-generate daily tasks
      review/                 # AI weekly/monthly review
  lib/
    ai.ts                     # Zhipu GLM API calls
    db.ts                     # SQLite schema + connection
    scheduler.ts              # SM-2 algorithm + daily task generation
    id.ts                     # ID generation + date utils
  components/
    Sidebar.tsx               # Navigation sidebar
    ui/                       # shadcn/ui components
topics/                       # Your markdown knowledge files
```

## Study Session

When you click "Study" on a topic, the AI acts as an examiner:

1. Asks you to explain the topic in your own words
2. If you answer correctly: drills deeper (principles, scenarios, comparisons)
3. If you answer wrong: corrects you, then re-asks from another angle
4. If you say "don't know": teaches key points in 2-3 sentences, then tests again
5. When done, scores your session (0-100) and updates the spaced repetition schedule

Sessions auto-save — close and come back anytime to continue where you left off.

## Adding Topics

1. Create a folder under `topics/` (folder name becomes the study plan name)
2. Add `.md` files (one per topic)
3. Click "Sync from Files" in the app
4. Edit files anytime, re-sync to update content (learning progress is preserved)
