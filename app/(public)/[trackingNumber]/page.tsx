import { redirect } from "next/navigation";
import { HomePageClient } from "@/components/HomePageClient";

type TrackingPathPageProps = {
  params: Promise<{
    trackingNumber: string;
  }>;
};

export default async function TrackingPathPage({ params }: TrackingPathPageProps) {
  const { trackingNumber } = await params;
  const normalized = trackingNumber.trim();

  if (!normalized) {
    redirect("/");
  }

  return <HomePageClient initialTrackingNumber={normalized} />;
}
