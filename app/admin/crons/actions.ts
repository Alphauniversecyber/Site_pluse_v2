"use server";

import { redirect } from "next/navigation";

import { requireAdminPageAccess } from "@/lib/admin/auth";
import { ADMIN_CRON_NAMES, type AdminCronName } from "@/lib/admin/constants";
import { triggerAdminCron } from "@/lib/admin/data";

export async function runAdminCronAction(formData: FormData) {
  requireAdminPageAccess();

  const cronName = String(formData.get("cronName") ?? "");
  let target = "/admin/crons";

  if (!ADMIN_CRON_NAMES.includes(cronName as AdminCronName)) {
    target = "/admin/crons?status=failed&message=Invalid+cron+name.";
    redirect(target);
  }

  try {
    const result = await triggerAdminCron(cronName as AdminCronName);
    const query = new URLSearchParams({
      run: cronName,
      status: result.ok ? "success" : "failed",
      message: result.message
    });

    target = `/admin/crons?${query.toString()}`;
  } catch (error) {
    const query = new URLSearchParams({
      run: cronName,
      status: "failed",
      message: error instanceof Error ? error.message : "Unable to trigger cron."
    });

    target = `/admin/crons?${query.toString()}`;
  }

  redirect(target);
}
