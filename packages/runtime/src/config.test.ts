import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "./config.js";

const VALID_ADDRESS = "0xCe2AA403276D01919295823237123C0ac47A24e2";
const VALID_KEY = `0x${"a".repeat(64)}`;

function baseEnv(): NodeJS.ProcessEnv {
  return {
    ZG_NETWORK: "galileo",
    ZG_RPC_URL: "https://evmrpc-testnet.0g.ai",
    ZG_INDEXER_URL: "https://indexer-storage-turbo.0g.ai",
    PROGENA_AGENT_GENOME: VALID_ADDRESS,
    PROGENA_BREEDING_CONTRACT: VALID_ADDRESS,
    PROGENA_ROYALTY_SPLITTER: VALID_ADDRESS,
    PROGENA_REPUTATION_ORACLE: VALID_ADDRESS,
    PROGENA_PREDICTION_ROUND: VALID_ADDRESS,
    PROGENA_AGENT_MEMORY: VALID_ADDRESS,
    GENOME_WRITER_PRIVATE_KEY: VALID_KEY,
  };
}

describe("loadConfig", () => {
  it("loads a minimal valid environment with defaults applied", () => {
    const config = loadConfig(baseEnv());
    expect(config.network).toEqual("galileo");
    expect(config.indexerPollMs).toEqual(4000);
    expect(config.logLevel).toEqual("info");
    expect(config.reporterPrivateKey).toBeUndefined();
    expect(config.zgComputeBaseUrl).toBeUndefined();
  });

  it("coerces INDEXER_POLL_MS from a string", () => {
    const config = loadConfig({ ...baseEnv(), INDEXER_POLL_MS: "2500" });
    expect(config.indexerPollMs).toEqual(2500);
  });

  it("treats an empty REPORTER_PRIVATE_KEY as omitted", () => {
    const config = loadConfig({ ...baseEnv(), REPORTER_PRIVATE_KEY: "" });
    expect(config.reporterPrivateKey).toBeUndefined();
  });

  it("rejects an invalid RPC URL", () => {
    expect(() => loadConfig({ ...baseEnv(), ZG_RPC_URL: "not-a-url" })).toThrow(ConfigError);
  });

  it("rejects an unknown network", () => {
    expect(() => loadConfig({ ...baseEnv(), ZG_NETWORK: "ropsten" })).toThrow(ConfigError);
  });

  it("rejects a malformed contract address", () => {
    expect(() =>
      loadConfig({ ...baseEnv(), PROGENA_AGENT_GENOME: "0xnope" })
    ).toThrow(/expected a 0x-prefixed 20-byte hex address/);
  });

  it("rejects a malformed private key", () => {
    expect(() =>
      loadConfig({ ...baseEnv(), GENOME_WRITER_PRIVATE_KEY: "0x123" })
    ).toThrow(/expected a 0x-prefixed 32-byte hex private key/);
  });

  it("aggregates multiple issues into a single ConfigError", () => {
    try {
      loadConfig({ ...baseEnv(), ZG_RPC_URL: "x", ZG_NETWORK: "x" });
      expect.fail("expected ConfigError");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).issues?.length ?? 0).toBeGreaterThan(1);
    }
  });

  it("accepts an optional reporter key when present and valid", () => {
    const config = loadConfig({
      ...baseEnv(),
      REPORTER_PRIVATE_KEY: `0x${"b".repeat(64)}`,
    });
    expect(config.reporterPrivateKey).toEqual(`0x${"b".repeat(64)}`);
  });
});
