"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_VERSION, APP_VERSION_TITLE } from "@/lib/version";
import {
  Ship,
  Receipt,
  Rocket,
  Plus,
  ChevronDown,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { AgentRosterDrawer } from "@/components/agents/AgentRosterDrawer";

export type WorkspaceId = "trade" | "factoring" | "startups";

interface WorkspaceConfig {
  id: WorkspaceId;
  label: string;
  shortLabel: string;
  icon: typeof Ship;
  dealsHref: string;
  dealsLabel: string;
  directoryHref: string;
  directoryLabel: string;
  reconHref: string;
  reconLabel: string;
  exportHref: string;
  exportLabel: string;
  newDealHref: string;
  color: string;
  tagline: string;
}

const WORKSPACES: Record<WorkspaceId, WorkspaceConfig> = {
  trade: {
    id: "trade",
    label: "Trade Finance",
    shortLabel: "Trade",
    icon: Ship,
    dealsHref: "/trade-deals",
    dealsLabel: "Trade Deals",
    directoryHref: "/trade-funders",
    directoryLabel: "Trade Funders",
    reconHref: "/research?workspace=trade",
    reconLabel: "Trade Funder Recon",
    exportHref: "/export?workspace=trade",
    exportLabel: "Trade Export Pack",
    newDealHref: "/trade-deals/new",
    color: "#ff6b4a",
    tagline: "Commodity Corridors & Bilateral SPAs",
  },
  factoring: {
    id: "factoring",
    label: "Invoice Factoring",
    shortLabel: "Factoring",
    icon: Receipt,
    dealsHref: "/deals",
    dealsLabel: "Factoring Deals",
    directoryHref: "/providers",
    directoryLabel: "Invoice Providers",
    reconHref: "/research?workspace=factoring",
    reconLabel: "Provider Recon",
    exportHref: "/export?workspace=factoring",
    exportLabel: "Factoring Export Pack",
    newDealHref: "/deals/new",
    color: "#3b82f6",
    tagline: "Receivables & Working Capital",
  },
  startups: {
    id: "startups",
    label: "Startup Hub",
    shortLabel: "Startups",
    icon: Rocket,
    dealsHref: "/vc-deals",
    dealsLabel: "Startup Deals",
    directoryHref: "/vc-investors",
    directoryLabel: "VC Investors",
    reconHref: "/research?workspace=startups",
    reconLabel: "Startup & VC Recon",
    exportHref: "/export?workspace=startups",
    exportLabel: "Startup Export Pack",
    newDealHref: "/vc-deals/new",
    color: "#a855f7",
    tagline: "Capital, ICP Buyers & Strategic Partners",
  },
};

function detectWorkspaceFromPath(pathname: string): WorkspaceId | null {
  if (pathname.startsWith("/trade-")) return "trade";
  if (pathname.startsWith("/vc-")) return "startups";
  if (pathname.startsWith("/deals") || pathname.startsWith("/providers")) return "factoring";
  return null;
}

export function GlobalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [persistedWs, setPersistedWs] = useState<WorkspaceId>("startups");

  // Hydrate workspace from URL query param or cookie when on shared routes (/research, /export)
  useEffect(() => {
    const pathWs = detectWorkspaceFromPath(pathname);
    if (pathWs) {
      setPersistedWs(pathWs);
      document.cookie = `tr3_last_workspace=${pathWs}; path=/; max-age=31536000; SameSite=Lax`;
      return;
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryWs = params.get("workspace") as WorkspaceId | null;
      if (queryWs && WORKSPACES[queryWs]) {
        setPersistedWs(queryWs);
        document.cookie = `tr3_last_workspace=${queryWs}; path=/; max-age=31536000; SameSite=Lax`;
        return;
      }

      const cookieMatch = document.cookie.match(/(?:^|;\s*)tr3_last_workspace=(trade|factoring|startups)/);
      if (cookieMatch && cookieMatch[1]) {
        setPersistedWs(cookieMatch[1] as WorkspaceId);
      }
    }
  }, [pathname]);

  const activeWorkspaceId: WorkspaceId = detectWorkspaceFromPath(pathname) ?? persistedWs;
  const activeWs = WORKSPACES[activeWorkspaceId];

  const handleSelectWorkspace = (wsId: WorkspaceId) => {
    setIsSwitcherOpen(false);
    setPersistedWs(wsId);
    if (typeof document !== "undefined") {
      document.cookie = `tr3_last_workspace=${wsId}; path=/; max-age=31536000; SameSite=Lax`;
    }
    if (pathname.startsWith("/research")) {
      router.push(WORKSPACES[wsId].reconHref);
    } else if (pathname.startsWith("/export")) {
      router.push(WORKSPACES[wsId].exportHref);
    } else {
      router.push(WORKSPACES[wsId].dealsHref);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-[#2a3052] bg-white/95 dark:bg-[#151829]/95 backdrop-blur-md transition-colors">
        {/* Top Tier: Brand, Switcher, Omni-controls */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
          {/* Brand Anchor + Workspace Dropdown */}
          <div className="flex items-center gap-4">
            <Link href={activeWs.dealsHref} className="flex items-center gap-2 group">
              <span className="text-lg font-black tracking-wider text-[#1a1f3a] dark:text-white">
                TRADE<span className="text-[#ff6b4a]">3</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 border-l border-neutral-300 dark:border-neutral-700 pl-2">
                Capital Sourcing
              </span>
              <span
                className="rounded-full bg-[#1a1f3a] px-2 py-0.5 font-mono text-[10px] font-bold text-[#10b981] border border-[#10b981]/30"
                title={APP_VERSION_TITLE}
              >
                {APP_VERSION}
              </span>
            </Link>

            {/* Workspace Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className="flex items-center gap-2 rounded-lg bg-neutral-100 hover:bg-neutral-200/70 dark:bg-[#1a1f3a] dark:hover:bg-[#222744] px-3 py-1.5 text-xs font-semibold text-[#1a1f3a] dark:text-white border border-neutral-200 dark:border-[#2a3052] transition-colors cursor-pointer"
              >
                <activeWs.icon className="h-4 w-4 text-[#ff6b4a]" />
                <span>{activeWs.label}</span>
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>

              {isSwitcherOpen && (
                <div
                  className="absolute left-0 mt-2 w-72 rounded-xl bg-white dark:bg-[#1a1f3a] border border-neutral-200 dark:border-[#2a3052] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onMouseLeave={() => setIsSwitcherOpen(false)}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-3 py-1.5">
                    Switch Asset Class Workspace
                  </div>
                  {Object.values(WORKSPACES).map((ws) => {
                    const isCurrent = ws.id === activeWorkspaceId;
                    const IconComponent = ws.icon;
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => handleSelectWorkspace(ws.id)}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? "bg-[#ff6b4a]/10 text-[#ff6b4a] dark:bg-[#ff6b4a]/15"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-md mt-0.5 ${
                            isCurrent
                              ? "bg-[#ff6b4a] text-white"
                              : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs">{ws.label}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-[#ff6b4a] uppercase">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                            {ws.tagline}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Navigation Controls: Agents Pill, Tools & New Deal CTA */}
          <div className="flex items-center gap-3">
            {/* Japanese Agent Collective Trigger Pill */}
            <button
              type="button"
              onClick={() => setIsAgentDrawerOpen(true)}
              className="flex items-center gap-2 rounded-full px-3 py-1 bg-[#1a1f3a] text-white dark:bg-[#222744] dark:text-white border border-[#2a3052] hover:border-[#ff6b4a]/50 text-xs font-medium transition-all shadow-xs cursor-pointer group"
            >
              <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
              <span className="font-semibold group-hover:text-[#ff8566] transition-colors">
                7 Japanese Agents
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-neutral-300">
                湊 · 誠 · 大輝
              </span>
            </button>

            {/* Quick Lock / Logout Button */}
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
                router.push("/login");
                router.refresh();
              }}
              title="Lock platform session (Google Chat OTP)"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-200 dark:border-[#2a3052] bg-neutral-100 hover:bg-neutral-200/70 dark:bg-[#1a1f3a] dark:hover:bg-[#222744] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>

            {/* Contextual New Deal CTA */}
            <Link href={activeWs.newDealHref}>
              <Button size="sm" variant="coral" className="text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>New {activeWs.shortLabel} Deal</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Bottom Tier: Contextual Asset-Isolated Sub-Nav */}
        <div className="border-t border-neutral-100 dark:border-[#2a3052]/50 bg-neutral-50/70 dark:bg-[#111422]/60 px-6 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between text-xs">
            {/* Primary Asset-Class Scoped Navigation Links */}
            <nav className="flex items-center gap-1.5 font-medium">
              <span className="mr-1.5 inline-flex items-center gap-1 rounded-md bg-neutral-200/70 dark:bg-[#1a1f3a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                <activeWs.icon className="h-3 w-3 text-[#ff6b4a]" />
                {activeWs.label}
              </span>

              <Link
                href={activeWs.dealsHref}
                onClick={() => setPersistedWs(activeWorkspaceId)}
                className={`rounded-md px-3 py-1 transition-all ${
                  pathname === activeWs.dealsHref ||
                  (pathname.startsWith(activeWs.dealsHref) && !pathname.includes("/new"))
                    ? "bg-white text-[#1a1f3a] font-bold shadow-xs dark:bg-[#1a1f3a] dark:text-white border border-neutral-200 dark:border-[#2a3052]"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {activeWs.dealsLabel}
              </Link>

              <Link
                href={activeWs.directoryHref}
                onClick={() => setPersistedWs(activeWorkspaceId)}
                className={`rounded-md px-3 py-1 transition-all ${
                  pathname.startsWith(activeWs.directoryHref)
                    ? "bg-white text-[#1a1f3a] font-bold shadow-xs dark:bg-[#1a1f3a] dark:text-white border border-neutral-200 dark:border-[#2a3052]"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {activeWs.directoryLabel}
              </Link>

              <div className="h-3.5 w-[1px] bg-neutral-300 dark:bg-neutral-700 mx-1.5" />

              {/* Asset-Class Scoped Recon & Export */}
              <Link
                href={activeWs.reconHref}
                onClick={() => setPersistedWs(activeWorkspaceId)}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  pathname.startsWith("/research")
                    ? "bg-white text-[#1a1f3a] font-bold shadow-xs dark:bg-[#1a1f3a] dark:text-white border border-neutral-200 dark:border-[#2a3052]"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {activeWs.reconLabel}
              </Link>

              <Link
                href={activeWs.exportHref}
                onClick={() => setPersistedWs(activeWorkspaceId)}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  pathname.startsWith("/export")
                    ? "bg-white text-[#1a1f3a] font-bold shadow-xs dark:bg-[#1a1f3a] dark:text-white border border-neutral-200 dark:border-[#2a3052]"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {activeWs.exportLabel}
              </Link>
            </nav>

            {/* Current Workspace Tagline Indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-neutral-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b4a]" />
              <span>Asset Class: {activeWs.label} — {activeWs.tagline}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-over Japanese Agent Collective Drawer */}
      <AgentRosterDrawer
        isOpen={isAgentDrawerOpen}
        onClose={() => setIsAgentDrawerOpen(false)}
      />
    </>
  );
}
