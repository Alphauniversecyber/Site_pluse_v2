"use client";

import { useCallback, useEffect, useState } from "react";

import type { UserProfile } from "@/types";
import { fetchJson } from "@/lib/api-client";

let inFlightUserRequest: Promise<UserProfile | null> | null = null;

async function loadCurrentUser() {
  if (!inFlightUserRequest) {
    inFlightUserRequest = fetchJson<UserProfile>("/api/user/settings")
      .then((data) => data)
      .catch((error) => {
        if (error instanceof Error && error.message === "Unauthorized") {
          return null;
        }

        throw error;
      })
      .finally(() => {
        inFlightUserRequest = null;
      });
  }

  return inFlightUserRequest;
}

export function useUser(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await loadCurrentUser();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load user.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return {
    user,
    loading,
    error,
    refetch,
    setUser
  };
}
