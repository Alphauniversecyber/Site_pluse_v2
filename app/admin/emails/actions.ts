"use server";

import { redirect } from "next/navigation";

import { requireAdminPageAccess } from "@/lib/admin/auth";
import { sendAdminWebsiteReport, runAdminWebsiteScan } from "@/lib/admin/email-recovery";

function buildRedirectUrl(formData: FormData, input: {
  actionType: string;
  status: "success" | "failed";
  message: string;
}) {
  const params = new URLSearchParams();
  const page = String(formData.get("page") ?? "").trim();
  const monitorUser = String(formData.get("monitorUser") ?? "").trim();
  const monitorStatus = String(formData.get("monitorStatus") ?? "").trim();
  const monitorDate = String(formData.get("monitorDate") ?? "").trim();

  if (page) {
    params.set("page", page);
  }

  if (monitorUser) {
    params.set("monitorUser", monitorUser);
  }

  if (monitorStatus && monitorStatus !== "all") {
    params.set("monitorStatus", monitorStatus);
  }

  if (monitorDate) {
    params.set("monitorDate", monitorDate);
  }

  params.set("actionType", input.actionType);
  params.set("actionStatus", input.status);
  params.set("actionMessage", input.message);

  return `/admin/emails?${params.toString()}`;
}

export async function runAdminEmailRecoveryAction(formData: FormData) {
  requireAdminPageAccess();

  const actionType = String(formData.get("actionType") ?? "").trim();
  const websiteId = String(formData.get("websiteId") ?? "").trim();

  if (!websiteId) {
    redirect(
      buildRedirectUrl(formData, {
        actionType,
        status: "failed",
        message: "Missing website id."
      })
    );
  }

  try {
    if (actionType === "send-report") {
      const result = await sendAdminWebsiteReport(websiteId);
      const deliveries = result.delivery.deliveries.length;
      const skipped = result.delivery.skippedRecipients.length;
      const message =
        deliveries > 0
          ? `Manual report send completed for ${result.website.label}. Delivered to ${deliveries} recipient(s)${skipped ? `, skipped ${skipped}.` : "."}`
          : `Manual report send ran for ${result.website.label}, but every recipient was skipped by duplicate protection.`;

      redirect(
        buildRedirectUrl(formData, {
          actionType,
          status: "success",
          message
        })
      );
    }

    if (actionType === "run-scan") {
      const result = await runAdminWebsiteScan(websiteId);
      redirect(
        buildRedirectUrl(formData, {
          actionType,
          status: "success",
          message: `Manual scan completed for ${result.website.label} with status ${result.scan.scan_status ?? "success"}.`
        })
      );
    }

    redirect(
      buildRedirectUrl(formData, {
        actionType,
        status: "failed",
        message: "Unknown recovery action."
      })
    );
  } catch (error) {
    redirect(
      buildRedirectUrl(formData, {
        actionType,
        status: "failed",
        message: error instanceof Error ? error.message : "Unable to run admin recovery action."
      })
    );
  }
}
