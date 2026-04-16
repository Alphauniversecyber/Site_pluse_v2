"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type AdminActionButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  tone?: "primary" | "secondary";
  className?: string;
};

export function AdminActionButton({
  idleLabel,
  pendingLabel,
  tone = "primary",
  className
}: AdminActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed",
        tone === "primary"
          ? "border-[#1D4ED8] bg-[#172554] text-[#BFDBFE] hover:border-[#2563EB] hover:bg-[#1E3A8A] disabled:border-[#1E3A8A] disabled:bg-[#1E3A8A] disabled:text-white disabled:shadow-[0_0_0_2px_rgba(59,130,246,0.25)]"
          : "border-[#27272A] bg-[#111827] text-white hover:border-[#3F3F46] hover:bg-[#1F2937] disabled:border-[#3F3F46] disabled:bg-[#1F2937] disabled:text-[#E5E7EB] disabled:shadow-[0_0_0_2px_rgba(255,255,255,0.08)]",
        className
      )}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
