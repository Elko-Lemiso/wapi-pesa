"use client";

import { useEffect, useRef, useState } from "react";

export interface NavSection {
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: NavSection[];
}

/**
 * A horizontal sticky tab strip that highlights the currently-visible section
 * via IntersectionObserver. Click a tab to scroll to its section.
 *
 * Sits below the search bar and above the chip bar so it follows the page on
 * long reports without colliding with the fixed-position drill panel.
 */
export function SectionNav({ sections }: SectionNavProps) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sections.length === 0) return;

    // Track which sections are visible. We pick the topmost one currently
    // intersecting the viewport (or the closest above) as the "active" tab.
    const visible = new Map<string, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry);
          } else {
            visible.delete(entry.target.id);
          }
        }
        if (visible.size === 0) return;
        // Pick the entry whose top is highest but not yet above the viewport.
        const sorted = [...visible.values()].sort((a, b) => {
          return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top);
        });
        const top = sorted[0];
        if (top) setActive(top.target.id);
      },
      {
        // Anchor 25% from top so the highlight matches the user's reading
        // gaze rather than flipping at the very top.
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0, 0.1, 0.5, 1],
      }
    );
    observerRef.current = observer;

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [sections]);

  // Auto-scroll the active tab into view inside the strip on mobile
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const tab = strip.querySelector<HTMLAnchorElement>(`[data-section-id="${active}"]`);
    if (!tab) return;
    const tabRect = tab.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    if (tabRect.left < stripRect.left || tabRect.right > stripRect.right) {
      tab.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }, [active]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    // Account for the sticky search bar (~64px) so the heading isn't hidden
    // behind it after scroll.
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
    setActive(id);
  };

  if (sections.length <= 1) return null;

  return (
    <nav
      aria-label="Sections"
      className="sticky top-[64px] z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 mb-4 backdrop-blur-md bg-ink/70"
    >
      <div
        ref={stripRef}
        className="flex items-center gap-1 overflow-x-auto py-2 hide-scrollbar"
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              data-section-id={s.id}
              onClick={(e) => handleClick(e, s.id)}
              className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                isActive
                  ? "border-coral/40 bg-coral/15 text-coral-100"
                  : "border-white/10 bg-white/[0.02] text-text-muted hover:text-text-primary hover:border-white/20"
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
