"use client";

import { useEffect, useState, useRef, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useTTS } from "@/lib/use-tts";
import { Markdown } from "@/components/Markdown";
import Link from "next/link";

type Topic = {
  id: string;
  title: string;
  category: string | null;
  content: string | null;
  difficulty: number;
  mastery: number;
  status: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  feedback?: "correct" | "wrong" | "teach";
};

type ScoreResult = {
  score: number;
  weakPoints: string[];
  summary: string;
  topic: Topic;
};

// ─── Sound ──────────────────────────────────────────────────

function playSound(type: "correct" | "wrong" | "teach" | "combo" | "finish") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    switch (type) {
      case "correct":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
        break;
      case "combo":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.06);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.45);
        break;
      case "wrong":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        break;
      case "teach":
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(494, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
        break;
      case "finish":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.36);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.7);
        break;
    }
  } catch { /* ignore */ }
}

// ─── Main ───────────────────────────────────────────────────

export default function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: topicId } = use(params);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [streak, setStreak] = useState(0);
  const [latestFeedback, setLatestFeedback] = useState<"correct" | "wrong" | "teach" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tts = useTTS();

  useEffect(() => {
    async function load() {
      const [topicRes, sessionRes] = await Promise.all([
        fetch(`/api/topics/${topicId}`),
        fetch(`/api/study?topicId=${topicId}`),
      ]);
      if (topicRes.ok) setTopic(await topicRes.json());
      if (sessionRes.ok) {
        const data = await sessionRes.json();
        if (data.sessionId) {
          setSessionId(data.sessionId);
          setMessages(data.messages);
        }
      }
      setLoading(false);
    }
    load();
  }, [topicId]);

  async function startSession() {
    setSending(true);
    const res = await fetch("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId }),
    });
    const data = await res.json();
    if (data.sessionId) {
      setSessionId(data.sessionId);
      setMessages(data.messages);
      tts.speak(data.messages[0]?.content || "");
    }
    setSending(false);
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);
    setLatestFeedback(null);

    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    const res = await fetch("/api/study", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userMessage: userMsg }),
    });
    const data = await res.json();
    if (data.messages) {
      const feedback: "correct" | "wrong" | "teach" = data.feedback || "teach";
      const msgs = data.messages.map((m: Message, i: number) =>
        i === data.messages.length - 1 && m.role === "assistant" ? { ...m, feedback } : m
      );
      setMessages(msgs);
      setLatestFeedback(feedback);

      const newStreak = feedback === "correct" ? streak + 1 : 0;
      setStreak(newStreak);

      if (feedback === "correct" && newStreak >= 3) playSound("combo");
      else playSound(feedback);

      tts.speak(data.message);
    }
    setSending(false);
  }

  async function finishSession() {
    if (!sessionId) return;
    setFinishing(true);
    try {
      const res = await fetch(`/api/study/${sessionId}/finish`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      } else {
        playSound("finish");
        setResult(data);
        setTopic(data.topic);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to finish. Please try again." }]);
    }
    setFinishing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (!topic) {
    return <div className="text-center text-muted-foreground">Topic not found</div>;
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Topic header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{topic.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            {topic.category && <Badge variant="outline">{topic.category}</Badge>}
            <Badge variant="secondary">Mastery: {topic.mastery}%</Badge>
            {streak >= 2 && (
              <Badge className="bg-orange-500 text-white animate-pulse">{streak} Streak</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={tts.cycle} title={tts.title}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border transition-all ${
              tts.enabled ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"
            }`}>
            {tts.label}
          </button>
          {topic.content && (
            <Button variant="ghost" size="sm" onClick={() => setShowContent(!showContent)}>
              {showContent ? "Hide Reference" : "Show Reference"}
            </Button>
          )}
          <Link href={`/study/${topicId}/immersive`}>
            <Button variant="outline" size="sm">Immersive</Button>
          </Link>
        </div>
      </div>

      {/* Reference content */}
      {showContent && topic.content && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Reference Material</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown className="text-muted-foreground">{topic.content || ""}</Markdown>
          </CardContent>
        </Card>
      )}

      {/* Session result */}
      {result && (
        <Card className="border-green-500/50 result-slide-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Session Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <ScoreRing score={result.score} />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>
            </div>
            {result.weakPoints.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-1">Weak Points:</div>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {result.weakPoints.map((wp, i) => <li key={i}>{wp}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => { setResult(null); setMessages([]); setSessionId(null); setStreak(0); }}>
                Study Again
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat area */}
      {!result && (
        <Card className="flex flex-col" style={{ height: "calc(100vh - 250px)" }}>
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Feynman Learning Session</CardTitle>
              <div className="flex items-center gap-2">
                {latestFeedback && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full feedback-pop ${
                    latestFeedback === "correct" ? "bg-green-500/10 text-green-600"
                    : latestFeedback === "wrong" ? "bg-orange-500/10 text-orange-600"
                    : "bg-blue-500/10 text-blue-600"
                  }`}>
                    {latestFeedback === "correct" ? "🎉 Correct" : latestFeedback === "wrong" ? "✗ Not quite" : "💡 Key point"}
                  </span>
                )}
                {sessionId && messages.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(messages.length / 2)} rounds
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 pb-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-4 min-h-0" ref={scrollRef}>
              {!sessionId && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-4xl mb-4">🎯</p>
                    <p className="text-muted-foreground mb-4">
                      AI will interview you on this topic.<br />
                      Answer in your own words to test your understanding.
                    </p>
                    <Button onClick={startSession} disabled={sending} size="lg">
                      {sending ? "Starting..." : "Start Session"}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} msg-enter`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : msg.feedback === "correct"
                          ? "bg-green-500/10 border border-green-500/20"
                          : msg.feedback === "wrong"
                          ? "bg-orange-500/10 border border-orange-500/20"
                          : "bg-muted"
                      }`}
                    >
                      {msg.role === "assistant"
                        ? <Markdown>{msg.content}</Markdown>
                        : msg.content}
                    </div>
                  </div>
                ))}
                {sending && sessionId && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2.5 text-sm">
                      <span className="typing-dots">
                        <span>.</span><span>.</span><span>.</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {sessionId && (
              <>
                <Separator className="my-3 shrink-0" />
                <div className="flex gap-2 shrink-0">
                  <Textarea
                    placeholder="Type your answer... (Enter to send)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    className="resize-none"
                    disabled={sending}
                  />
                  <div className="flex flex-col gap-1">
                    <Button onClick={sendMessage} disabled={sending || !input.trim()} size="sm">
                      Send
                    </Button>
                    <Button onClick={finishSession} disabled={finishing || messages.length < 3} variant="outline" size="sm">
                      {finishing ? "..." : "Finish"}
                    </Button>
                    <Button onClick={() => { setSessionId(null); setMessages([]); setStreak(0); setLatestFeedback(null); }}
                      variant="ghost" size="sm" className="text-xs">
                      Reset
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 45;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#3b82f6" : score >= 40 ? "#eab308" : "#ef4444";
  return (
    <div className="relative w-28 h-28 score-ring-enter">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold">{score}</div>
    </div>
  );
}
