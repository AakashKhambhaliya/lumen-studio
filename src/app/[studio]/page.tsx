import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Studio } from "@/components/studio/Studio";
import { STUDIOS, STUDIO_ORDER } from "@/config/studios";
import { getStudioModels } from "@/lib/catalog";
import type { StudioId } from "@/lib/catalog/types";

// The four studios are prerendered; the catalog is embedded in each page's
// server payload so the browser bundle does not ship model schemas.
export const dynamicParams = false;

export function generateStaticParams() {
  return STUDIO_ORDER.map((studio) => ({ studio }));
}

function isStudioId(value: string): value is StudioId {
  return (STUDIO_ORDER as string[]).includes(value);
}

export async function generateMetadata({ params }: PageProps<"/[studio]">): Promise<Metadata> {
  const { studio } = await params;
  return isStudioId(studio) ? { title: STUDIOS[studio].title, description: STUDIOS[studio].tagline } : {};
}

export default async function StudioPage({ params }: PageProps<"/[studio]">) {
  const { studio } = await params;
  if (!isStudioId(studio)) notFound();
  return <Studio key={studio} config={STUDIOS[studio]} models={getStudioModels(studio)} />;
}
