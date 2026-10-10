"use client";

import { Sliders } from "lucide-react";

interface DashboardSimulatorProps {
  demoDay: number;
  onDayChange: (day: number) => void;
}

export function DashboardSimulator({
  demoDay,
  onDayChange,
}: DashboardSimulatorProps) {
  return (
    <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 p-6 sm:p-7 backdrop-blur-md space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
              Interactive Demonstration
            </span>
          </div>
          <h3 className="font-bold text-base text-foreground">
            7-Day Learner Model Time-Travel Simulator
          </h3>
          <p className="text-xs text-muted-foreground">
            Scrub the timeline to witness how Elo mastery, retention half-life, and daily tasks evolve day-by-day.
          </p>
        </div>

        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-center">
          <span className="text-[10px] uppercase font-bold text-indigo-500 block">Current Day</span>
          <span className="font-black text-lg text-foreground">Day {demoDay} of 7</span>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <input
          type="range"
          min="1"
          max="7"
          step="1"
          value={demoDay}
          onChange={(e) => onDayChange(Number(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer h-2 bg-muted rounded-lg"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
          <span>Day 1 (Diagnostic)</span>
          <span>Day 3 (Sliding Window Trap)</span>
          <span>Day 5 (Binary Search)</span>
          <span>Day 7 (Today&apos;s Review)</span>
        </div>
      </div>
    </div>
  );
}
