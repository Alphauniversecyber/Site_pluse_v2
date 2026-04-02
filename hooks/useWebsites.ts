"use client";

import { useCallback, useEffect, useState } from "react";

import type { Website } from "@/types";
import { fetchJson } from "@/lib/api-client";

export function useWebsites() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<Website[]>("/api/websites");
      setWebsites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load websites.");
    } finally {
      setLoading(false);
    }
  }, []);

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
