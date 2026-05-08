'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface errors in production logs
    console.error('[App error]', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 dots">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">💥</div>
        <div className="text-2xl font-bold tracking-tight mb-2">ceva a explodat</div>
        <div className="text-sm text-[var(--color-fg-muted)] mb-1">
          Aplicația a întâlnit o eroare neașteptată.
        </div>
        {error.message && (
          <code className="block text-[10px] text-[var(--color-fg-dim)] num mt-3 mb-6 px-3 py-2 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] text-left overflow-x-auto">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </code>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:brightness-110 active:brightness-95 transition-all"
          >
            ↻ încearcă din nou
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-[var(--color-border)] text-sm hover:border-[var(--color-fg-dim)] transition-colors"
          >
            ← înapoi la dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
