"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api-client";
import { Dialog } from "@/components/ui/Dialog";
import { useSession } from "./SessionProvider";

export function SettingsDialog() {
  const { session, connect, disconnect, settingsOpen, closeSettings } = useSession();
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await connect(keyId.trim(), secret.trim());
      setKeyId("");
      setSecret("");
      closeSettings();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the API key.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={settingsOpen}
      onClose={closeSettings}
      title="Higgsfield API"
      description="Lumen Studio runs every model through your Higgsfield account."
    >
      {session?.source === "env" ? (
        <p className="rounded-xl border border-line bg-black/20 p-4 text-sm text-fg/90">
          Connected with the key configured on the server (<code className="text-accent">HF_API_KEY_ID</code>,{" "}
          <code className="text-accent">{session.keyIdHint}</code>). Change it in the server environment.
        </p>
      ) : session?.connected ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl border border-line bg-black/20 p-4 text-sm">
            Connected as <code className="text-accent">{session.keyIdHint}</code>. The key is stored in an httpOnly cookie and only
            used by this app&apos;s server.
          </p>
          <button type="button" className="button-danger" onClick={handleDisconnect} disabled={busy}>
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">API key ID</span>
            <input className="field" autoComplete="off" spellCheck={false} required value={keyId} onChange={(event) => setKeyId(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">API key secret</span>
            <input className="field" type="password" autoComplete="off" required value={secret} onChange={(event) => setSecret(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" className="button-primary mt-1" disabled={busy}>
            {busy ? "Verifying…" : "Connect"}
          </button>
          <p className="text-xs text-muted">
            Create a key at{" "}
            <a className="text-accent hover:underline" href="https://console.higgsfield.ai" target="_blank" rel="noreferrer">console.higgsfield.ai</a>.
            It is verified with Higgsfield, then kept in an httpOnly cookie that browser scripts cannot read.
          </p>
        </form>
      )}
    </Dialog>
  );
}
