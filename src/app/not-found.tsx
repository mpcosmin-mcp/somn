import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 dots">
      <div className="text-center max-w-md">
        <div className="num text-7xl sm:text-8xl font-bold mb-2 text-[var(--color-accent)]">404</div>
        <div className="text-sm text-[var(--color-fg-muted)] mb-1 num">~$ pagina nu există</div>
        <div className="text-xs text-[var(--color-fg-dim)] mb-8">
          Probabil ai dormit prea puțin și ai tastat greșit.
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:brightness-110 active:brightness-95 transition-all"
        >
          ← înapoi la dashboard
        </Link>
      </div>
    </main>
  );
}
