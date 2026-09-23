"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { STUDIOS, STUDIO_ORDER } from "@/config/studios";
import type { StudioId } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { CinemaIcon, ImageIcon, MotionIcon, SettingsIcon, VideoIcon } from "@/components/ui/icons";
import { GenerationsProvider } from "./GenerationsProvider";
import { SessionProvider, useSession } from "./SessionProvider";
import { SettingsDialog } from "./SettingsDialog";

const STUDIO_ICONS: Record<StudioId, typeof ImageIcon> = {
  image: ImageIcon,
  video: VideoIcon,
  cinema: CinemaIcon,
  motion: MotionIcon,
};

function Navigation() {
  const pathname = usePathname();
  const { session, openSettings } = useSession();

  return (
    <nav aria-label="Studios" className="flex shrink-0 items-center gap-1 border-b border-line bg-surface/60 px-3 py-2 md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-3 md:py-5">
      <Link href="/image" className="mr-3 flex items-center gap-2 px-2 md:mb-6 md:mr-0">
        <span className="size-6 rounded-lg bg-gradient-to-br from-accent to-violet-500" aria-hidden="true" />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Lumen Studio</span>
      </Link>
      {STUDIO_ORDER.map((id) => {
        const studio = STUDIOS[id];
        const Icon = STUDIO_ICONS[id];
        const active = pathname === studio.path;
        return (
          <Link
            key={id}
            href={studio.path}
            aria-current={active ? "page" : undefined}
            className={cn("nav-link", active && "nav-link-active")}
          >
            <Icon size={17} />
            <span className="sr-only sm:not-sr-only">{studio.title}</span>
          </Link>
        );
      })}
      <button type="button" onClick={openSettings} className="nav-link ml-auto md:ml-0 md:mt-auto">
        <span
          className={cn("size-2 rounded-full", session === null ? "bg-muted" : session.connected ? "bg-emerald-400" : "bg-amber-400")}
          aria-hidden="true"
        />
        <SettingsIcon size={17} />
        <span className="sr-only sm:not-sr-only">
          {session === null ? "Settings" : session.connected ? "Connected" : "Connect Higgsfield"}
        </span>
      </button>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <GenerationsProvider>
        <div className="flex h-dvh flex-col md:flex-row">
          <Navigation />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
        </div>
        <SettingsDialog />
      </GenerationsProvider>
    </SessionProvider>
  );
}
