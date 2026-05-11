import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RoundDetail } from "@/components/round/round-detail";

type Params = { id: string };

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  let roundId: bigint | null = null;
  try {
    roundId = BigInt(id);
    if (roundId < 1n) roundId = null;
  } catch {
    roundId = null;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pt-28 pb-24 sm:pt-32">
        {roundId === null ? (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
            <div className="mb-1 text-sm font-medium text-foreground">
              Invalid round id
            </div>
            <p className="text-xs text-muted-foreground">
              "{id}" is not a valid round id.
            </p>
          </div>
        ) : (
          <RoundDetail roundId={roundId} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
