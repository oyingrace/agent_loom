import "dotenv/config";
import { createApp, shutdown } from "./server";

const webAppUrl = (
  process.env.WEB_APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const rawPublic =
  process.env.MCP_PUBLIC_URL ?? process.env.MCP_SERVER_BASE_URL ?? "";
const mcpPublicUrl = rawPublic.replace(/\/$/, "") || null;

const port = Number(
  process.env.MCP_SERVER_PORT ?? process.env.PORT ?? 3001
);

const app = createApp({ webAppUrl, mcpPublicUrl });

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`mcp-server listening on http://0.0.0.0:${port}`);
  console.log(`  Web app URL: ${webAppUrl}`);
  console.log(
    `  MCP public URL: ${mcpPublicUrl ?? "(from Host / X-Forwarded-*)"}`
  );
});

const gracefulShutdown = async (signal: string) => {
  console.log(`mcp-server received ${signal}, shutting down...`);
  await shutdown();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
