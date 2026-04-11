"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useTTS } from "@/lib/use-tts";
import { Markdown } from "@/components/Markdown";

type Topic = {
  id: string;
  title: string;
  category: string | null;
  content: string | null;
  mastery: number;
  status: string;
};

type Round = { topic: Topic; userAnswer: string; isCorrect: boolean };

function playSound(type: "correct" | "wrong" | "finish") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "correct") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "wrong") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
      osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.36);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
    }
  } catch { /* ignore */ }
}

export default function FlashcardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = use(params);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"question" | "result" | "complete">("question");
  const [selfCorrect, setSelfCorrect] = useState<boolean | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const tts = useTTS();

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/plans/${planId}`);
      if (res.ok) {
        const data = await res.json();
        // Shuffle and take up to 10 topics that aren't mastered
        const pool = (data.topics || [])
          .filter((t: Topic) => t.status !== "mastered")
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);
        setTopics(pool);
      }
      setLoading(false);
    }
    load();
  }, [planId]);

  const topic = topics[current];
  const progress = topics.length > 0 ? ((current + (phase === "question" ? 0 : 1)) / topics.length) * 100 : 0;

  function handleSubmit() {
    if (!input.trim()) return;
    setPhase("result");
  }

  function handleSelfAssess(correct: boolean) {
    setSelfCorrect(correct);
    const newStreak = correct ? streak + 1 : 0;
    setStreak(newStreak);
    if (newStreak > bestStreak) setBestStreak(newStreak);
    setRounds([...rounds, { topic, userAnswer: input, isCorrect: correct }]);
    playSound(correct ? "correct" : "wrong");
    tts.speak(correct
      ? "Nice! You captured the key points. Keep it up."
      : "No worries. Read through the key points, you'll get it next time.");
  }

  function handleNext() {
    if (current + 1 >= topics.length) {
      playSound("finish");
      setPhase("complete");
    } else {
      setCurrent(current + 1);
      setInput("");
      setPhase("question");
      setSelfCorrect(null);
    }
  }

  function handleRestart() {
    const shuffled = [...topics].sort(() => Math.random() - 0.5);
    setTopics(shuffled);
    setCurrent(0);
    setInput("");
    setPhase("question");
    setSelfCorrect(null);
    setRounds([]);
    setStreak(0);
    setBestStreak(0);
  }

  if (loading) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a14] text-white/40">Loading...</div>;
  }

  if (topics.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a14] text-white/50 gap-4">
        <p>No topics to review.</p>
        <Button variant="ghost" onClick={() => window.history.back()} className="text-white/40">Back</Button>
      </div>
    );
  }

  const correctCount = rounds.filter(r => r.isCorrect).length;
  const score = rounds.length > 0 ? Math.round((correctCount / rounds.length) * 100) : 0;

  // ─── Complete Screen ──────────────────────────
  if (phase === "complete") {
    const r = 42;
    const c = 2 * Math.PI * r;
    const color = score >= 80 ? "#4ade80" : score >= 60 ? "#3b82f6" : score >= 40 ? "#eab308" : "#ef4444";

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a14] flex flex-col items-center justify-center gap-6 px-6">
        <div className="fixed inset-0" style={{ backgroundImage: "url(/assets/01.jpg)", backgroundSize: "cover", backgroundPosition: "center", filter: "brightness(0.25) blur(10px)", zIndex: 0 }} />
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Score ring */}
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white">{score}</div>
          </div>
          <p className="text-white/40 text-sm">Round Score</p>

          {/* Stats */}
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{correctCount}</div>
              <div className="text-xs text-white/40">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{rounds.length - correctCount}</div>
              <div className="text-xs text-white/40">Wrong</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{bestStreak}</div>
              <div className="text-xs text-white/40">Best Streak</div>
            </div>
          </div>

          {/* Teacher comment */}
          <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-4 max-w-md">
            <img src="/assets/02.jpg" alt="" className="w-10 h-10 rounded-full object-cover object-[center_20%] border-2 border-[#C3CC9B]/30" />
            <p className="text-white/70 text-sm leading-relaxed">
              {score >= 80 ? "Excellent! You have a solid grasp. Keep this momentum going."
                : score >= 50 ? "Good effort. Review the ones you missed — they come up often."
                : "These are fundamentals. Review and try again — repetition is key."}
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleRestart}
              className="bg-[#C3CC9B]/20 text-[#C3CC9B] border border-[#C3CC9B]/30 hover:bg-[#C3CC9B]/30">
              Next Round
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()} className="text-white/40">Back</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Question / Result Screen ─────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0a0a14]">
      {/* Background */}
      <div className="fixed inset-0 transition-[filter] duration-500"
        style={{
          backgroundImage: "url(/assets/01.jpg)", backgroundSize: "cover", backgroundPosition: "center",
          zIndex: 0,
          filter: selfCorrect === true ? "brightness(0.5) blur(4px) saturate(1.2)"
            : selfCorrect === false ? "brightness(0.25) blur(8px) saturate(0.5)"
            : "brightness(0.35) blur(6px)",
        }} />
      <div className="fixed inset-0 pointer-events-none transition-all duration-500" style={{
        zIndex: 1,
        background: selfCorrect === true
          ? "linear-gradient(to bottom, rgba(34,197,94,0.1), rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.88))"
          : "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.88))",
      }} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center gap-3 px-5 pt-4 pb-2">
        <button onClick={() => window.history.back()} className="text-white/50 text-sm hover:text-white/80">← Back</button>
        <button onClick={tts.cycle} title={tts.title}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border transition-all shrink-0 ${
            tts.enabled ? "bg-[#C3CC9B]/20 text-[#C3CC9B] border-[#C3CC9B]/30" : "bg-white/5 text-white/30 border-white/10"
          }`}>
          {tts.label}
        </button>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#6B7A4E] to-[#C3CC9B] rounded-full transition-all duration-500" style={{ width: progress + "%" }} />
        </div>
        <span className="text-white/40 text-xs">{current + 1}/{topics.length}</span>
        {streak >= 2 && (
          <Badge className="bg-orange-500/25 text-orange-400 border-orange-500/30 text-xs">{streak} 🔥</Badge>
        )}
      </div>

      {/* Center card */}
      <div className="flex-1 flex items-start justify-center relative z-10 px-5 py-4 overflow-y-auto">
        <div className="w-full max-w-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 transition-all">
          <div className="text-[10px] font-semibold text-[#C3CC9B]/50 uppercase tracking-wider mb-3">
            Question {current + 1} of {topics.length}
          </div>
          <h2 className="text-lg font-semibold text-white/95 leading-relaxed mb-5">{topic.title}</h2>

          {phase === "question" ? (
            <div className="flex flex-col gap-3">
              <Textarea
                placeholder="Type your answer..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                rows={4}
                className="resize-none bg-white/[0.06] border-white/10 text-white/90 placeholder:text-white/20 rounded-xl"
              />
              <Button onClick={handleSubmit} disabled={!input.trim()}
                className="bg-[#C3CC9B]/20 text-[#C3CC9B] border border-[#C3CC9B]/25 hover:bg-[#C3CC9B]/30 self-center">
                Submit
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
              {/* Comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.05] border border-white/10 max-h-60 overflow-y-auto">
                  <div className="text-[9px] font-semibold uppercase text-white/30 tracking-wide mb-1 sticky top-0">Your answer</div>
                  <div className="text-sm text-white/60 leading-relaxed">{input}</div>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 max-h-60 overflow-y-auto">
                  <div className="text-[9px] font-semibold uppercase text-green-400/60 tracking-wide mb-1 sticky top-0">Key points</div>
                  <Markdown className="text-green-100/80 prose-invert prose-headings:text-green-200/90 prose-strong:text-green-100">{topic.content || ""}</Markdown>
                </div>
              </div>

              {/* Self assessment */}
              {selfCorrect === null ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-white/40 text-xs">How did you do?</p>
                  <div className="flex gap-3">
                    <Button onClick={() => handleSelfAssess(true)}
                      className="bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25">
                      🎉 Got it
                    </Button>
                    <Button onClick={() => handleSelfAssess(false)}
                      className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25">
                      ✗ Missed it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {/* Teacher comment */}
                  <div className="flex items-center gap-2.5 bg-white/[0.04] rounded-xl p-3 w-full">
                    <img src="/assets/02.jpg" alt="" className="w-8 h-8 rounded-full object-cover object-[center_20%] border-2 border-[#C3CC9B]/30" />
                    <p className="text-white/70 text-xs leading-relaxed">
                      {selfCorrect
                        ? "Nice! You captured the key points. Keep it up."
                        : "No worries. Read through the key points — you'll get it next time."}
                    </p>
                  </div>
                  <Button onClick={handleNext}
                    className="bg-[#C3CC9B]/20 text-[#C3CC9B] border border-[#C3CC9B]/25 hover:bg-[#C3CC9B]/30">
                    {current + 1 >= topics.length ? "See Results" : "Next →"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
