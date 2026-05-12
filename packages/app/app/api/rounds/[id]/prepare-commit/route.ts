import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAEMON_URL = process.env.RUNTIME_API_URL ?? "http://127.0.0.1:8788";

type Params = { params: Promise<{ id: string }> };

interface PrepareBody {
  agentId?: string;
  ownerAddress?: string;
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  let body: PrepareBody;
  try {
    body = (await req.json()) as PrepareBody;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!body.agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  let roundIdBig: bigint;
  let agentIdBig: bigint;
  try {
    roundIdBig = BigInt(id);
    agentIdBig = BigInt(body.agentId);
    if (roundIdBig <= 0n || agentIdBig <= 0n) throw new Error("ids must be > 0");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid ids" },
      { status: 400 }
    );
  }

  const token = process.env.RUNTIME_API_TOKEN;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const upstream = await fetch(`${DAEMON_URL}/prepare-commit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        roundId: roundIdBig.toString(),
        agentId: agentIdBig.toString(),
        ownerAddress: body.ownerAddress,
      }),
    });
    const text = await upstream.text();
    let payload: unknown = null;
    try {
      payload = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      payload = { error: "daemon returned non-json", raw: text.slice(0, 200) };
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `daemon unreachable: ${message}` },
      { status: 502 }
    );
  }
}
