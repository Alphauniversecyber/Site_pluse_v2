"use client";

import { useCallback, useEffect, useState } from "react";

import type { Website } from "@/types";
import { fetchJson } from "@/lib/api-client";

interface UseWebsitesOptions {
  view?: "full" | "summary";
}

export function useWebsites(options?: UseWebsitesOptions) {
  const view = options?.view ?? "full";
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<Website[]>(
        view === "summary" ? "/api/websites?view=summary" : "/api/websites"
      );
      setWebsites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load websites.");
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    websites,
    loading,
    error,
    refetch,
    setWebsites
  };
}
