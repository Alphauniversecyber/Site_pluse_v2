"use server";

import { redirect } from "next/navigation";

import { requireAdminPageAccess } from "@/lib/admin/auth";
import { ADMIN_CRON_NAMES, type AdminCronName } from "@/lib/admin/constants";
import { triggerAdminCron } from "@/lib/admin/data";

export async function runAdminCronAction(formData: FormData) {
  requireAdminPageAccess();

  const cronName = String(formData.get("cronName") ?? "");

  if (!ADMIN_CRON_NAMES.includes(cronName as AdminCronName)) {
    redirect("/admin/crons?status=failed&message=Invalid+cron+name.");
  }

  try {
    const result = await triggerAdminCron(cronName as AdminCronName);
    const query = new URLSearchParams({
      run: cronName,
      status: result.ok ? "success" : "failed",
      message: result.message
    });

    redirect(`/admin/crons?${query.toString()}`);
  } catch (error) {
    const query = new URLSearchParams({
      run: cronName,
      status: "failed",
      message: error instanceof Error ? error.message : "Unable to trigger cron."
    });

    redirect(`/admin/crons?${query.toString()}`);
  }
}
