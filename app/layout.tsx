import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AccessibilityProvider } from "@/components/accessibility-provider";
import { QueryProvider } from "@/components/query-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LearnAI — Adaptive Socratic AI Learning Platform",
  description:
    "Master algorithms and system concepts through personalized Socratic dialogue, dynamic quizzes, Bayesian style adaptation, and Ebbinghaus spaced repetition.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AccessibilityProvider>
            <QueryProvider>
              <div className="flex min-h-screen flex-col bg-background text-foreground">
                {children}
              </div>
            </QueryProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
