import { apiSuccess } from "@/lib/api";
import { getBillingPlans } from "@/lib/billing-config";

export const runtime = "nodejs";

export async function GET() {
  return apiSuccess(await getBillingPlans());
}
