import { NextResponse } from "next/server";

import { apiError, requireApiUser } from "@/lib/api";
import { ACTIVE_WORKSPACE_COOKIE, resolveWorkspaceContext } from "@/lib/workspace";
import { workspaceSwitchSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = workspaceSwitchSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid workspace switch payload.", 422);
  }

  const workspace = await resolveWorkspaceContext(profile);
  const candidate = workspace.availableWorkspaces.find(
    (item) => item.ownerUserId === parsed.data.ownerUserId
  );

  if (!candidate) {
    return apiError("You do not have access to that workspace.", 403);
  }

  const response = NextResponse.json(
    {
      data: {
        ownerUserId: candidate.ownerUserId
      }
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );

  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, candidate.ownerUserId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
