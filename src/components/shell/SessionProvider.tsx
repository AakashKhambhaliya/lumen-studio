"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { SessionState } from "@/lib/session";

interface SessionContextValue {
  /** `null` until the first check completes. */
  session: SessionState | null;
  connect: (keyId: string, secret: string) => Promise<void>;
  disconnect: () => Promise<void>;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  /** Called when the server reports missing or rejected credentials. */
  reportCredentialsProblem: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api.getSession()
      .then((state) => { if (active) setSession(state); })
      .catch(() => { if (active) setSession({ connected: false, source: null, keyIdHint: null }); });
    return () => { active = false; };
  }, []);

  const connect = useCallback(async (keyId: string, secret: string) => {
    setSession(await api.connect(keyId, secret));
  }, []);

  const disconnect = useCallback(async () => {
    setSession(await api.disconnect());
  }, []);

  const reportCredentialsProblem = useCallback(() => {
    setSession((current) => (current?.source === "env" ? current : { connected: false, source: null, keyIdHint: null }));
    setSettingsOpen(true);
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    session,
    connect,
    disconnect,
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    reportCredentialsProblem,
  }), [session, connect, disconnect, settingsOpen, reportCredentialsProblem]);

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>.");
  return context;
}
