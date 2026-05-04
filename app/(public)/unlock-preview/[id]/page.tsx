import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { claimPreviewScanSession } from "@/lib/preview-scan";
import { getCurrentUserProfile } from "@/lib/supabase-server";

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: "Unlock Your Free SEO Audit Report",
    description:
      "Unlock your SitePulse preview report to claim a free SEO audit and continue into the full client-ready dashboard experience.",
    alternates: {
      canonical: `https://trysitepulse.com/unlock-preview/${params.id}`
    },
    robots: {
      index: false,
      follow: false
    }
  };
}

export default async function UnlockPreviewPage({ params }: { params: { id: string } }) {
  const nextPath = `/unlock-preview/${params.id}`;
  const { user } = await getCurrentUserProfile();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  try {
    const result = await claimPreviewScanSession({
      sessionId: params.id,
      userId: user.id
    });

    redirect(`/dashboard/websites/${result.websiteId}?fromPreview=1`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't unlock that preview. Run a fresh scan and try again.";

    return (
      <>
        <BreadcrumbJsonLd
          items={[
            { name: "Home", item: "https://trysitepulse.com" },
            { name: "Unlock Preview", item: `https://trysitepulse.com/unlock-preview/${params.id}` }
          ]}
        />
        <main className="container flex min-h-[calc(100vh-12rem)] items-center justify-center py-16">
          <Card className="w-full max-w-2xl rounded-[2rem]">
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Preview unlock</p>
              <CardTitle className="font-display text-3xl">We couldn&apos;t unlock that report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm leading-7 text-muted-foreground">{message}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/">Run a fresh free scan</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/websites">Open dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }
}
