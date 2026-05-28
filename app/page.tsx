import { redirect } from "next/navigation";
import { HomePageClient } from "@/components/HomePageClient";

type HomePageProps = {
  searchParams?: {
    trackingNumber?: string | string[];
  };
};

export default function HomePage({ searchParams }: HomePageProps) {
  const raw = searchParams?.trackingNumber;
  if (typeof raw === "string" && raw.trim()) {
    redirect(`/${encodeURIComponent(raw.trim())}`);
  }

  return <HomePageClient initialTrackingNumber="" />;
}
