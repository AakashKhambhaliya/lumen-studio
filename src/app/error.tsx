"use client";

export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="m-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">{error.digest ? `Error ${error.digest}` : error.message}</p>
      <button type="button" className="button-primary" onClick={reset}>Try again</button>
    </div>
  );
}
