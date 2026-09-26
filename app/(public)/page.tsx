import { redirect } from "next/navigation";
import { HomePageClient } from "@/components/HomePageClient";

type HomePageProps = {
  searchParams: Promise<{
    trackingNumber?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { trackingNumber: raw } = await searchParams;
  if (typeof raw === "string" && raw.trim()) {
    redirect(`/${encodeURIComponent(raw.trim())}`);
  }

  return <HomePageClient initialTrackingNumber="" />;
}
