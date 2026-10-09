"use client";

import * as React from "react";

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    try {
      const dyslexic = localStorage.getItem("learnai_dyslexic") === "true";
      const largeText = localStorage.getItem("learnai_large_text") === "true";

      if (dyslexic) {
        document.body.classList.add("dyslexic-font");
      } else {
        document.body.classList.remove("dyslexic-font");
      }

      if (largeText) {
        document.body.classList.add("large-text");
      } else {
        document.body.classList.remove("large-text");
      }
    } catch {
      // Ignore if localStorage unavailable
    }
  }, []);

  return <>{children}</>;
}
