import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgentDetail } from "@/components/agent/agent-detail";

type Params = { id: string };

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  let agentId: bigint | null = null;
  try {
    agentId = BigInt(id);
    if (agentId < 1n) agentId = null;
  } catch {
    agentId = null;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pt-28 pb-24 sm:pt-32">
        {agentId === null ? (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
            <div className="mb-1 text-sm font-medium text-foreground">
              Invalid agent id
            </div>
            <p className="text-xs text-muted-foreground">
              "{id}" is not a valid token id.
            </p>
          </div>
        ) : (
          <AgentDetail agentId={agentId} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
