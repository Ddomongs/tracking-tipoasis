/** The one lazy entry of the result area (roadmap §11.9). Only load-result-module.ts imports it, dynamically. */
export { ResultView } from "./ResultView";
export { deriveTrackingView } from "@/lib/tracking/derive-view";
export { siteConfig } from "@/config/site.config";
export { deriveResultView } from "./approvals";
