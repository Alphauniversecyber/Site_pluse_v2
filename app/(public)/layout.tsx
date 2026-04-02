import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
