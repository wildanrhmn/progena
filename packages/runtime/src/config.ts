import "dotenv/config";
import type { Address, Hex } from "viem";
import { z } from "zod";

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

const addressSchema = z
  .string()
  .regex(ADDRESS_REGEX, "expected a 0x-prefixed 20-byte hex address")
  .transform((s) => s as Address);

const privateKeySchema = z
  .string()
  .regex(PRIVATE_KEY_REGEX, "expected a 0x-prefixed 32-byte hex private key")
  .transform((s) => s as Hex);

const networkSchema = z.enum(["galileo", "mainnet"]);
const logLevelSchema = z.enum(["trace", "debug", "info", "warn", "error"]);

export const configSchema = z.object({
  network: networkSchema,
  rpcUrl: z.string().url(),
  indexerUrl: z.string().url(),
  addresses: z.object({
    agentGenome: addressSchema,
    breedingContract: addressSchema,
    royaltySplitter: addressSchema,
    reputationOracle: addressSchema,
    predictionRound: addressSchema,
    agentMemory: addressSchema,
  }),
  genomeWriterPrivateKey: privateKeySchema,
  reporterPrivateKey: privateKeySchema.optional(),
  zgComputeBaseUrl: z.string().url().optional(),
  zgComputeToken: z.string().optional(),
  indexerPollMs: z.coerce.number().int().positive().default(4000),
  logLevel: logLevelSchema.default("info"),
});

export type Config = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  constructor(message: string, public readonly issues?: z.ZodIssue[]) {
    super(message);
    this.name = "ConfigError";
  }
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse({
    network: env.ZG_NETWORK,
    rpcUrl: env.ZG_RPC_URL,
    indexerUrl: env.ZG_INDEXER_URL,
    addresses: {
      agentGenome: env.PROGENA_AGENT_GENOME,
      breedingContract: env.PROGENA_BREEDING_CONTRACT,
      royaltySplitter: env.PROGENA_ROYALTY_SPLITTER,
      reputationOracle: env.PROGENA_REPUTATION_ORACLE,
      predictionRound: env.PROGENA_PREDICTION_ROUND,
      agentMemory: env.PROGENA_AGENT_MEMORY,
    },
    genomeWriterPrivateKey: env.GENOME_WRITER_PRIVATE_KEY,
    reporterPrivateKey: emptyToUndefined(env.REPORTER_PRIVATE_KEY),
    zgComputeBaseUrl: emptyToUndefined(env.ZG_COMPUTE_BASE_URL),
    zgComputeToken: emptyToUndefined(env.ZG_COMPUTE_TOKEN),
    indexerPollMs: env.INDEXER_POLL_MS,
    logLevel: env.LOG_LEVEL,
  });

  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ConfigError(`invalid runtime config: ${summary}`, parsed.error.issues);
  }

  return parsed.data;
}
