import { ethers } from "ethers";
import { loadConfig } from "../config.js";
import {
  connectBroker,
  ensureLedger,
  ensureProviderFunded,
  complete,
  listChatServices,
  pickChatService,
} from "../compute/index.js";
import { createLogger } from "../lib/logger.js";

const PROMPT =
  "In exactly one sentence, describe what makes an autonomous AI agent valuable as on-chain breedable property.";

async function main() {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });

  const ctx = await connectBroker({
    rpcUrl: config.rpcUrl,
    privateKey: config.genomeWriterPrivateKey,
    logger,
  });

  console.log("");
  console.log(`Network:  ${config.network}`);
  console.log(`RPC:      ${config.rpcUrl}`);
  console.log(`Operator: ${ctx.address}`);
  const bal = await ctx.provider.getBalance(ctx.address);
  console.log(`Balance:  ${ethers.formatEther(bal)} OG`);
  console.log("");

  // 1. Ledger
  const ledgerResult = await ensureLedger(ctx, config.zgComputeLedgerOg, logger);
  if (ledgerResult.created) console.log("→ ledger created");
  else if (ledgerResult.toppedUp) console.log("→ ledger topped up");
  else console.log("→ ledger already funded");

  // 2. Pick a provider (config override or auto-pick)
  let providerAddress = config.zgComputeProvider;
  if (!providerAddress) {
    console.log("→ no ZG_COMPUTE_PROVIDER set, listing services…");
    const services = await listChatServices(ctx);
    const picked = pickChatService(services);
    if (!picked) {
      throw new Error(
        `no chat service found; available: ${services.length}. Run \`npm run compute:services\` to inspect.`
      );
    }
    providerAddress = picked.provider as `0x${string}`;
    console.log(`→ auto-picked provider ${providerAddress} model=${picked.model}`);
  } else {
    console.log(`→ using configured provider ${providerAddress}`);
  }

  // 3. Acknowledge + fund
  await ensureProviderFunded(ctx, providerAddress, config.zgComputeProviderFundOg, logger);

  // 4. Inference
  console.log("");
  console.log("Prompt:");
  console.log(`  ${PROMPT}`);
  console.log("");

  const startedAt = Date.now();
  const result = await complete(
    ctx,
    {
      providerAddress,
      messages: [
        { role: "system", content: "You are concise and precise." },
        { role: "user", content: PROMPT },
      ],
      temperature: 0.5,
      maxTokens: 200,
    },
    logger
  );

  const elapsedMs = Date.now() - startedAt;

  console.log("Response:");
  console.log(`  ${result.text.trim()}`);
  console.log("");
  console.log(`Model:       ${result.model}`);
  console.log(`Completion:  ${result.completionId}`);
  console.log(`Elapsed:     ${elapsedMs}ms`);
  if (result.usage) {
    console.log(
      `Tokens:      ${result.usage.promptTokens} in · ${result.usage.completionTokens} out · ${result.usage.totalTokens} total`
    );
  }
}

main().catch((err) => {
  console.error("compute-hello failed");
  console.error(err);
  process.exit(1);
});
