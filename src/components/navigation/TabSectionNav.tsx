"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ChevronDown, Layers } from "lucide-react";

export interface TabSectionItem {
  id: string; // Target DOM element ID
  label: string;
  icon?: ReactNode;
  count?: number;
  badgeText?: string;
  badgeTone?: "green" | "blue" | "amber" | "red" | "neutral" | "purple";
  isWarning?: boolean;
}

export interface TabSectionNavProps {
  sections: TabSectionItem[];
  activeSectionId?: string;
}

export function scrollToSectionWithHighlight(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "start" });

  // Apply attention ring-pulse
  el.classList.add("ring-2", "ring-blue-500", "ring-offset-4", "transition-all", "duration-500");
  setTimeout(() => {
    el.classList.remove("ring-2", "ring-blue-500", "ring-offset-4");
  }, 2200);
}

export function TabSectionNav({ sections }: TabSectionNavProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id || "");
  const [hasOverflowBelow, setHasOverflowBelow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Check which section is in view
      const scrollPos = window.scrollY + 220;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveId(sections[i].id);
          break;
        }
      }

      // Check if there is content remaining below viewport
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const currentScroll = window.scrollY;
      setHasOverflowBelow(documentHeight - (currentScroll + windowHeight) > 250);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  if (sections.length <= 1) return null;

  return (
    <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50/80 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/60 shadow-2xs backdrop-blur-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 font-medium">
          <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px] text-neutral-700 dark:text-neutral-300">
            Sections on this page ({sections.length}):
          </span>
        </div>

        {/* Section Quick Jump Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {sections.map((sec, idx) => {
            const isActive = activeId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSectionWithHighlight(sec.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-2xs dark:bg-blue-600"
                    : "bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200/80 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700"
                }`}
              >
                {sec.icon && <span className="shrink-0">{sec.icon}</span>}
                <span>
                  {idx + 1}. {sec.label}
                </span>

                {sec.count !== undefined && sec.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : sec.isWarning
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {sec.count}
                  </span>
                )}

                {sec.badgeText && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                      isActive ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {sec.badgeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* More below indicator */}
        <div className="hidden lg:flex items-center gap-1 text-[11px] text-neutral-400">
          <span>↓ Scroll to view all sections</span>
        </div>
      </div>
    </div>
  );
}

export function CardNextSectionCue({
  nextSectionId,
  nextSectionLabel,
}: {
  nextSectionId: string;
  nextSectionLabel: string;
}) {
  return (
    <div className="flex justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
      <button
        type="button"
        onClick={() => scrollToSectionWithHighlight(nextSectionId)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer group"
      >
        <span>Next section below: <strong>{nextSectionLabel}</strong></span>
        <ArrowDown className="h-3 w-3 group-hover:translate-y-0.5 transition-transform" />
      </button>
    </div>
  );
}
