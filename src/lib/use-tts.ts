"use client";

import { useRef, useState, useCallback } from "react";

type TTSMode = "edge" | "browser" | "off";

export function useTTS() {
  const [mode, setMode] = useState<TTSMode>("edge");
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speakBrowser = useCallback((text: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 500));
    u.lang = "zh-CN";
    u.rate = 1.05;
    u.pitch = 1.1;
    const voices = speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith("zh") && v.name.includes("Ting"))
      || voices.find(v => v.lang.startsWith("zh"));
    if (zhVoice) u.voice = zhVoice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(u);
  }, []);

  const speakEdge = useCallback(async (text: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    setSpeaking(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 500) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setSpeaking(false);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (mode === "off" || !text) return;
    if (mode === "browser") {
      speakBrowser(text);
    } else {
      speakEdge(text);
    }
  }, [mode, speakBrowser, speakEdge]);

  const cycle = useCallback(() => {
    stop();
    setMode(prev => prev === "edge" ? "browser" : prev === "browser" ? "off" : "edge");
  }, [stop]);

  const enabled = mode !== "off";
  const label = mode === "edge" ? "🔊" : mode === "browser" ? "📢" : "🔇";
  const title = mode === "edge" ? "Edge TTS (online)" : mode === "browser" ? "Browser TTS (local)" : "Voice off";

  return { speak, stop, cycle, speaking, enabled, mode, label, title };
}
