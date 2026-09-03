interface TrustBadgeProps {
  icon: string;
  title: string;
  description: string;
}

export function TrustBadge({ icon, title, description }: TrustBadgeProps) {
  return (
    <div className="rounded-2xl bg-white/[0.025] ring-1 ring-white/5 p-5 hover:ring-white/15 transition-all">
      <div className="text-2xl mb-3">{icon}</div>
      <h4 className="font-[family-name:var(--font-heading)] font-semibold text-sm text-text-primary mb-1.5 tracking-tight">{title}</h4>
      <p className="text-xs text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}
