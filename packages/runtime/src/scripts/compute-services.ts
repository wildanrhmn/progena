import { loadConfig } from "../config.js";
import { connectBroker, listChatServices } from "../compute/index.js";
import { createLogger } from "../lib/logger.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });

  const ctx = await connectBroker({
    rpcUrl: config.rpcUrl,
    privateKey: config.genomeWriterPrivateKey,
    logger,
  });

  const services = await listChatServices(ctx);
  console.log(`Network: ${config.network} (${config.rpcUrl})`);
  console.log(`Operator: ${ctx.address}`);
  console.log("");
  console.log(`Services available: ${services.length}\n`);
  for (const s of services) {
    console.log(`  provider:    ${s.provider}`);
    console.log(`  model:       ${s.model}`);
    console.log(`  type:        ${s.serviceType || "(none)"}`);
    if (s.inputPrice) console.log(`  inputPrice:  ${s.inputPrice}`);
    if (s.outputPrice) console.log(`  outputPrice: ${s.outputPrice}`);
    if (s.url) console.log(`  url:         ${s.url}`);
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
