/** Connection state exposed by GET /api/session. Never includes the secret. */
export interface SessionState {
  connected: boolean;
  /** `env`: configured on the server; `cookie`: saved from Settings. */
  source: "env" | "cookie" | null;
  /** First characters of the key ID, for display. */
  keyIdHint: string | null;
}
