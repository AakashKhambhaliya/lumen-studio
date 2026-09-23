/* eslint-disable @next/next/no-img-element -- previews of user uploads and
   Higgsfield outputs on arbitrary hosts; next/image would need every host
   allow-listed and would re-encode user media. */
import type { MediaKind } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { AudioIcon } from "@/components/ui/icons";

interface MediaThumbProps {
  kind: MediaKind;
  url: string;
  className?: string;
}

export function MediaThumb({ kind, url, className }: MediaThumbProps) {
  const frame = cn("shrink-0 overflow-hidden border border-line bg-white/5", className);
  if (kind === "image") return <img src={url} alt="" className={cn(frame, "object-cover")} />;
  if (kind === "video") return <video src={url} className={cn(frame, "object-cover")} muted playsInline preload="metadata" />;
  return (
    <span className={cn(frame, "flex items-center justify-center text-accent")}>
      <AudioIcon size={14} />
    </span>
  );
}
