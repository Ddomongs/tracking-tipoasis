/** True when the suite runs against `next start` (roadmap §11.10). Budgets and production-only checks skip otherwise. */
export const IS_PRODUCTION_RUN: boolean = process.env.PW_MODE === "production";
