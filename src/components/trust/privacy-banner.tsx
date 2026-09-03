export function PrivacyBanner() {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 sm:px-6">
      <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass-strong text-[11px] text-text-muted shadow-2xl">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-75 animate-pulse-slow" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green" />
        </span>
        <span className="hidden sm:inline">Processed in server memory</span>
        <span className="sm:hidden">Server memory</span>
        <span className="text-text-faint">·</span>
        <span className="hidden sm:inline">No trackers</span>
      </div>
    </div>
  );
}
