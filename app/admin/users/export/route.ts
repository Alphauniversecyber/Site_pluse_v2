import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getAdminUsersData } from "@/lib/admin/data";
import { buildCsv, formatAdminDate } from "@/lib/admin/format";

export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const url = new URL(request.url);
  const data = await getAdminUsersData({
    search: url.searchParams.get("search") ?? "",
    filter: url.searchParams.get("filter") ?? "all",
    sort: url.searchParams.get("sort") ?? "newest",
    exportAll: true
  });

  const csv = buildCsv([
    ["Email", "Name", "Plan", "Status", "Trial Ends", "Websites", "Joined", "Last Active"],
    ...data.rows.map((row) => [
      row.email,
      row.name,
      row.planLabel,
      row.state,
      row.trialEndsAt ? formatAdminDate(row.trialEndsAt) : "N/A",
      String(row.websitesCount),
      formatAdminDate(row.joinedAt),
      row.lastActiveAt ? formatAdminDate(row.lastActiveAt) : "N/A"
    ])
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sitepulse-admin-users.csv"'
    }
  });
}
