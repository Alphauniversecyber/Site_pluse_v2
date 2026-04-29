"use server";

import { redirect } from "next/navigation";

import { requireAdminPageAccess } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminUserActionResult = {
  ok: boolean;
  message: string;
};

function buildRedirectUrl(formData: FormData, result: AdminUserActionResult) {
  const params = new URLSearchParams();
  const page = String(formData.get("page") ?? "").trim();
  const search = String(formData.get("search") ?? "").trim();
  const filter = String(formData.get("filter") ?? "").trim();
  const sort = String(formData.get("sort") ?? "").trim();

  if (page) params.set("page", page);
  if (search) params.set("search", search);
  if (filter) params.set("filter", filter);
  if (sort) params.set("sort", sort);

  params.set("actionStatus", result.ok ? "success" : "failed");
  params.set("actionMessage", result.message);

  return `/admin/users?${params.toString()}`;
}

async function getUserEmail(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data?.email ?? null;
}

async function listStoragePaths(bucket: string, prefix: string) {
  const admin = createSupabaseAdminClient();
  const paths: string[] = [];
  const stack = [prefix.replace(/\/+$/, "")];

  while (stack.length) {
    const current = stack.pop() as string;
    const { data, error } = await admin.storage.from(bucket).list(current, {
      limit: 1000
    });

    if (error) {
      continue;
    }

    for (const item of data ?? []) {
      const path = `${current}/${item.name}`;
      if (item.metadata === null) {
        stack.push(path);
      } else {
        paths.push(path);
      }
    }
  }

  return paths;
}

async function removeUserStorageFiles(userId: string, reportPaths: string[]) {
  const admin = createSupabaseAdminClient();
  const uniqueReportPaths = Array.from(new Set(reportPaths.filter(Boolean)));

  if (uniqueReportPaths.length) {
    await admin.storage.from("reports").remove(uniqueReportPaths);
  }

  for (const bucket of ["profile-assets", "branding-assets"]) {
    const paths = await listStoragePaths(bucket, userId);
    if (paths.length) {
      await admin.storage.from(bucket).remove(paths);
    }
  }
}

async function deleteRows(table: string, column: string, values: string[]) {
  if (!values.length) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from(table).delete().in(column, values);

  if (error) {
    throw new Error(error.message);
  }
}

async function deleteRowsByUser(table: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from(table).delete().eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function disableAdminUserAccount(userId: string) {
  const admin = createSupabaseAdminClient();
  const disabledAt = new Date().toISOString();

  const { error: userError } = await admin
    .from("users")
    .update({
      plan: "free",
      subscription_status: "suspended",
      subscription_price: null,
      next_billing_date: null,
      is_trial: false,
      trial_ends_at: disabledAt,
      trial_end_date: disabledAt
    })
    .eq("id", userId);

  if (userError) {
    throw new Error(userError.message);
  }

  const { error: websiteError } = await admin
    .from("websites")
    .update({
      is_active: false,
      auto_email_reports: false,
      email_notifications: false,
      report_frequency: "never"
    })
    .eq("user_id", userId);

  if (websiteError) {
    throw new Error(websiteError.message);
  }

  await Promise.all([
    admin
      .from("scan_job_queue")
      .update({
        status: "skipped",
        failure_reason: "account_ineligible",
        last_error: "User was disabled by an admin."
      })
      .eq("user_id", userId)
      .in("status", ["pending", "processing", "failed"]),
    admin
      .from("report_email_queue")
      .update({
        status: "skipped",
        failure_reason: "account_ineligible",
        last_error: "User was disabled by an admin."
      })
      .eq("user_id", userId)
      .in("status", ["pending", "processing", "failed"])
  ]);

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h"
  });

  if (authError) {
    throw new Error(authError.message);
  }
}

export async function deleteAdminUserAccount(userId: string) {
  const admin = createSupabaseAdminClient();

  const { data: user } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string }>();
  const email = user?.email ?? null;

  const { data: websites, error: websitesError } = await admin
    .from("websites")
    .select("id")
    .eq("user_id", userId);

  if (websitesError) {
    throw new Error(websitesError.message);
  }

  const websiteIds = ((websites ?? []) as Array<{ id: string }>).map((row) => row.id);
  const { data: reports, error: reportsError } = websiteIds.length
    ? await admin.from("reports").select("pdf_url").in("website_id", websiteIds)
    : { data: [], error: null };

  if (reportsError) {
    throw new Error(reportsError.message);
  }

  await removeUserStorageFiles(
    userId,
    ((reports ?? []) as Array<{ pdf_url: string | null }>).map((row) => row.pdf_url ?? "")
  );

  await Promise.all([
    deleteRowsByUser("email_logs", userId),
    deleteRowsByUser("admin_error_logs", userId),
    deleteRowsByUser("payment_logs", userId),
    deleteRowsByUser("scan_logs", userId),
    deleteRowsByUser("report_email_queue", userId),
    deleteRowsByUser("scan_job_queue", userId),
    deleteRowsByUser("notifications", userId),
    deleteRows("email_logs", "website_id", websiteIds),
    deleteRows("admin_error_logs", "website_id", websiteIds),
    deleteRows("scan_logs", "website_id", websiteIds)
  ]);

  if (email) {
    const { error: paymentEmailError } = await admin
      .from("payment_logs")
      .delete()
      .eq("user_email", email);

    if (paymentEmailError) {
      throw new Error(paymentEmailError.message);
    }
  }

  await Promise.all([
    admin
      .from("preview_scan_sessions")
      .delete()
      .or(
        [
          `claimed_by_user_id.eq.${userId}`,
          ...websiteIds.map((id) => `claimed_website_id.eq.${id}`)
        ].join(",")
      ),
    admin.from("team_members").delete().eq("member_user_id", userId)
  ]);

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
  if (deleteAuthError && !deleteAuthError.message.toLowerCase().includes("user not found")) {
    throw new Error(deleteAuthError.message);
  }

  const { error: deletePublicError } = await admin.from("users").delete().eq("id", userId);
  if (deletePublicError) {
    throw new Error(deletePublicError.message);
  }
}

export async function runAdminUserAction(formData: FormData) {
  requireAdminPageAccess();

  const actionType = String(formData.get("actionType") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const confirmation = String(formData.get("confirmation") ?? "").trim().toUpperCase();
  let result: AdminUserActionResult;

  try {
    if (!userId) {
      throw new Error("Missing user id.");
    }

    const email = await getUserEmail(userId);

    if (actionType === "disable") {
      await disableAdminUserAccount(userId);
      result = {
        ok: true,
        message: `Disabled ${email ?? userId}.`
      };
    } else if (actionType === "delete") {
      if (confirmation !== "DELETE") {
        throw new Error("Type DELETE to confirm permanent user deletion.");
      }

      await deleteAdminUserAccount(userId);
      result = {
        ok: true,
        message: `Deleted ${email ?? userId} and all related database/storage data.`
      };
    } else {
      throw new Error("Unknown user action.");
    }
  } catch (error) {
    result = {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update user."
    };
  }

  redirect(buildRedirectUrl(formData, result));
}
