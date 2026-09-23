"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";

// localStorage-backed state shared by every component using the same key.
// Server rendering and hydration use the fallback; the stored value is
// applied right after hydration without a mismatch.

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const snapshots = new Map<string, { value: unknown }>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function readSnapshot<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  const cached = snapshots.get(key);
  if (cached) return cached.value as T;
  const value = readStored(key, fallback, isValid);
  snapshots.set(key, { value });
  return value;
}

export function useStoredState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (next: T | ((previous: T) => T)) => void] {
  const subscribe = useCallback((listener: Listener) => {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(listener);
    // Another tab changed the value.
    const onStorage = (event: StorageEvent) => {
      if (event.key === `lumen:${key}`) {
        snapshots.delete(key);
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      set.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  const value = useSyncExternalStore(
    subscribe,
    () => readSnapshot(key, fallback, isValid),
    () => fallback,
  );

  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    const previous = readSnapshot(key, fallback, isValid);
    const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
    if (Object.is(resolved, previous)) return;
    snapshots.set(key, { value: resolved });
    writeStored(key, resolved);
    notify(key);
  }, [key, fallback, isValid]);

  return [value, setValue];
}
