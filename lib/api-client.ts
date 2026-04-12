"use client";

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const method =
    init?.method ??
    (typeof Request !== "undefined" && input instanceof Request ? input.method : undefined) ??
    "GET";
  const normalizedMethod = method.toUpperCase();

  const response = await fetch(input, {
    ...(init?.cache === undefined && (normalizedMethod === "GET" || normalizedMethod === "HEAD")
      ? { cache: "no-store" as const }
      : {}),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload.data as T;
}
