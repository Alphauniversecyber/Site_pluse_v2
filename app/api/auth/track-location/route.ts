import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserProfile } from "@/types";

export const runtime = "nodejs";

const LOCATION_REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

type LocationProfile = Pick<UserProfile, "id" | "located_at">;
type AdminMembership = {
  role: "admin";
};

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstForwardedIp = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const requestWithIp = request as NextRequest & { ip?: string | null };
  return requestWithIp.ip?.trim() || null;
}

function shouldRefreshLocation(locatedAt: string | null | undefined) {
  if (!locatedAt) {
    return true;
  }

  const locatedAtTime = new Date(locatedAt).getTime();
  if (Number.isNaN(locatedAtTime)) {
    return true;
  }

  return Date.now() - locatedAtTime >= LOCATION_REFRESH_INTERVAL_MS;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();

  try {
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: true });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, located_at")
      .eq("id", user.id)
      .maybeSingle<LocationProfile>();

    if (profileError || !profile) {
      if (profileError) {
        console.error("Track location: unable to load user profile.", profileError);
      }

      return NextResponse.json({ success: true });
    }

    const { data: adminMembership, error: membershipError } = await supabase
      .from("team_members")
      .select("role")
      .eq("member_user_id", user.id)
      .eq("status", "active")
      .eq("role", "admin")
      .maybeSingle<AdminMembership>();

    if (membershipError) {
      console.error("Track location: unable to verify admin membership.", membershipError);
      return NextResponse.json({ success: true });
    }

    if (adminMembership || !shouldRefreshLocation(profile.located_at)) {
      return NextResponse.json({ success: true });
    }

    const ipAddress = getClientIp(request);
    if (!ipAddress) {
      return NextResponse.json({ success: true });
    }

    const locationResponse = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=country,city,regionName,status`,
      {
        cache: "no-store"
      }
    );

    if (!locationResponse.ok) {
      console.error(
        `Track location: ip-api.com responded with ${locationResponse.status} for ${ipAddress}.`
      );
      return NextResponse.json({ success: true });
    }

    const locationPayload = (await locationResponse.json().catch(() => null)) as
      | {
          status?: string;
          country?: string;
          city?: string;
          regionName?: string;
        }
      | null;

    if (!locationPayload || locationPayload.status !== "success") {
      return NextResponse.json({ success: true });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        ip_address: ipAddress,
        country: locationPayload.country ?? null,
        city: locationPayload.city ?? null,
        region: locationPayload.regionName ?? null,
        located_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Track location: unable to save user location.", updateError);
    }
  } catch (error) {
    console.error("Track location: unexpected failure.", error);
  }

  return NextResponse.json({ success: true });
}
