import { redirect } from "next/navigation";
import { HomePageClient } from "@/components/HomePageClient";

type TrackingPathPageProps = {
  params: {
    trackingNumber: string;
  };
};

export default function TrackingPathPage({ params }: TrackingPathPageProps) {
  const normalized = params.trackingNumber.trim();

  if (!normalized) {
    redirect("/");
  }

  return <HomePageClient initialTrackingNumber={normalized} />;
}
