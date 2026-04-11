"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTTS } from "@/lib/use-tts";
import { Markdown } from "@/components/Markdown";

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

// ─── Sound Effects ──────────────────────────────────────────

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
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
        break;
      case "combo":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.06);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
        break;
      case "wrong":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
      case "teach":
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(494, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        break;
      case "finish":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.36);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.7);
        break;
    }
  } catch { /* ignore */ }
}

// ─── Typewriter Hook ────────────────────────────────────────

function useTypewriter(speed = 30) {
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(false);
  const fullRef = useRef("");
  const iRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback((text: string) => {
    fullRef.current = text;
    iRef.current = 0;
    setDisplayed("");
    setTyping(true);
    function tick() {
      if (iRef.current < fullRef.current.length) {
        iRef.current++;
        setDisplayed(fullRef.current.slice(0, iRef.current));
        timerRef.current = setTimeout(tick, speed);
      } else {
        setTyping(false);
      }
    }
    tick();
  }, [speed]);

  const skip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDisplayed(fullRef.current);
    setTyping(false);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { displayed, typing, start, skip };
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
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | "teach" | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const tw = useTypewriter(28);
  const tts = useTTS();
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // State class for background
  const bgState = sending && sessionId ? "thinking" : feedback || "idle";

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
          // Show the last assistant message in dialogue box
          const last = data.messages.findLast((m: Message) => m.role === "assistant");
          if (last) tw.start(last.content);
        }
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      tw.start(data.messages[0]?.content || "");
      tts.speak(data.messages[0]?.content || "");
    }
    setSending(false);
  }

  async function sendMessage() {
    if (!input.trim() || !sessionId || tw.typing) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);
    setFeedback(null);

    const newMsgs = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMsgs);

    const res = await fetch("/api/study", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userMessage: userMsg }),
    });
    const data = await res.json();
    if (data.messages) {
      const fb: "correct" | "wrong" | "teach" = data.feedback || "teach";
      const msgs = data.messages.map((m: Message, i: number) =>
        i === data.messages.length - 1 && m.role === "assistant" ? { ...m, feedback: fb } : m
      );
      setMessages(msgs);
      setFeedback(fb);

      const newStreak = fb === "correct" ? streak + 1 : 0;
      setStreak(newStreak);

      if (fb === "correct" && newStreak >= 3) playSound("combo");
      else playSound(fb);

      // Typewriter + voice for the latest reply
      tw.start(data.message);
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
      if (!data.error) {
        playSound("finish");
        setResult(data);
        setTopic(data.topic);
      }
    } catch { /* ignore */ }
    setFinishing(false);
  }

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
      // Auto-send when final result
      if (e.results[e.results.length - 1].isFinal) {
        setListening(false);
        // Defer sendMessage so input state is updated
        setTimeout(() => {
          const btn = document.getElementById("send-btn");
          btn?.click();
        }, 300);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
    tts.stop(); // Stop TTS when mic is on
  }

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>;
  }

  if (!topic) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Topic not found</div>;
  }

  // History = all messages except the last assistant one (which is in the dialogue box)
  const history = messages.slice(0, -1);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden z-50 bg-[#0a0a14]">
      {/* Background character */}
      <div
        className="absolute inset-0 transition-[filter] duration-700"
        style={{
          backgroundImage: "url(/assets/01.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: bgState === "correct" ? "brightness(0.75) saturate(1.15)"
            : bgState === "wrong" ? "brightness(0.45) saturate(0.6)"
            : bgState === "teach" ? "brightness(0.55) saturate(0.9)"
            : bgState === "thinking" ? "brightness(0.5)" : "brightness(0.6)",
          zIndex: 0,
        }}
      />
      {/* Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          zIndex: 1,
          background: bgState === "correct"
            ? "linear-gradient(to bottom, rgba(34,197,94,0.1), rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0.92))"
            : "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0.92))",
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-3 pb-1"
        style={{ background: "linear-gradient(rgba(0,0,0,0.4), transparent)" }}>
        <button onClick={() => window.history.back()} className="text-white/60 text-sm hover:text-white/90">
          ← Back
        </button>
        <span className="text-white/85 text-sm font-semibold">{topic.title}</span>
        <div className="flex gap-2 items-center">
          {streak >= 2 && (
            <Badge className="bg-orange-500/25 text-orange-400 border-orange-500/30 animate-pulse">
              {streak} 🔥
            </Badge>
          )}
          {topic.category && (
            <Badge variant="outline" className="text-[#C3CC9B]/80 border-[#C3CC9B]/20 text-xs">
              {topic.category}
            </Badge>
          )}
          <button onClick={tts.cycle} title={tts.title}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border transition-all ${
              tts.enabled ? "bg-[#C3CC9B]/20 text-[#C3CC9B] border-[#C3CC9B]/30" : "bg-white/5 text-white/30 border-white/10"
            }`}>
            {tts.label}
          </button>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Result screen */}
      {result && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center gap-5 animate-in fade-in">
          <ScoreRing score={result.score} />
          <p className="text-white/50 text-sm">Session Score</p>
          <p className="text-white/80 text-sm text-center max-w-xs">{result.summary}</p>
          {result.weakPoints.length > 0 && (
            <div className="text-sm text-white/50 text-center">
              <p className="text-white/70 font-medium mb-1">Weak points:</p>
              {result.weakPoints.map((w, i) => <p key={i}>• {w}</p>)}
            </div>
          )}
          <div className="flex gap-3 mt-2">
            <Button onClick={() => { setResult(null); setMessages([]); setSessionId(null); setStreak(0); setFeedback(null); }}
              className="bg-[#C3CC9B]/20 text-[#C3CC9B] border border-[#C3CC9B]/30 hover:bg-[#C3CC9B]/30">
              Study Again
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()} className="text-white/40">Back</Button>
          </div>
        </div>
      )}

      {/* Dialogue area */}
      {!result && (
        <div className="relative z-10 px-4 pb-5">
          {/* History */}
          {history.length > 0 && (
            <div ref={historyRef} className="max-h-28 overflow-y-auto mb-2 space-y-1 scrollbar-thin">
              {history.map((m, i) => (
                <div key={i} className="text-xs leading-relaxed">
                  <span className={m.role === "assistant" ? "text-[#C3CC9B]/60 font-semibold" : "text-white/30 font-semibold"}>
                    {m.role === "assistant" ? "Teacher" : "You"}
                  </span>
                  <span className="text-white/40 ml-2">
                    {m.content.length > 100 ? m.content.slice(0, 100) + "..." : m.content}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Dialogue box */}
          <div className={`rounded-2xl p-4 backdrop-blur-xl border transition-colors duration-500 mb-3 ${
            feedback === "correct" ? "bg-black/80 border-green-500/30"
            : feedback === "wrong" ? "bg-black/80 border-yellow-500/30"
            : feedback === "teach" ? "bg-black/80 border-blue-500/30"
            : "bg-black/80 border-white/10"
          }`}>
            {/* Speaker */}
            <div className="flex items-center gap-2.5 mb-2">
              <img src="/assets/02.jpg" alt="" className="w-8 h-8 rounded-full object-cover object-[center_20%] border-2 border-[#C3CC9B]/30" />
              <span className={`text-xs font-semibold transition-colors ${
                feedback === "correct" ? "text-green-400" : feedback === "wrong" ? "text-yellow-400" : feedback === "teach" ? "text-blue-400" : "text-[#C3CC9B]"
              }`}>Teacher</span>
              {feedback && (
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  feedback === "correct" ? "bg-green-500/15 text-green-400"
                  : feedback === "wrong" ? "bg-yellow-500/15 text-yellow-400"
                  : "bg-blue-500/15 text-blue-400"
                }`}>
                  {feedback === "correct" ? "🎉 Correct" : feedback === "wrong" ? "✗ Not quite" : "💡 Key point"}
                </span>
              )}
            </div>

            {/* Text with cursor */}
            {!sessionId && !sending ? (
              <div className="text-white/90 text-sm leading-relaxed">
                <p className="text-white/50 mb-3">AI will interview you on this topic. Answer in your own words.</p>
                <Button onClick={startSession} className="bg-[#C3CC9B]/20 text-[#C3CC9B] border border-[#C3CC9B]/30 hover:bg-[#C3CC9B]/30">
                  Start Session
                </Button>
              </div>
            ) : (
              <div className="text-white/90 text-[15px] leading-[1.7] min-h-[1.7em]">
                {sending && !tw.typing ? (
                  <span className="text-white/30">Thinking...</span>
                ) : tw.typing ? (
                  <>
                    {tw.displayed}
                    <span className="inline-block w-0.5 h-[1em] bg-[#C3CC9B] ml-0.5 align-text-bottom animate-pulse" />
                  </>
                ) : (
                  <Markdown className="text-white/90 prose-invert prose-headings:text-white/90 prose-strong:text-white/95 prose-code:text-[#C3CC9B]">{tw.displayed}</Markdown>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          {sessionId && (
            <div className="flex gap-2 items-end">
              {/* Mic button */}
              <button
                onClick={toggleVoiceInput}
                disabled={sending || tw.typing}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border transition-all shrink-0 ${
                  listening
                    ? "bg-red-500/30 text-red-400 border-red-500/40 animate-pulse"
                    : "bg-white/[0.07] text-white/40 border-white/10 hover:text-white/70"
                }`}
              >
                🎙
              </button>
              <Textarea
                placeholder={listening ? "Listening..." : "Type or tap 🎙 to speak..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                rows={2}
                className="resize-none bg-white/[0.07] border-white/10 text-white/90 placeholder:text-white/20 backdrop-blur-lg rounded-xl"
                disabled={sending || tw.typing || listening}
              />
              <div className="flex flex-col gap-1">
                <Button id="send-btn" onClick={sendMessage} disabled={sending || !input.trim() || tw.typing} size="sm"
                  className="bg-[#C3CC9B]/20 text-[#C3CC9B] border border-[#C3CC9B]/25 hover:bg-[#C3CC9B]/30">
                  Send
                </Button>
                <Button onClick={finishSession} disabled={finishing || messages.length < 3} variant="ghost" size="sm"
                  className="text-white/30 text-xs">
                  {finishing ? "..." : "Finish"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Score Ring ─────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#3b82f6" : score >= 40 ? "#eab308" : "#ef4444";
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white">{score}</div>
    </div>
  );
}
