"use client";

import { createContext, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { fetchJson } from "@/lib/api-client";
import type { WorkspaceClientState } from "@/types";

type WorkspaceContextValue = WorkspaceClientState & {
  isOwner: boolean;
  isSwitching: boolean;
  switchWorkspace: (ownerUserId: string) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  initialState,
  children
}: {
  initialState: WorkspaceClientState;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [isSwitching, startTransition] = useTransition();

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...state,
      isOwner: state.activeWorkspace.isOwner,
      isSwitching,
      switchWorkspace(ownerUserId: string) {
        if (ownerUserId === state.activeWorkspace.ownerUserId) {
          return;
        }

        startTransition(async () => {
          try {
            await fetchJson<{ ownerUserId: string }>("/api/workspace/active", {
              method: "POST",
              body: JSON.stringify({ ownerUserId })
            });

            const nextWorkspace =
              state.workspaces.find((workspace) => workspace.ownerUserId === ownerUserId) ??
              state.activeWorkspace;

            setState((current) => ({
              ...current,
              activeWorkspace: nextWorkspace
            }));
            router.refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to switch workspaces.");
          }
        });
      }
    }),
    [isSwitching, router, state]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
