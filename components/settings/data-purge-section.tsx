"use client";

import * as React from "react";
import { ShieldAlert, Trash2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface DataPurgeSectionProps {
  userId: string;
}

export function DataPurgeSection({ userId }: DataPurgeSectionProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmInput, setConfirmInput] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

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
    <>
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
    </>
  );
}
