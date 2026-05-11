import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreedWizard } from "@/components/breed/breed-wizard";

type SearchParams = { parentA?: string };

export default async function BreedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  let initialParentA: bigint | undefined;
  if (sp.parentA) {
    try {
      const id = BigInt(sp.parentA);
      if (id > 0n) initialParentA = id;
    } catch {
      // ignore invalid query
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pt-28 pb-24 sm:pt-32">
        <BreedWizard initialParentA={initialParentA} />
      </main>
      <SiteFooter />
    </>
  );
}
