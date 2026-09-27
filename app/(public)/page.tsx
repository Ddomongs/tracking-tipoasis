import { HomePageClient } from "@/components/HomePageClient";

// Static: never reads the query string. Legacy '/?trackingNumber=X' links are redirected by next.config.ts.
export default function HomePage() {
  return <HomePageClient initialTrackingNumber="" />;
}
