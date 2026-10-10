"use client";

import * as React from "react";
import { User, CheckCircle2 } from "lucide-react";

interface ProfileFormProps {
  email: string;
  userId: string;
  level: string;
  onLevelChange: (val: string) => void;
  preferredStyle: string;
  onStyleChange: (val: string) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  savedSuccess: boolean;
}

export function ProfileForm({
  email,
  userId,
  level,
  onLevelChange,
  preferredStyle,
  onStyleChange,
  onSave,
  saving,
  savedSuccess,
}: ProfileFormProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-border/60 pb-4">
        <User className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Learner Profile</h2>
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Account Email
            </label>
            <input
              type="text"
              disabled
              value={email || "Not signed in"}
              className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Account ID
            </label>
            <input
              type="text"
              disabled
              value={userId || "guest"}
              className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-xs font-mono text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Mastery Difficulty Baseline
            </label>
            <select
              value={level}
              onChange={(e) => onLevelChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="beginner">Beginner (Foundations & Syntax)</option>
              <option value="intermediate">Intermediate (Standard Algorithms)</option>
              <option value="advanced">Advanced (Optimized DP & Graphs)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Default Teaching Modality
            </label>
            <select
              value={preferredStyle}
              onChange={(e) => onStyleChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="analogy">Conceptual Analogies</option>
              <option value="steps">Step-by-Step Rigor</option>
              <option value="example">Concrete Real-World Code</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Profile updated successfully</span>
            </span>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={saving || !userId}
              className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
