import type { PublicClient } from "viem";
import { agentMetadataAbi, predictionRoundAbi } from "@progena/sdk";
import type { Tool, ToolResult } from "./types.js";

const TIMEOUT_MS = 20_000;

export interface FetchMarketStateOptions {
  publicClient: PublicClient;
  predictionRoundAddress: `0x${string}`;
  agentMetadataAddress: `0x${string}`;
}

export function createFetchMarketStateTool(opts: FetchMarketStateOptions): Tool {
  return {
    name: "fetch_market_state",
    description:
      "Read the current state of a Progena prediction round: deadlines, total pool size, commit/reveal counts, whether it's resolved, plus participating agents' trait JSON. Use this to understand the competitive landscape of the round you're playing.",
    parameters: {
      type: "object",
      properties: {
        roundId: {
          type: "string",
          description: "The roundId (integer as string, e.g. '3').",
        },
      },
      required: ["roundId"],
    },
    async execute(args, ctx): Promise<ToolResult> {
      let roundId: bigint;
      try {
        roundId = BigInt(String(args.roundId ?? ""));
      } catch {
        return { ok: false, summary: "invalid roundId", error: String(args.roundId) };
      }
      ctx.logger?.info?.("tool fetch_market_state", { roundId: String(roundId) });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const data = (await opts.publicClient.readContract({
          address: opts.predictionRoundAddress,
          abi: predictionRoundAbi,
          functionName: "roundOf",
          args: [roundId],
        })) as {
          questionHash: `0x${string}`;
          commitDeadline: bigint;
          revealDeadline: bigint;
          entryFee: bigint;
          totalPool: bigint;
          totalCommitted: bigint;
          totalRevealed: bigint;
          outcome: number;
          resolved: boolean;
        };

        const nowSec = Math.floor(Date.now() / 1000);
        const phase =
          data.resolved
            ? "resolved"
            : nowSec <= Number(data.commitDeadline)
              ? "commit_open"
              : nowSec <= Number(data.revealDeadline)
                ? "reveal_phase"
                : "awaiting_resolve";

        const summary = [
          `round #${roundId} phase=${phase}`,
          `commitDeadline=${new Date(Number(data.commitDeadline) * 1000).toISOString()}`,
          `revealDeadline=${new Date(Number(data.revealDeadline) * 1000).toISOString()}`,
          `entryFee=${data.entryFee.toString()} wei`,
          `totalPool=${data.totalPool.toString()} wei`,
          `totalCommitted=${data.totalCommitted.toString()} totalRevealed=${data.totalRevealed.toString()}`,
          data.resolved ? `outcome=${data.outcome} bps` : "outcome=pending",
        ].join("; ");

        return {
          ok: true,
          summary,
          data: {
            roundId: roundId.toString(),
            phase,
            questionHash: data.questionHash,
            commitDeadline: data.commitDeadline.toString(),
            revealDeadline: data.revealDeadline.toString(),
            entryFee: data.entryFee.toString(),
            totalPool: data.totalPool.toString(),
            totalCommitted: data.totalCommitted.toString(),
            totalRevealed: data.totalRevealed.toString(),
            outcome: data.outcome,
            resolved: data.resolved,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, summary: "fetch_market_state failed", error: message.split("\n")[0] };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
