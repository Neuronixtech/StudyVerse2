"use client";

import { useEffect, useRef, useState } from "react";
import {
  Captions,
  CircleCheck,
  FlaskConical,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
} from "lucide-react";
import { saveLessonProgress } from "@/lib/store";
import type { Lesson } from "@/lib/types";
import { cn, formatClock } from "@/lib/utils";

const SPEEDS = [1, 1.5, 2, 20] as const;

/**
 * Simulated video player. No real media is loaded in the UI-first phase;
 * playback advances a timer so progress tracking, resume and completion can be reviewed.
 */
export function SimPlayer({
  lesson,
  courseId,
  learnerId,
  initialPosition,
  alreadyCompleted,
  nextLabel,
  onNext,
}: {
  lesson: Lesson;
  courseId: string;
  learnerId: string | null;
  initialPosition: number;
  alreadyCompleted: boolean;
  nextLabel?: string;
  onNext?: () => void;
}) {
  const duration = lesson.durationSec;
  const canResume = initialPosition > 15 && initialPosition < duration * 0.95;
  const [position, setPosition] = useState(canResume ? initialPosition : 0);
  const [wantsPlay, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [showResume, setShowResume] = useState(canResume);
  const positionRef = useRef(position);
  const lastSavedRef = useRef(position);
  const completedRef = useRef(alreadyCompleted);
  const ended = position >= duration;
  const playing = wantsPlay && !ended;

  // Advance the simulated clock while playing
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setPosition((p) => Math.min(duration, p + 0.25 * speed));
    }, 250);
    return () => clearInterval(t);
  }, [playing, speed, duration]);

  // Persist progress periodically and auto-complete at 90%
  useEffect(() => {
    positionRef.current = position;
    if (!learnerId) return;
    const reachedEnd = position >= duration * 0.9;
    if (reachedEnd && !completedRef.current) {
      completedRef.current = true;
      saveLessonProgress(learnerId, courseId, lesson.id, position, true);
      lastSavedRef.current = position;
      return;
    }
    if (Math.abs(position - lastSavedRef.current) >= 10) {
      saveLessonProgress(learnerId, courseId, lesson.id, position);
      lastSavedRef.current = position;
    }
  }, [position, learnerId, courseId, lesson.id, duration]);

  // Save the final position when leaving the lesson
  useEffect(() => {
    return () => {
      if (learnerId && positionRef.current > 0 && positionRef.current !== lastSavedRef.current) {
        saveLessonProgress(learnerId, courseId, lesson.id, positionRef.current);
      }
    };
  }, [learnerId, courseId, lesson.id]);

  const seek = (to: number) => setPosition(Math.max(0, Math.min(duration, to)));
  const toggle = () => {
    if (ended) {
      setPosition(0);
      setPlaying(true);
    } else setPlaying(!playing);
    setShowResume(false);
  };
  const pct = (position / duration) * 100;

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`Video player: ${lesson.title}`}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          toggle();
        } else if (e.key === "ArrowRight") seek(position + 10);
        else if (e.key === "ArrowLeft") seek(position - 10);
      }}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-ink text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-400"
    >
      {/* "Video" surface */}
      <div className="absolute inset-0 bg-linear-to-br from-brand-950 via-ink to-brand-900" />
      <div className="bg-grid-faint absolute inset-0 opacity-30" />
      <div className={cn("absolute inset-0 grid place-items-center transition-opacity", playing ? "opacity-100" : "opacity-60")}>
        <div className="text-center">
          <p className="font-mono text-xs tracking-widest text-brand-300/80 uppercase">Lesson</p>
          <p className="mt-2 max-w-md px-6 text-lg font-bold text-white/90 sm:text-2xl">{lesson.title}</p>
          {playing && (
            <div className="mx-auto mt-5 flex h-6 items-end justify-center gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="w-1 animate-pulse rounded-full bg-brand-400" style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-1 text-[11px] font-bold text-ink">
        <FlaskConical className="size-3.5" /> Simulated player · no real video
      </span>

      {/* Big centre button */}
      {!playing && !showResume && !ended && (
        <button
          type="button"
          onClick={toggle}
          className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-700 shadow-2xl transition-transform hover:scale-105 sm:size-20"
          aria-label={position > 0 ? "Resume playback" : "Play lesson"}
        >
          <Play className="ml-1 size-8 fill-current sm:size-9" />
        </button>
      )}

      {/* Resume prompt */}
      {showResume && (
        <div className="absolute inset-0 grid place-items-center bg-ink/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm rounded-2xl bg-white p-5 text-center text-slate-600 shadow-2xl">
            <p className="text-base font-bold text-ink">Pick up where you left off?</p>
            <p className="mt-1 text-sm">You stopped at {formatClock(initialPosition)} of {formatClock(duration)}.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResume(false);
                  setPlaying(true);
                }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Resume from {formatClock(initialPosition)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResume(false);
                  setPosition(0);
                  setPlaying(true);
                }}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End screen */}
      {ended && (
        <div className="absolute inset-0 grid place-items-center bg-ink/80 backdrop-blur-sm">
          <div className="px-6 text-center">
            <CircleCheck className="mx-auto size-12 text-emerald-400" />
            <p className="mt-3 text-lg font-bold text-white">Lesson complete</p>
            {!learnerId && <p className="mt-1 text-sm text-white/70">Sign in to save progress and completion.</p>}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={toggle} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20">
                <RotateCcw className="size-4" /> Replay
              </button>
              {onNext && (
                <button type="button" onClick={onNext} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400">
                  {nextLabel ?? "Next lesson"} <SkipForward className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-3 pt-10 pb-2.5 sm:px-4">
        <label className="sr-only" htmlFor={`seek-${lesson.id}`}>
          Seek
        </label>
        <div className="relative h-4">
          <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-brand-400" style={{ width: `${pct}%` }} />
          </div>
          <input
            id={`seek-${lesson.id}`}
            type="range"
            min={0}
            max={duration}
            step={1}
            value={Math.floor(position)}
            onChange={(e) => {
              seek(Number(e.target.value));
              setShowResume(false);
            }}
            aria-valuetext={`${formatClock(position)} of ${formatClock(duration)}`}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          />
          <span className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center gap-1 sm:gap-2">
          <CtrlButton label={playing ? "Pause" : "Play"} onClick={toggle}>
            {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </CtrlButton>
          <CtrlButton label="Back 10 seconds" onClick={() => seek(position - 10)}>
            <RotateCcw />
          </CtrlButton>
          <CtrlButton label="Forward 10 seconds" onClick={() => seek(position + 10)}>
            <RotateCw />
          </CtrlButton>
          <span className="ml-1 font-mono text-xs text-white/90 tabular-nums">
            {formatClock(position)} / {formatClock(duration)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <label className="sr-only" htmlFor={`speed-${lesson.id}`}>
              Playback speed
            </label>
            <select
              id={`speed-${lesson.id}`}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) as (typeof SPEEDS)[number])}
              className="h-8 rounded-md bg-white/10 px-1.5 text-xs font-semibold text-white outline-none hover:bg-white/20 [&>option]:text-ink"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s === 20 ? "20× (demo)" : `${s}×`}
                </option>
              ))}
            </select>
            <CtrlButton label="Captions (not available in prototype)" disabled>
              <Captions />
            </CtrlButton>
            <CtrlButton label="Fullscreen (not available in prototype)" disabled>
              <Maximize />
            </CtrlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function CtrlButton({ label, onClick, disabled, children }: { label: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
