"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useStoredState } from "@/hooks/useStoredState";
import { ApiError, api } from "@/lib/api-client";
import type { GenerationInput, ValidationIssue } from "@/lib/catalog/payload";
import type { ModelSpec, StudioId } from "@/lib/catalog/types";
import { MAX_RECORDS, isPollable, isRecordList, type GenerationRecord } from "@/lib/generations";
import { isTerminal } from "@/lib/higgsfield/status";
import { useSession } from "./SessionProvider";

export type SubmitResult = { ok: true } | { ok: false; message: string; issues: ValidationIssue[] };

interface GenerationsContextValue {
  records: GenerationRecord[];
  submit: (model: ModelSpec, input: GenerationInput) => Promise<SubmitResult>;
  cancel: (id: string) => Promise<string | null>;
  remove: (id: string) => void;
}

const GenerationsContext = createContext<GenerationsContextValue | null>(null);
const NO_RECORDS: GenerationRecord[] = [];
const FIRST_POLL_MS = 1500;
const MAX_POLL_MS = 10_000;

export function GenerationsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useStoredState("generations.v1", NO_RECORDS, isRecordList);
  const { session, reportCredentialsProblem } = useSession();
  const connected = session?.connected ?? false;

  const update = useCallback((id: string, patch: Partial<GenerationRecord>) => {
    setRecords((previous) => previous.map((record) =>
      record.id === id ? { ...record, ...patch, updatedAt: Date.now() } : record));
  }, [setRecords]);

  // Poll every unfinished request with backoff (Higgsfield recommends 2s → 10s
  // with jitter). Requests resume after a reload and across studio pages.
  const pollableIds = records.filter(isPollable).map((record) => record.id).join(",");
  useEffect(() => {
    if (!pollableIds || !connected) return;
    let stopped = false;
    const timers = new Set<number>();
    const schedule = (id: string, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        void poll(id, delay);
      }, delay + Math.random() * 400);
      timers.add(timer);
    };
    const poll = async (id: string, delay: number) => {
      try {
        const state = await api.getGeneration(id);
        if (stopped) return;
        update(id, { status: state.status, outputs: state.outputs, error: state.error });
        if (isTerminal(state.status)) return;
      } catch (error) {
        if (stopped) return;
        if (error instanceof ApiError && error.needsCredentials) {
          reportCredentialsProblem();
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          update(id, { status: "lost", error: "Higgsfield no longer has this request." });
          return;
        }
      }
      schedule(id, Math.min(delay * 1.5, MAX_POLL_MS));
    };
    for (const id of pollableIds.split(",")) schedule(id, FIRST_POLL_MS);
    return () => {
      stopped = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pollableIds, connected, update, reportCredentialsProblem]);

  const submit = useCallback(async (model: ModelSpec, input: GenerationInput): Promise<SubmitResult> => {
    const localId = `local-${crypto.randomUUID()}`;
    const now = Date.now();
    const record: GenerationRecord = {
      id: localId,
      studio: model.studio,
      modelId: model.id,
      modelName: `${model.familyName} · ${model.workflowName}`,
      output: model.output,
      input,
      status: "submitting",
      outputs: [],
      createdAt: now,
      updatedAt: now,
    };
    setRecords((previous) => [record, ...previous].slice(0, MAX_RECORDS));
    try {
      const { id } = await api.submitGeneration(model.id, input);
      setRecords((previous) => previous.map((item) =>
        item.id === localId ? { ...item, id, status: "queued", updatedAt: Date.now() } : item));
      return { ok: true };
    } catch (error) {
      setRecords((previous) => previous.filter((item) => item.id !== localId));
      if (error instanceof ApiError) {
        if (error.needsCredentials) reportCredentialsProblem();
        return { ok: false, message: error.message, issues: error.issues };
      }
      return { ok: false, message: "Could not start the generation.", issues: [] };
    }
  }, [setRecords, reportCredentialsProblem]);

  const cancel = useCallback(async (id: string) => {
    try {
      await api.cancelGeneration(id);
      update(id, { status: "canceled" });
      return null;
    } catch (error) {
      return error instanceof ApiError ? error.message : "Could not cancel the request.";
    }
  }, [update]);

  const remove = useCallback((id: string) => {
    setRecords((previous) => previous.filter((record) => record.id !== id));
  }, [setRecords]);

  const value = useMemo(() => ({ records, submit, cancel, remove }), [records, submit, cancel, remove]);
  return <GenerationsContext value={value}>{children}</GenerationsContext>;
}

export function useGenerations(studio: StudioId) {
  const context = useContext(GenerationsContext);
  if (!context) throw new Error("useGenerations must be used inside <GenerationsProvider>.");
  const records = useMemo(() => context.records.filter((record) => record.studio === studio), [context.records, studio]);
  return { ...context, records };
}
