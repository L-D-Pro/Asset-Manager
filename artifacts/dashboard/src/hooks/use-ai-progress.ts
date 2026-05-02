import { useEffect, useRef, useState } from "react";

export type AiProgressPhase = "idle" | "connecting" | "generating" | "finalizing" | "complete";

const CONNECTING_MAX_MS = 1200;
const GENERATING_MAX_MS = 4500;

export function useAiProgress(isPending: boolean) {
 const [progress, setProgress] = useState(0);
 const [phase, setPhase] = useState<AiProgressPhase>("idle");
 const progressRef = useRef(0);

 useEffect(() => {
 progressRef.current = progress;
 }, [progress]);

 useEffect(() => {
 if (isPending) {
 setPhase("connecting");
 if (progressRef.current === 0) {
 setProgress(5);
 }

 const startedAt = Date.now();
 const interval = window.setInterval(() => {
 const elapsed = Date.now() - startedAt;
 const nextProgress =
 elapsed < CONNECTING_MAX_MS
 ? 5 + (elapsed / CONNECTING_MAX_MS) * 15
 : elapsed < GENERATING_MAX_MS
 ? 20 + ((elapsed - CONNECTING_MAX_MS) / (GENERATING_MAX_MS - CONNECTING_MAX_MS)) * 65
 : 85 + Math.min(9, ((elapsed - GENERATING_MAX_MS) / 1000) * 9);

 setProgress(Math.max(5, Math.min(94, Math.round(nextProgress))));
 setPhase(elapsed < CONNECTING_MAX_MS ? "connecting" : elapsed < GENERATING_MAX_MS ? "generating" : "finalizing");
 }, 250);

 return () => window.clearInterval(interval);
 }

 if (progressRef.current > 0 && progressRef.current < 100) {
 setProgress(100);
 setPhase("complete");

 const timeout = window.setTimeout(() => {
 setProgress(0);
 setPhase("idle");
 }, 700);

 return () => window.clearTimeout(timeout);
 }

 return;
 }, [isPending]);

 return { progress, phase };
}
