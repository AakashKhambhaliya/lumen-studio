"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { MediaField } from "@/lib/catalog/schema";
import type { MediaKind } from "@/lib/catalog/types";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES_BY_KIND, normalizeUploadType } from "@/lib/uploads";

export interface PendingUpload {
  id: string;
  fieldKey: string;
  kind: MediaKind;
  name: string;
  previewUrl: string;
  progress: number;
  error?: string;
}

/**
 * Uploads files for a media input and reports each finished URL through
 * `onUploaded`. In-flight and failed uploads stay visible until dismissed.
 */
export function useUploads(onUploaded: (fieldKey: string, url: string) => void) {
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const previews = useRef(new Map<string, string>());
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  useEffect(() => {
    const active = controllers.current;
    const urls = previews.current;
    return () => {
      active.forEach((controller) => controller.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const patch = useCallback((id: string, change: Partial<PendingUpload>) => {
    setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, ...change } : upload)));
  }, []);

  const discard = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    const preview = previews.current.get(id);
    if (preview) URL.revokeObjectURL(preview);
    previews.current.delete(id);
    setUploads((current) => current.filter((upload) => upload.id !== id));
  }, []);

  const upload = useCallback((field: MediaField, files: File[]) => {
    for (const file of files) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      previews.current.set(id, previewUrl);
      const type = normalizeUploadType(file.type);
      const pending: PendingUpload = { id, fieldKey: field.key, kind: field.kind, name: file.name, previewUrl, progress: 0 };

      if (!UPLOAD_TYPES_BY_KIND[field.kind].includes(type)) {
        setUploads((current) => [...current, { ...pending, error: `${file.name}: unsupported ${field.kind} format.` }]);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploads((current) => [...current, { ...pending, error: `${file.name} is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` }]);
        continue;
      }

      const controller = new AbortController();
      controllers.current.set(id, controller);
      setUploads((current) => [...current, pending]);
      api.uploadFile(file, type, (progress) => patch(id, { progress }), controller.signal)
        .then((url) => {
          onUploadedRef.current(field.key, url);
          discard(id);
        })
        .catch((error: Error) => {
          controllers.current.delete(id);
          if (!controller.signal.aborted) patch(id, { error: error.message });
        });
    }
  }, [discard, patch]);

  return { uploads, upload, discard };
}
