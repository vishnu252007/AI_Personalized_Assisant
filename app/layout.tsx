import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LearnAI — AI Personalized Learning",
  description: "Adaptive Socratic tutoring powered by Google Gemini",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
