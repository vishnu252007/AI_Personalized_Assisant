"use client";

import * as React from "react";
import {
  Settings,
  ShieldAlert,
  User,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [userId, setUserId] = React.useState<string>("");
  const [email, setEmail] = React.useState<string>("");
  const [level, setLevel] = React.useState<string>("beginner");
  const [preferredStyle, setPreferredStyle] = React.useState<string>("analogy");
  const [saving, setSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Delete modal state
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmInput, setConfirmInput] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
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
      }
    });
  }, []);

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
          <span>Settings & Privacy Controls</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Manage your learning style preference and exercise full GDPR data ownership
        </p>
      </div>

      {/* Profile Preferences */}
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
                Mastery Difficulty Level
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

      {/* Privacy Guarantee & Permanent Data Purge */}
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
