"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
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
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
