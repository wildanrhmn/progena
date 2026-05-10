import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/hero";
import { FoundersStrip } from "@/components/home/founders-strip";
import { HowItWorks } from "@/components/home/how-it-works";
import { StatsBanner } from "@/components/home/stats-banner";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <FoundersStrip />
        <HowItWorks />
        <StatsBanner />
      </main>
      <SiteFooter />
    </>
  );
}
