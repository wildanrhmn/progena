import http from "node:http";
import { loadConfig } from "../config.js";
import {
  connectBroker,
  ensureLedger,
  ensureProviderFunded,
  listChatServices,
  pickChatService,
} from "../compute/index.js";
import { createLogger } from "../lib/logger.js";

const PORT = Number(process.env.PROXY_PORT ?? 8787);
const HOST = process.env.PROXY_HOST ?? "127.0.0.1";

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer | string) => {
      body += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function main() {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    bindings: { service: "openai-proxy", network: config.network },
  });

  const ctx = await connectBroker({
    rpcUrl: config.rpcUrl,
    privateKey: config.genomeWriterPrivateKey,
    logger,
  });
  await ensureLedger(ctx, config.zgComputeLedgerOg, logger);

  let providerAddress = config.zgComputeProvider as string | undefined;
  if (!providerAddress) {
    const services = await listChatServices(ctx);
    const picked = pickChatService(services);
    if (!picked) throw new Error("no chat provider available on 0G Compute");
    providerAddress = picked.provider;
  }
  await ensureProviderFunded(ctx, providerAddress, config.zgComputeProviderFundOg, logger);

  const meta = (await ctx.broker.inference.getServiceMetadata(providerAddress)) as {
    endpoint: string;
    model: string;
  };
  logger.info("proxy ready", {
    provider: providerAddress,
    endpoint: meta.endpoint,
    model: meta.model,
  });

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";

    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          provider: providerAddress,
          model: meta.model,
          endpoint: meta.endpoint,
        })
      );
      return;
    }

    if (url === "/v1/models" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          object: "list",
          data: [
            {
              id: meta.model,
              object: "model",
              created: 0,
              owned_by: "0g-compute",
            },
          ],
        })
      );
      return;
    }

    if (url === "/v1/chat/completions" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const json = JSON.parse(body) as {
          messages?: Array<{ role: string; content?: unknown }>;
          model?: string;
        };

        const prompt = (json.messages ?? [])
          .map((m) => (typeof m.content === "string" ? m.content : ""))
          .filter((s) => s.length > 0)
          .join("\n");

        const signedHeaders = (await ctx.broker.inference.getRequestHeaders(
          providerAddress!,
          prompt
        )) as unknown as Record<string, string>;

        const upstreamBody = JSON.stringify({ ...json, model: meta.model });

        const upstream = await fetch(`${meta.endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            ...signedHeaders,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: upstreamBody,
        });

        const responseBody = await upstream.text();

        try {
          const parsed = JSON.parse(responseBody) as {
            id?: string;
            choices?: Array<{
              message?: { content?: string | null; reasoning_content?: string | null };
            }>;
          };
          const choiceMessage = parsed.choices?.[0]?.message;
          const text =
            (choiceMessage?.content && choiceMessage.content.length > 0
              ? choiceMessage.content
              : choiceMessage?.reasoning_content) ?? "";
          if (parsed.id) {
            await ctx.broker.inference
              .processResponse(providerAddress!, parsed.id, text)
              .catch(() => {});
          }
        } catch {
          // body wasn't JSON; skip settlement
        }

        res.writeHead(upstream.status, { "Content-Type": "application/json" });
        res.end(responseBody);

        logger.info("proxied", {
          model: meta.model,
          status: upstream.status,
          promptChars: prompt.length,
          bodyBytes: responseBody.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("proxy error", { error: message });
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: { message, type: "proxy_error" },
          })
        );
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "not found", type: "not_found" } }));
  });

  server.listen(PORT, HOST, () => {
    logger.info("listening", { host: HOST, port: PORT });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
