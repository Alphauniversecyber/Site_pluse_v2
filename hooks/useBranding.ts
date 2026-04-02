"use client";

import { useCallback, useEffect, useState } from "react";

import type { AgencyBranding } from "@/types";
import { fetchJson } from "@/lib/api-client";

export function useBranding() {
  const [branding, setBranding] = useState<AgencyBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<AgencyBranding | null>("/api/branding");
      setBranding(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load branding.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    branding,
    loading,
    error,
    refetch,
    setBranding
  };
}
