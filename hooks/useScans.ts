"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "@/lib/api-client";

export interface ScanHistoryItem {
  id: string;
  website_id: string;
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  best_practices_score: number;
  accessibility_violations?: Array<Record<string, unknown>>;
  scanned_at: string;
}

interface ScanListResponse {
  scans: ScanHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function useScans(websiteId?: string, page = 1, pageSize = 10) {
  const [data, setData] = useState<ScanListResponse>({
    scans: [],
    total: 0,
    page,
    pageSize
  });
  const [loading, setLoading] = useState(Boolean(websiteId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!websiteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchJson<ScanListResponse>(
        `/api/websites/${websiteId}/scans?page=${page}&pageSize=${pageSize}`
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load scans.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, websiteId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    ...data,
    loading,
    error,
    refetch
  };
}
