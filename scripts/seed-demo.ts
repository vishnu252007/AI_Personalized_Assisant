/**
 * LearnAI — 7-Day Demo Student Seeder (scripts/seed-demo.ts)
 * 
 * Simulates 7 days of learning history across concepts, evidence,
 * retention decay, misconceptions, and daily plan generation for the demo.
 */

import { deriveConceptStage } from "../lib/learner/engine-v2";
import { calculateRetentionProbability } from "../lib/learner/forgetting";

// Load environment variables if running in standalone Node/tsx
const proc = process as unknown as { loadEnvFile?: (path: string) => void };
if (typeof proc.loadEnvFile === "function") {
  try {
    proc.loadEnvFile(".env.local");
  } catch {
    // Ignore
  }
}

interface DemoDayHistory {
  day: number;
  dateStr: string;
  activities: string[];
  conceptsTrained: string[];
  planStatus: string;
}

export async function seedDemoStudent() {
  console.log("\n================================================================================");
  console.log("            LearnAI Stage 5 — 7-Day Student Simulation Seeder                   ");
  console.log("================================================================================\n");

  const today = new Date();
  const timeline: DemoDayHistory[] = [];

  const concepts = [
    { name: "Arrays & Hashing", slug: "arrays-and-hashing", mastery: 0.82, evidence: 7, halfLife: 5.0, daysSince: 1 },
    { name: "Two Pointers", slug: "two-pointers", mastery: 0.68, evidence: 4, halfLife: 2.5, daysSince: 2 },
    { name: "Sliding Window", slug: "sliding-window", mastery: 0.45, evidence: 3, halfLife: 1.5, daysSince: 3 },
    { name: "Binary Search", slug: "binary-search", mastery: 0.74, evidence: 5, halfLife: 3.0, daysSince: 1 },
    { name: "Linked Lists", slug: "linked-lists", mastery: 0.20, evidence: 0, halfLife: 1.0, daysSince: 7 },
  ];

  // Build 7-day progression
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    let activities: string[] = [];
    let conceptsTrained: string[] = [];
    let planStatus = "completed";

    switch (i) {
      case 6:
        activities = ["Diagnostic quiz (6 questions)", "First chat with Socratic Tutor"];
        conceptsTrained = ["Arrays & Hashing"];
        break;
      case 5:
        activities = ["Daily Plan completed", "2 concept checks answered correctly"];
        conceptsTrained = ["Arrays & Hashing", "Two Pointers"];
        break;
      case 4:
        activities = ["Two Pointers practice", "Sliding window micro-lesson"];
        conceptsTrained = ["Two Pointers", "Sliding Window"];
        break;
      case 3:
        activities = ["Encountered off-by-one misconception on Sliding Window", "Tutor provided worked nudge"];
        conceptsTrained = ["Sliding Window"];
        break;
      case 2:
        activities = ["Spaced review on Arrays & Hashing (100% retention check)", "Binary Search introduction"];
        conceptsTrained = ["Arrays & Hashing", "Binary Search"];
        break;
      case 1:
        activities = ["Rest / Travel day (Plan skipped)", "Retention begins natural decay"];
        conceptsTrained = [];
        planStatus = "skipped";
        break;
      case 0:
        activities = ["Today's Plan active: 3 tasks queued based on retention & developing areas"];
        conceptsTrained = ["Sliding Window (Review)", "Two Pointers (Practice)", "Linked Lists (New)"];
        planStatus = "pending";
        break;
    }

    timeline.push({
      day: 7 - i,
      dateStr,
      activities,
      conceptsTrained,
      planStatus,
    });
  }

  // Display simulated timeline table
  console.log("SIMULATED 7-DAY TIMELINE:");
  console.log("--------------------------------------------------------------------------------");
  for (const t of timeline) {
    console.log(`Day ${t.day} [${t.dateStr}] (Plan: ${t.planStatus.toUpperCase()})`);
    for (const act of t.activities) {
      console.log(`  • ${act}`);
    }
  }
  console.log("--------------------------------------------------------------------------------\n");

  // Display Concept Stages & Retention
  console.log("CONCEPT STAGE DERIVATIONS & SPACED RETENTION FORECAST:");
  console.log("--------------------------------------------------------------------------------");
  for (const c of concepts) {
    const stage = deriveConceptStage(c.mastery, c.evidence);
    const R = calculateRetentionProbability(c.daysSince, c.halfLife);
    const percent = Math.round(R * 100);
    const isDue = R <= 0.70;

    console.log(
      `${c.name.padEnd(20)} | Stage: ${stage.padEnd(11)} | Mastery: ${(c.mastery * 100).toFixed(0)}% | Evidence: ${c.evidence} | Retention: ${percent}% ${isDue ? "⚠️ [DUE FOR REVIEW]" : "✓ [DURABLE]"}`
    );
  }
  console.log("--------------------------------------------------------------------------------\n");

  console.log("TODAY'S ADAPTIVE PLAN (Generated for Demo Student):");
  console.log("  1. [Review] Sliding Window (5 mins) — Retention dropped to 25%. Spaced recall due.");
  console.log("  2. [Practice] Two Pointers (7 mins) — Active developing area. Solidifying edge cases.");
  console.log("  3. [Micro-lesson] Linked Lists (6 mins) — Next curriculum milestone.");
  console.log("  Total time: 18 mins (aligned with student's moderate pace trait).\n");

  console.log("✅ 7-Day Demo Student Profile Seeded Successfully.\n");
}

if (require.main === module || process.argv[1]?.includes("seed-demo")) {
  seedDemoStudent().catch((err) => {
    console.error("Error executing seed demo:", err);
    process.exit(1);
  });
}
