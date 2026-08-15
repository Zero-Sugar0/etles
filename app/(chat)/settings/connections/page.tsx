"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoaderIcon } from "@/components/icons";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ConnectedAccount = { id: string; alias?: string };
type Toolkit = {
  slug: string;
  name: string;
  logo?: string;
  isConnected: boolean;
  connectedAccountId?: string;
  connectedAccounts?: ConnectedAccount[];
};

const ITEMS_PER_PAGE = 24;

export default function ConnectionsPage() {
  const [toolkits, setToolkits] = useState<Toolkit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "connected">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch connections");
      }
      setToolkits(data.toolkits || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load connections"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter]);

  const filteredToolkits = useMemo(
    () =>
      toolkits.filter((toolkit) => {
        const matchesSearch = toolkit.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        return matchesSearch && (filter === "all" || toolkit.isConnected);
      }),
    [toolkits, searchQuery, filter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredToolkits.length / ITEMS_PER_PAGE)
  );
  const paginatedToolkits = filteredToolkits.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const connectedCount = toolkits.filter(
    (toolkit) => toolkit.isConnected
  ).length;

  async function handleConnect(slug: string) {
    setIsActionLoading(slug);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || "No redirect URL received");
      }
      window.location.href = data.redirectUrl;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to connect ${slug}`
      );
      setIsActionLoading(null);
    }
  }

  async function handleDisconnect(slug: string, connectedAccountId?: string) {
    if (!connectedAccountId) {
      return;
    }
    setIsActionLoading(slug);
    try {
      const res = await fetch("/api/connections/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectedAccountId }),
      });
      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }
      toast.success(`Disconnected from ${slug}`);
      await fetchConnections();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disconnect"
      );
    } finally {
      setIsActionLoading(null);
    }
  }

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-5 sm:px-7 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-border/60 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SidebarToggle />
              <Button
                aria-label="Go back"
                className="size-8 rounded-lg"
                onClick={() => router.back()}
                size="icon"
                variant="ghost"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Workspace
                </p>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Connections
                </h1>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <ShieldCheck className="size-4 text-emerald-500" /> Secure OAuth
              connections
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {(["all", "connected"] as const).map((value) => (
                <button
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    filter === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {value === "all"
                    ? "All"
                    : `Connected ${connectedCount ? `(${connectedCount})` : ""}`}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search connections"
                className="h-10 rounded-lg border-border/70 bg-background pl-9 text-sm"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search connections"
                value={searchQuery}
              />
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <LoaderIcon className="size-8 animate-spin" />
            <p className="text-sm">Loading connections...</p>
          </div>
        ) : filteredToolkits.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
            <Search className="size-8 text-muted-foreground" />
            <h2 className="font-semibold">No connections found</h2>
            <p className="text-sm text-muted-foreground">
              Try another search or switch back to all connections.
            </p>
          </div>
        ) : (
          <>
            <section
              aria-label="Available connections"
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {paginatedToolkits.map((toolkit) => {
                  const accounts = toolkit.connectedAccounts ?? [];
                  const busy = isActionLoading === toolkit.slug;
                  return (
                    <motion.article
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex min-h-[82px] items-center justify-between gap-4 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                      exit={{ opacity: 0, y: 8 }}
                      initial={{ opacity: 0, y: 8 }}
                      key={toolkit.slug}
                      layout
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/40 p-2">
                          <Image
                            alt={`${toolkit.name} logo`}
                            className="size-full object-contain"
                            height={44}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                            src={toolkit.logo || `/logos/${toolkit.slug}.svg`}
                            unoptimized
                            width={44}
                          />
                          <span className="sr-only">{toolkit.name} logo</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h2 className="truncate text-sm font-semibold">
                              {toolkit.name}
                            </h2>
                            {toolkit.isConnected && (
                              <Check className="size-4 shrink-0 text-emerald-500" />
                            )}
                          </div>
                          {toolkit.isConnected ? (
                            <p className="truncate text-xs text-emerald-600 dark:text-emerald-400">
                              {accounts.length > 1
                                ? `${accounts.length} active accounts`
                                : "Active"}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Not connected
                            </p>
                          )}
                        </div>
                      </div>
                      {toolkit.isConnected ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            className="h-8 rounded-md px-2.5 text-xs"
                            disabled={busy}
                            onClick={() => handleConnect(toolkit.slug)}
                            variant="outline"
                          >
                            {busy ? (
                              <LoaderIcon className="size-3 animate-spin" />
                            ) : (
                              "+ New"
                            )}
                          </Button>
                          <Button
                            aria-label={`Disconnect ${toolkit.name}`}
                            className="size-8 rounded-md text-muted-foreground hover:text-destructive"
                            disabled={busy}
                            onClick={() =>
                              handleDisconnect(
                                toolkit.slug,
                                toolkit.connectedAccountId
                              )
                            }
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground shadow-sm"
                          disabled={busy}
                          onClick={() => handleConnect(toolkit.slug)}
                        >
                          {busy ? (
                            <LoaderIcon className="size-3 animate-spin" />
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      )}
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </section>
            {totalPages > 1 && (
              <nav
                aria-label="Connections pagination"
                className="flex items-center justify-center gap-3 border-t border-border/60 pt-5"
              >
                <Button
                  aria-label="Previous page"
                  className="size-8"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  size="icon"
                  variant="outline"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  aria-label="Next page"
                  className="size-8"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  size="icon"
                  variant="outline"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
