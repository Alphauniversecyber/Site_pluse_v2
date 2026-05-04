"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "@/lib/api-client";
import type { WorkspaceFeaturesResponse } from "@/types";

export function useWorkspaceFeatures() {
  const [data, setData] = useState<WorkspaceFeaturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await fetchJson<WorkspaceFeaturesResponse>("/api/workspace/features");
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspace features.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    data,
    loading,
    error,
    refetch
  };
}
