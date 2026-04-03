"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function LogoutButton({
  iconOnly = false,
  className
}: {
  iconOnly?: boolean;
  className?: string;
} = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      className={cn(
        iconOnly &&
          "header-action-button motion-safe:hover:scale-100 motion-safe:active:scale-100",
        className
      )}
      aria-label={iconOnly ? "Logout" : undefined}
      title={iconOnly ? "Logout" : undefined}
      onClick={() =>
        startTransition(async () => {
          const supabase = createSupabaseBrowserClient();
          const { error } = await supabase.auth.signOut();

          if (error) {
            toast.error(error.message);
            return;
          }

          toast.success("Signed out.");
          router.push("/login");
          router.refresh();
        })
      }
      disabled={isPending}
    >
      <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} />
      {iconOnly ? <span className="sr-only">Logout</span> : "Logout"}
    </Button>
  );
}
