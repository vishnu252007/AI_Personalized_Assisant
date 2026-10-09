"use client";

import * as React from "react";
import {
  Settings,
  ShieldAlert,
  User,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Brain,
  Sliders,
  Type,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LearnerInsights {
  adaptationSummary: string;
  traits: {
    preferredDepth: string;
    preferredLength: string;
    preferredStyle: string;
    pace: string;
    persistenceScore: number;
    dailyGoalMinutes: number;
    depthDescription: string;
    styleDescription: string;
    paceDescription: string;
  };
  strengths: Array<{ name: string; stage: string }>;
  weaknesses: Array<{ name: string; stage: string }>;
}

export default function SettingsPage() {
  const [userId, setUserId] = React.useState<string>("");
  const [email, setEmail] = React.useState<string>("");
  const [level, setLevel] = React.useState<string>("beginner");
  const [preferredStyle, setPreferredStyle] = React.useState<string>("analogy");
  const [saving, setSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Accessibility State
  const [dyslexicFont, setDyslexicFont] = React.useState(false);
  const [largeText, setLargeText] = React.useState(false);

  // Learner Insights State
  const [insights, setInsights] = React.useState<LearnerInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = React.useState(false);

  // Delete modal state
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmInput, setConfirmInput] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // 1. Initialize accessibility from localStorage
    try {
      const isDyslexic = localStorage.getItem("learnai_dyslexic") === "true";
      const isLarge = localStorage.getItem("learnai_large_text") === "true";
      setDyslexicFont(isDyslexic);
      setLargeText(isLarge);
    } catch {
      // Ignored
    }

    // 2. Load auth & user profile
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        setEmail(data.user.email || "");

        supabase
          .from("profiles")
          .select("level, preferred_style")
          .eq("id", data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile) {
              if (profile.level) setLevel(profile.level);
              if (profile.preferred_style) setPreferredStyle(profile.preferred_style);
            }
          });

        // 3. Load learner transparency insights
        setLoadingInsights(true);
        fetch("/api/profile/insights")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) setInsights(data);
          })
          .catch(() => {})
          .finally(() => setLoadingInsights(false));
      }
    });
  }, []);

  const toggleDyslexicFont = () => {
    const nextVal = !dyslexicFont;
    setDyslexicFont(nextVal);
    try {
      localStorage.setItem("learnai_dyslexic", String(nextVal));
      if (nextVal) {
        document.body.classList.add("dyslexic-font");
      } else {
        document.body.classList.remove("dyslexic-font");
      }
    } catch {
      // Ignored
    }
  };

  const toggleLargeText = () => {
    const nextVal = !largeText;
    setLargeText(nextVal);
    try {
      localStorage.setItem("learnai_large_text", String(nextVal));
      if (nextVal) {
        document.body.classList.add("large-text");
      } else {
        document.body.classList.remove("large-text");
      }
    } catch {
      // Ignored
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({
          level,
          preferred_style: preferredStyle,
        })
        .eq("id", userId);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      // Ignored
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeAccount = async () => {
    if (confirmInput !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to purge account data");
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Error purging account");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-primary" />
          <span>Settings & Adaptivity Controls</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Accessibility preferences, cognitive model transparency, and GDPR data ownership
        </p>
      </div>

      {/* ── SECTION 1: ACCESSIBILITY PREFERENCES ────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-border/60 pb-4">
          <Eye className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Accessibility & Readability</h2>
        </div>

        <div className="space-y-4">
          {/* Dyslexia-Friendly Font Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Dyslexia-Friendly Font
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enhances letter differentiation, character spacing, and line height to minimize reading fatigue.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleDyslexicFont}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                dyslexicFont ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                  dyslexicFont ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Large Text Mode Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  High-Comfort Large Text
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Increases base typography scale for higher contrast and effortless reading on mobile & desktop.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleLargeText}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                largeText ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                  largeText ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: HOW THE TUTOR ADAPTS TO YOU (TRANSPARENCY CARD) ────────── */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-primary/10 pb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              How the Tutor Adapts to You (Cognitive Model)
            </h2>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
            Bayesian Calibrated
          </span>
        </div>

        {loadingInsights ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Loading cognitive profile insights...
          </div>
        ) : insights ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/80 bg-card/80 p-4 text-xs text-foreground leading-relaxed">
              <p className="font-medium text-foreground">{insights.adaptationSummary}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Explanation Depth
                </span>
                <span className="text-xs font-bold text-primary block">
                  {insights.traits.depthDescription}
                </span>
              </div>

              <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Teaching Modality
                </span>
                <span className="text-xs font-bold text-primary block">
                  {insights.traits.styleDescription}
                </span>
              </div>

              <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Curriculum Pace
                </span>
                <span className="text-xs font-bold text-primary block">
                  {insights.traits.paceDescription}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>
                🎯 Daily Mastery Goal: <strong>{insights.traits.dailyGoalMinutes} mins/day</strong>
              </span>
              <span>
                Mastered: <strong className="text-emerald-500">{insights.strengths.length}</strong> | In Progress: <strong className="text-amber-500">{insights.weaknesses.length}</strong>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Complete your first Socratic chat or practice quiz to populate your personalized cognitive profile.
          </p>
        )}
      </div>

      {/* ── SECTION 3: LEARNER PROFILE PREFERENCES ──────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-border/60 pb-4">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Learner Profile</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
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
                onChange={(e) => setLevel(e.target.value)}
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
                onChange={(e) => setPreferredStyle(e.target.value)}
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

      {/* ── SECTION 4: PRIVACY GUARANTEE & GDPR DATA PURGE ───────────────────── */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h2 className="text-base font-bold text-destructive">
            Data Privacy & Right to Erasure (GDPR)
          </h2>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          In accordance with our zero-data-retention guarantee, you can permanently erase your entire
          interaction history. This irreversibly purges your conversation messages, Elo mastery scores,
          forgetting curve half-lives, style stats, attempts, and authentication user account.
        </p>

        <div className="pt-2">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!userId}
            className="flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Permanently Purge All My Data</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-bold text-base">Irreversible Data Erasure</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This action cannot be undone. All your mastery calculations, attempts, and chat sessions will be
              wiped from the database immediately.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-foreground font-semibold">
                Type <span className="text-destructive font-mono">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-destructive">{deleteError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmInput("");
                }}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmInput !== "DELETE" || deleting}
                onClick={handlePurgeAccount}
                className="rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 transition"
              >
                {deleting ? "Purging..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
