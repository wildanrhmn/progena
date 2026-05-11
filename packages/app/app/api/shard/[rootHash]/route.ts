import { NextResponse } from "next/server";
import { createZgStorageBackend, StorageNotFoundError } from "@progena/sdk/node";
import { INDEXER_URL, RPC_URL } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

type Params = { params: Promise<{ rootHash: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { rootHash } = await params;

  if (!ROOT_HASH_REGEX.test(rootHash)) {
    return NextResponse.json(
      { error: "invalid rootHash format" },
      { status: 400 }
    );
  }

  try {
    const backend = createZgStorageBackend({
      rpcUrl: RPC_URL,
      indexerUrl: INDEXER_URL,
    });
    const bytes = await backend.download(rootHash as `0x${string}`);
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text) as unknown;
    return NextResponse.json(parsed, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (err instanceof StorageNotFoundError) {
      return NextResponse.json(
        { error: "shard not found on 0G Storage" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `failed to download shard: ${message}` },
      { status: 502 }
    );
  }
}
