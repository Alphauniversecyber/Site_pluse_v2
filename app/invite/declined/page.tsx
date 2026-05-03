import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DeclinedInvitePage({
  searchParams
}: {
  searchParams: { state?: string };
}) {
  const isInvalid = searchParams.state === "invalid";

  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{isInvalid ? "Invitation unavailable" : "Invitation declined"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {isInvalid
              ? "This invitation is no longer valid or has already been used."
              : "You have declined the SitePulse workspace invitation."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">Return home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Login to SitePulse</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
