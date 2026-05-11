import { NextResponse } from "next/server";
import { createPublicClient, getContract, http } from "viem";
import {
  agentGenomeAbi,
  GenomeStorage,
  zgGalileo,
  zgMainnet,
} from "@progena/sdk";
import { createZgStorageBackend, StorageNotFoundError } from "@progena/sdk/node";
import { ADDRESSES, INDEXER_URL, NETWORK_NAME, RPC_URL } from "@/lib/chain";
import { buildTraitsFromGenome, serializeTraits } from "@/lib/traits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type Params = { params: Promise<{ tokenId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { tokenId } = await params;
  let id: bigint;
  try {
    id = BigInt(tokenId);
  } catch {
    return NextResponse.json({ error: "invalid tokenId" }, { status: 400 });
  }

  const chain = NETWORK_NAME === "mainnet" ? zgMainnet : zgGalileo;
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const genome = getContract({
    address: ADDRESSES.agentGenome,
    abi: agentGenomeAbi,
    client: { public: publicClient },
  });

  let rootHash: `0x${string}`;
  try {
    rootHash = (await genome.read.rootHashOf([id])) as `0x${string}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `rootHashOf reverted: ${message}` },
      { status: 404 }
    );
  }

  if (!rootHash || rootHash === ZERO_HASH) {
    return NextResponse.json(
      { error: "agent not finalized yet — daemon has not set rootHash" },
      { status: 409 }
    );
  }

  try {
    const backend = createZgStorageBackend({
      rpcUrl: RPC_URL,
      indexerUrl: INDEXER_URL,
    });
    const storage = new GenomeStorage(backend);
    const genomeData = await storage.downloadGenome(rootHash);
    const traits = buildTraitsFromGenome(genomeData);
    const traitsJson = serializeTraits(traits);
    return NextResponse.json(
      { traits, traitsJson, rootHash },
      {
        headers: {
          "cache-control": "public, max-age=300",
        },
      }
    );
  } catch (err) {
    if (err instanceof StorageNotFoundError) {
      return NextResponse.json(
        {
          error:
            "genome blob not found on 0G Storage — phantom finalize artifact",
        },
        { status: 410 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `failed to derive traits: ${message}` },
      { status: 502 }
    );
  }
}
