"use client";

import { useCallback, useEffect, useState } from "react";

import type { UserProfile } from "@/types";
import { fetchJson } from "@/lib/api-client";

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJson<UserProfile>("/api/user/settings");
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load user.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    user,
    loading,
    error,
    refetch,
    setUser
  };
}
