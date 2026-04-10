import OpenAI from "openai";
import { getDb, type Topic } from "./db";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ZHIPU_API_KEY not set. Copy .env.example to .env.local and fill in your key."
    );
  }
  _client = new OpenAI({
    apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
  });
  return _client;
}

const MODEL = "glm-4-flash";

async function chat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  maxTokens = 4096
): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages,
  });
  return response.choices[0]?.message?.content || "";
}

/** Feynman study session - generate AI's first question */
export async function startFeynmanSession(topic: Topic): Promise<string> {
  return chat([
    {
      role: "system",
      content: `你是一位资深技术面试官，正在对候选人进行「${topic.title}」的面试考核。

场景：这是一场真实的技术面试，你需要高效地评估候选人对该知识点的掌握深度。

规则：
1. 直接问面试中会问的具体技术问题，不要问宽泛的概念题
2. 始终围绕「${topic.title}」这个知识点，不要偏离到其他话题
3. 如果候选人回答"不知道"或答得很浅，直接给出该知识点的关键要点，然后换一个角度追问
4. 不要往更基础的方向发散（比如问"什么是数据库"），而是聚焦当前知识点本身
5. 用中文交流，一次只问一个问题
6. 回答要简洁，每次回复不超过 150 字

知识要点（用于评估和纠正，不要整段念给候选人）：
${topic.content || "暂无参考内容"}`,
    },
    {
      role: "user",
      content: "我准备好了，请开始面试。",
    },
  ], 1024);
}

/**
 * 保留最近的 N 轮对话（窗口机制）
 * 避免上下文溢出，同时保持对话连贯性
 */
function trimMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxRounds = 6
): Array<{ role: "user" | "assistant"; content: string }> {
  // 保留最后 maxRounds 轮（1轮 = 1个user + 1个assistant）
  const keepCount = maxRounds * 2;
  if (messages.length <= keepCount) {
    return messages;
  }

  // 如果超出窗口，保留最近的消息
  return messages.slice(-keepCount);
}

/** Continue Feynman session with conversation history */
export async function continueFeynmanSession(
  topic: Topic,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ message: string; feedback: "correct" | "wrong" | "teach" }> {
  const recentMessages = trimMessages(messages, 6);

  const text = await chat([
    {
      role: "system",
      content: `你是一位资深技术面试官，正在对候选人进行「${topic.title}」的面试考核。

核心原则：始终聚焦「${topic.title}」，不要偏离。

回复策略：
- 候选人答对了：肯定要点，立刻追问更深一层（原理、场景、对比）
- 候选人答错了：直接指出错误，给出正确答案（一句话），然后追问相关知识
- 候选人说"不知道"：直接告诉关键点（2-3 句话讲清楚），然后从另一个角度出题
- 绝对不要往更基础的方向发散，不要问与「${topic.title}」无关的问题

回复格式要求（严格遵守）：
第一行必须是以下标签之一：
[CORRECT] — 候选人回答正确或基本正确
[WRONG] — 候选人回答有明显错误
[TEACH] — 候选人不知道，需要教学

第二行开始是你的正常回复内容（不超过 150 字，用中文）。

知识要点（用于评估和纠正）：
${topic.content || "暂无参考内容"}`,
    },
    ...recentMessages,
  ], 1024);

  // Parse feedback tag from first line
  let feedback: "correct" | "wrong" | "teach" = "teach";
  let message = text;
  const tagMatch = text.match(/^\[(CORRECT|WRONG|TEACH)\]\s*/i);
  if (tagMatch) {
    feedback = tagMatch[1].toLowerCase() as "correct" | "wrong" | "teach";
    message = text.slice(tagMatch[0].length).trim();
  } else {
    // Fallback: detect from Chinese content
    const t = text.slice(0, 60);
    if (/正确|没错|对[!！的了]|很好|完全正确|回答得|答对|说得对|不错|bingo/i.test(t)) {
      feedback = "correct";
    } else if (/不对|错了|不正确|有误|不准确|纠正|实际上/i.test(t)) {
      feedback = "wrong";
    }
  }

  return { message, feedback };
}

/** Score a Feynman session */
export async function scoreFeynmanSession(
  topic: Topic,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ score: number; weakPoints: string[]; summary: string }> {
  // 只保留最后 10 轮对话用于评分（避免上下文溢出）
  const recentMessages = trimMessages(messages, 10);

  // 提取用户的所有回答（用于评估掌握情况）
  const userAnswers = recentMessages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join("\n\n");

  const text = await chat([
    {
      role: "user",
      content: `请评估学生对「${topic.title}」的掌握情况。

学生的回答摘要：
${userAnswers}

知识要点参考：
${topic.content || "暂无"}

请严格以 JSON 格式返回评分：
{
  "score": 75,
  "weakPoints": ["薄弱点1", "薄弱点2"],
  "summary": "一句话总结掌握情况"
}

评分标准：核心概念理解(40%) + 能举例说明(30%) + 能解释原因(30%)`,
    },
  ], 1024);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { score: 50, weakPoints: ["评分解析失败"], summary: "请重试" };

  return JSON.parse(jsonMatch[0]);
}

/** Generate weekly/monthly review */
export async function generateReview(
  period: "weekly" | "monthly"
): Promise<string> {
  const db = getDb();

  const days = period === "weekly" ? 7 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  const sessions = db.prepare(
    `SELECT ss.*, t.title as topic_title, t.category
     FROM study_sessions ss JOIN topics t ON ss.topic_id = t.id
     WHERE ss.created_at >= ? ORDER BY ss.created_at DESC LIMIT 50`
  ).all(sinceStr);

  const tasks = db.prepare(
    `SELECT dt.*, t.title as topic_title
     FROM daily_tasks dt JOIN topics t ON dt.topic_id = t.id
     WHERE dt.date >= ? ORDER BY dt.date DESC`
  ).all(sinceStr);

  const stats = db.prepare(
    `SELECT status, COUNT(*) as count FROM topics GROUP BY status`
  ).all();

  return chat([
    {
      role: "user",
      content: `请为我生成一份${period === "weekly" ? "周" : "月"}度学习复盘报告。

学习会话（最近${days}天）：
${JSON.stringify(sessions, null, 2).slice(0, 2000)}

每日任务完成情况：
${JSON.stringify(tasks, null, 2).slice(0, 1000)}

知识点状态统计：
${JSON.stringify(stats)}

请包含：
1. 学习量统计（学了多少、复习了多少）
2. 掌握情况分析
3. 薄弱领域识别
4. 下周/下月建议
5. 鼓励和激励

用 Markdown 格式返回，语气积极正面。`,
    },
  ], 2048);
}
