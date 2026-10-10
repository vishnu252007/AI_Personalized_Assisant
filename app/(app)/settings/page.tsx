"use client";

import * as React from "react";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfileInsightsQuery } from "@/lib/hooks/use-learn-query";
import { AccessibilitySection } from "@/components/settings/accessibility-section";
import { CognitiveTransparency } from "@/components/settings/cognitive-transparency";
import { ProfileForm } from "@/components/settings/profile-form";
import { DataPurgeSection } from "@/components/settings/data-purge-section";

export default function SettingsPage() {
  const [userId, setUserId] = React.useState<string>("");
  const [email, setEmail] = React.useState<string>("");
  const [level, setLevel] = React.useState<string>("beginner");
  const [preferredStyle, setPreferredStyle] = React.useState<string>("analogy");
  const [saving, setSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  const { data: insights, isLoading: loadingInsights } = useProfileInsightsQuery();

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-20 md:pb-8">
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

      {/* Accessibility Preferences */}
      <AccessibilitySection />

      {/* Cognitive Model Transparency Card */}
      <CognitiveTransparency insights={insights} loading={loadingInsights} />

      {/* Learner Profile Form */}
      <ProfileForm
        email={email}
        userId={userId}
        level={level}
        onLevelChange={setLevel}
        preferredStyle={preferredStyle}
        onStyleChange={setPreferredStyle}
        onSave={handleSaveProfile}
        saving={saving}
        savedSuccess={savedSuccess}
      />

      {/* Data Privacy & GDPR Purge */}
      <DataPurgeSection userId={userId} />
    </div>
  );
}
