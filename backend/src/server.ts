import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OidcIdentityVerifier } from "./auth/identity.js";
import { loadConfig } from "./config/env.js";
import { createApp } from "./http/app.js";
import { createPostgresPool } from "./persistence/postgres.js";

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const pool = createPostgresPool(config);
  const app = await createApp(config, {
    db: pool,
    identityVerifier: new OidcIdentityVerifier(config.oidc),
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "Graceful shutdown started");
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    try {
      await app.close();
    } catch {
      process.exitCode = 1;
    } finally {
      try {
        await pool.end();
      } catch {
        process.exitCode = 1;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "Server failed to start",
    );
    await pool.end();
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  await startServer();
}
