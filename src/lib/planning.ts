import type { Goal } from "@/api/types";

export const GOAL_STATUS: Record<Goal["status"], { label: string; tone: "income" | "warn" | "expense" | "muted" }> = {
  reached: { label: "Reached", tone: "income" },
  on_track: { label: "On track", tone: "income" },
  behind: { label: "Behind", tone: "warn" },
  overdue: { label: "Past target date", tone: "expense" },
  no_deadline: { label: "No deadline", tone: "muted" },
};
