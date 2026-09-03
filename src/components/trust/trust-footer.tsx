import Link from "next/link";

export function TrustFooter() {
  return (
    <footer className="border-t border-white/5 py-6 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
        <span>Server-memory session · No application database write by default</span>
        <Link href="/privacy" className="hover:text-text-secondary transition-colors">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
