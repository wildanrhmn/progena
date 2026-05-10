import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/hero";
import { StatsBanner } from "@/components/home/stats-banner";
import { FoundersStrip } from "@/components/home/founders-strip";
import { HowItWorks } from "@/components/home/how-it-works";
import { LiveActivityFeed } from "@/components/home/live-activity-feed";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <StatsBanner />
        <FoundersStrip />
        <HowItWorks />
        <LiveActivityFeed />
      </main>
      <SiteFooter />
    </>
  );
}
