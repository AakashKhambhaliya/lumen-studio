/** Connection state exposed by GET /api/session. Never includes the API key. */
export interface SessionState {
  connected: boolean;
  /** `env`: configured on the server; `cookie`: saved from Settings. */
  source: "env" | "cookie" | null;
  /** First and last characters of the API key, e.g. `793c…767f`. */
  keyHint: string | null;
}
