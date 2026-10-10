"use client";

import * as React from "react";
import { Eye, Type, Sliders } from "lucide-react";

export function AccessibilitySection() {
  const [dyslexicFont, setDyslexicFont] = React.useState(false);
  const [largeText, setLargeText] = React.useState(false);

  React.useEffect(() => {
    try {
      const isDyslexic = localStorage.getItem("learnai_dyslexic") === "true";
      const isLarge = localStorage.getItem("learnai_large_text") === "true";
      setDyslexicFont(isDyslexic);
      setLargeText(isLarge);
    } catch {
      // Ignored
    }
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

  return (
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
  );
}
