/**
 * "Now" for the app. In the design preview (sample data) it is fixed so relative
 * dates stay stable; with the backend on it is the real current time, so
 * follow-ups, due dates and timestamps on new records are correct.
 */
export const SAMPLE_NOW = process.env.NEXT_PUBLIC_BACKEND === "1" ? new Date() : new Date("2026-11-05T15:00:00");
