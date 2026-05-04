"use client";

import { useState } from "react";

import { AdminBadge } from "@/components/admin/admin-badge";

type FailedTaskRow = {
  id: string;
  cronName: string;
  taskType: string;
  userId: string | null;
  userEmail: string;
  siteId: string | null;
  siteLabel: string;
  siteUrl: string;
  errorMessage: string;
  status: "failed" | "retried" | "resolved";
  createdAt: string;
  retriedAt: string | null;
  retryCount: number;
  resolvedAt: string | null;
};

function isRateLimitedError(errorMessage: string) {
  return /^rate-limited:\s*pagespeed$/i.test(errorMessage.trim());
}

function getStatusTone(status: FailedTaskRow["status"], errorMessage: string) {
  if (status !== "resolved" && isRateLimitedError(errorMessage)) {
    return "amber" as const;
  }

  if (status === "retried") {
    return "amber" as const;
  }

  if (status === "resolved") {
    return "green" as const;
  }

  return "red" as const;
}

function getStatusLabel(row: FailedTaskRow) {
  if (row.status !== "resolved" && isRateLimitedError(row.errorMessage)) {
    return "rate-limited";
  }

  if (row.status === "retried") {
    return "retrying";
  }

  return row.status;
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function truncateText(value: string, max = 140) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max).trimEnd()}...`;
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed.");
  }

  if (!payload?.data) {
    throw new Error("The server did not return any data.");
  }

  return payload.data;
}

function matchesStatusFilter(
  row: FailedTaskRow,
  statusFilter: "open" | "all" | FailedTaskRow["status"]
) {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "open") {
    return row.status === "failed" || row.status === "retried";
  }

  return row.status === statusFilter;
}

export function FailedTasksTable({
  initialRows,
  statusFilter
}: {
  initialRows: FailedTaskRow[];
  statusFilter: "open" | "all" | FailedTaskRow["status"];
}) {
  const [rows, setRows] = useState(initialRows);
  const [pendingById, setPendingById] = useState<Record<string, "retry" | "resolve" | undefined>>({});
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string | undefined>>({});

  async function handleRetry(taskId: string) {
    setPendingById((current) => ({ ...current, [taskId]: "retry" }));
    setErrorById((current) => ({ ...current, [taskId]: undefined }));

    try {
      const result = await postJson<{
        task: {
          id: string;
          status: FailedTaskRow["status"];
          retried_at: string | null;
          retry_count: number;
          resolved_at: string | null;
        };
      }>("/api/admin/retry-task", { taskId });

      setRows((current) => {
        const nextRows = current
          .map((row) =>
            row.id === taskId
              ? {
                  ...row,
                  status: result.task.status,
                  retriedAt: result.task.retried_at,
                  retryCount: result.task.retry_count,
                  resolvedAt: result.task.resolved_at
                }
              : row
          )
          .filter((row) => matchesStatusFilter(row, statusFilter));

        return nextRows;
      });
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [taskId]: error instanceof Error ? error.message : "Unable to retry task."
      }));
    } finally {
      setPendingById((current) => ({ ...current, [taskId]: undefined }));
    }
  }

  async function handleResolve(taskId: string) {
    setPendingById((current) => ({ ...current, [taskId]: "resolve" }));
    setErrorById((current) => ({ ...current, [taskId]: undefined }));

    try {
      const result = await postJson<{
        task: {
          id: string;
          status: FailedTaskRow["status"];
          resolved_at: string | null;
        };
      }>("/api/admin/failed-tasks/resolve", { taskId });

      setRows((current) => {
        const nextRows = current
          .map((row) =>
            row.id === taskId
              ? {
                  ...row,
                  status: result.task.status,
                  resolvedAt: result.task.resolved_at
                }
              : row
          )
          .filter((row) => matchesStatusFilter(row, statusFilter));

        return nextRows;
      });
    } catch (error) {
      setErrorById((current) => ({
        ...current,
        [taskId]: error instanceof Error ? error.message : "Unable to resolve task."
      }));
    } finally {
      setPendingById((current) => ({ ...current, [taskId]: undefined }));
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#0D0D0D] text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Task Type</th>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Site</th>
            <th className="px-4 py-3 font-medium">Error Message</th>
            <th className="px-4 py-3 font-medium">Failed At</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isExpanded = Boolean(expandedById[row.id]);
            const isLongError = row.errorMessage.length > 140;
            const pendingAction = pendingById[row.id];
            const displayStatusLabel = getStatusLabel(row);
            const isRateLimited = displayStatusLabel === "rate-limited";

            return (
              <tr key={row.id} className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} align-top hover:bg-[#181818]`}>
                <td className="px-4 py-4">
                  <p className="font-medium text-white">{row.taskType}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-500">{row.cronName}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="break-all font-medium text-white">{row.userEmail}</p>
                  {row.userId ? <p className="mt-1 font-mono text-xs text-zinc-500">{row.userId}</p> : null}
                </td>
                <td className="px-4 py-4 text-zinc-300">
                  <p className="font-medium text-white">{row.siteLabel}</p>
                  {row.siteUrl ? <p className="mt-1 break-all text-xs text-zinc-500">{row.siteUrl}</p> : null}
                </td>
                <td className="px-4 py-4 text-zinc-300">
                  <p title={row.errorMessage} className="leading-6">
                    {isExpanded ? row.errorMessage : truncateText(row.errorMessage)}
                  </p>
                  {isLongError ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedById((current) => ({
                          ...current,
                          [row.id]: !current[row.id]
                        }))
                      }
                      className="mt-2 text-xs font-medium text-[#93C5FD] hover:text-white"
                    >
                      {isExpanded ? "Show less" : "Show full"}
                    </button>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <p className="font-mono text-xs text-zinc-400">{formatDate(row.createdAt)}</p>
                  {row.retriedAt ? (
                    <p className="mt-2 font-mono text-xs text-zinc-500">Retried {formatDate(row.retriedAt)}</p>
                  ) : null}
                  {row.resolvedAt ? (
                    <p className="mt-2 font-mono text-xs text-[#86EFAC]">Resolved {formatDate(row.resolvedAt)}</p>
                  ) : null}
                  {row.retryCount > 0 ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {row.retryCount} retry{row.retryCount === 1 ? "" : "ies"}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <span
                    title={
                      isRateLimited
                        ? "Site will be retried automatically after cooldown."
                        : undefined
                    }
                  >
                    <AdminBadge label={displayStatusLabel} tone={getStatusTone(row.status, row.errorMessage)} />
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={row.status === "resolved" || Boolean(pendingAction)}
                      onClick={() => handleRetry(row.id)}
                      className="rounded-full border border-[#1D4ED8] bg-[#172554] px-3 py-2 text-xs font-medium text-[#BFDBFE] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingAction === "retry" ? "Retrying..." : "Retry"}
                    </button>
                    <button
                      type="button"
                      disabled={row.status === "resolved" || Boolean(pendingAction)}
                      onClick={() => handleResolve(row.id)}
                      className="rounded-full border border-[#27272A] bg-[#111827] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingAction === "resolve" ? "Saving..." : "Mark Resolved"}
                    </button>
                    {errorById[row.id] ? (
                      <p className="max-w-[18rem] text-xs leading-5 text-[#FCA5A5]">{errorById[row.id]}</p>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
