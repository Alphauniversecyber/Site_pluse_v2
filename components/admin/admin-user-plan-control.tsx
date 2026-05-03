"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/api-client";
import {
  getAdminCurrentPlanBadgeVariant,
  getAdminCurrentPlanLabel,
  getAdminOverrideSelectionFromCurrentPlan,
  type AdminPlanOverrideValue
} from "@/lib/admin/user-plan";
import type { BillingCycle, PlanKey, SubscriptionStatus } from "@/types";

type AdminUserPlanControlProps = {
  userId: string;
  plan: PlanKey;
  billingCycle: BillingCycle | null;
  planOverride: boolean;
  planOverrideCountsAsRevenue: boolean;
};

type AdminUserPlanUpdateResponse = {
  userId: string;
  plan: PlanKey;
  billingCycle: BillingCycle | null;
  currentPlanLabel: string;
  selectedPlan: AdminPlanOverrideValue | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPrice: number | null;
  planOverride: boolean;
  planOverrideCountsAsRevenue: boolean;
  revenueEntryCreated: boolean;
};

const PLAN_OPTIONS: Array<{ value: AdminPlanOverrideValue; label: string }> = [
  { value: "free", label: "Free" },
  { value: "pro_monthly", label: "Pro Monthly" },
  { value: "pro_yearly", label: "Pro Yearly" }
];

export function AdminUserPlanControl({
  userId,
  plan: initialPlan,
  billingCycle: initialBillingCycle,
  planOverride: initialPlanOverride,
  planOverrideCountsAsRevenue: initialPlanOverrideCountsAsRevenue
}: AdminUserPlanControlProps) {
  const [currentPlan, setCurrentPlan] = useState<PlanKey>(initialPlan);
  const [currentBillingCycle, setCurrentBillingCycle] = useState<BillingCycle | null>(initialBillingCycle);
  const [planOverride, setPlanOverride] = useState(initialPlanOverride);
  const [planOverrideCountsAsRevenue, setPlanOverrideCountsAsRevenue] = useState(
    initialPlanOverrideCountsAsRevenue
  );
  const [selectedPlan, setSelectedPlan] = useState<AdminPlanOverrideValue | "">(
    getAdminOverrideSelectionFromCurrentPlan(initialPlan, initialBillingCycle) ?? ""
  );
  const [countAsRevenue, setCountAsRevenue] = useState(
    initialPlanOverrideCountsAsRevenue &&
      getAdminOverrideSelectionFromCurrentPlan(initialPlan, initialBillingCycle) !== "free"
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);

  const currentPlanLabel = useMemo(
    () => getAdminCurrentPlanLabel(currentPlan, currentBillingCycle),
    [currentPlan, currentBillingCycle]
  );
  const currentSelectedPlan = useMemo(
    () => getAdminOverrideSelectionFromCurrentPlan(currentPlan, currentBillingCycle),
    [currentPlan, currentBillingCycle]
  );
  const showRevenueControls = selectedPlan !== "" && selectedPlan !== "free";
  const isLegacyGrowthPlan = currentPlan === "starter";
  const hasPendingChanges =
    selectedPlan !== "" &&
    (selectedPlan !== currentSelectedPlan ||
      (showRevenueControls && countAsRevenue !== planOverrideCountsAsRevenue) ||
      note.trim().length > 0);

  async function handleSave() {
    if (!selectedPlan) {
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    setStatusTone(null);

    try {
      const response = await fetchJson<AdminUserPlanUpdateResponse>("/api/admin/update-user-plan", {
        method: "POST",
        body: JSON.stringify({
          userId,
          plan: selectedPlan,
          countAsRevenue: showRevenueControls ? countAsRevenue : false,
          note: note.trim() || undefined
        })
      });

      setCurrentPlan(response.plan);
      setCurrentBillingCycle(response.billingCycle);
      setPlanOverride(response.planOverride);
      setPlanOverrideCountsAsRevenue(response.planOverrideCountsAsRevenue);
      setSelectedPlan(response.selectedPlan ?? "");
      setCountAsRevenue(response.planOverrideCountsAsRevenue);
      setNote("");
      setStatusTone("success");
      setStatusMessage(
        response.revenueEntryCreated
          ? `Saved ${response.currentPlanLabel} and counted it as revenue.`
          : `Saved ${response.currentPlanLabel}.`
      );
      toast.success(
        response.revenueEntryCreated
          ? "User plan updated and revenue entry recorded."
          : "User plan updated."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the user plan.";
      setStatusTone("error");
      setStatusMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#232323] bg-[#0D0D0D] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={getAdminCurrentPlanBadgeVariant(currentPlan, currentBillingCycle)}>
          {currentPlanLabel}
        </Badge>
        {planOverride ? (
          <Badge variant={planOverrideCountsAsRevenue ? "success" : "secondary"}>
            Manual override
          </Badge>
        ) : null}
      </div>

      {isLegacyGrowthPlan ? (
        <p className="text-xs text-zinc-500">
          This account is currently on the legacy Growth tier. The override selector below only targets
          Free, Pro Monthly, and Pro Yearly.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`plan-override-${userId}`} className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Override plan
        </Label>
        <Select
          value={selectedPlan || undefined}
          onValueChange={(value) => {
            const nextValue = value as AdminPlanOverrideValue;
            setSelectedPlan(nextValue);
            if (nextValue === "free") {
              setCountAsRevenue(false);
              setNote("");
            }
          }}
        >
          <SelectTrigger
            id={`plan-override-${userId}`}
            className="h-10 border-[#2A2A2A] bg-[#111111] text-white"
          >
            <SelectValue placeholder="Select a plan override" />
          </SelectTrigger>
          <SelectContent className="border-[#2A2A2A] bg-[#111111] text-white">
            {PLAN_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="focus:bg-[#1B1B1B] focus:text-white"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showRevenueControls ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-white">Count as Revenue</p>
              <p className="text-xs text-zinc-500">
                Record this manual override in admin revenue tracking.
              </p>
            </div>
            <Switch checked={countAsRevenue} onCheckedChange={setCountAsRevenue} />
          </div>

          {countAsRevenue ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`plan-note-${userId}`} className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Admin note
              </Label>
              <Textarea
                id={`plan-note-${userId}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Paid via bank transfer, manual comp, offline invoice, etc."
                className="min-h-[96px] border-[#2A2A2A] bg-[#0B0B0B] text-white"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void handleSave();
          }}
          disabled={!hasPendingChanges || saving}
        >
          {saving ? "Updating..." : "Update Plan"}
        </Button>

        {statusMessage ? (
          <p className={statusTone === "error" ? "text-sm text-rose-300" : "text-sm text-emerald-300"}>
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
