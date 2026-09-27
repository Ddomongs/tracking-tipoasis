import { TrackingPage } from "@/components/shell/TrackingPage";

// Static: never reads the query (legacy links are redirected by next.config.ts). Re-rendered at most every 5 minutes
// so notice windows in config/site.config.ts switch on and off without a deploy (spec §3).
export const revalidate = 300;

export default function HomePage() {
  return <TrackingPage entry={{ kind: "home" }} />;
}
