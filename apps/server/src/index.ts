import http from "node:http";
import express from "express";
import cors from "cors";
import pino from "pino";
import { env, loadSectorsConfig } from "./config.js";
import { Store } from "./store.js";
import { MockFeed } from "./feed/mock.js";
import { LsFeed } from "./feed/ls.js";
import { attachWsHub } from "./ws-hub.js";

type Feed = { start: () => void | Promise<void>; stop: () => void };

const log = pino({
  transport: { target: "pino-pretty", options: { colorize: true } },
});

async function main() {
  const cfg = loadSectorsConfig();
  const store = new Store(cfg.sectors);

  const app = express();
  app.use(cors({ origin: env.allowedOrigin }));
  app.use(express.json());

  const server = http.createServer(app);
  const hub = attachWsHub(server, store, log);

  let lsConnected = false;

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      lsConnected,
      clients: hub.clientCount(),
      ts: Date.now(),
    });
  });

  app.get("/api/sectors", (_req, res) => {
    res.json({ sectors: store.getSectors() });
  });

  app.get("/api/snapshot", (_req, res) => {
    res.json(hub.snapshot());
  });

  let feed: Feed;
  if (env.useLs) {
    feed = new LsFeed(store, cfg.sectors, cfg.names, log, env.ls);
    try {
      await feed.start();
      lsConnected = true;
    } catch (err) {
      log.error({ err }, "LS feed failed to start, falling back to mock feed");
      feed = new MockFeed(store, cfg.sectors, cfg.names, log);
      feed.start();
    }
  } else {
    feed = new MockFeed(store, cfg.sectors, cfg.names, log);
    feed.start();
  }

  server.listen(env.port, () => {
    log.info({ port: env.port, mode: env.useLs ? "ls" : "mock" }, "server listening");
  });

  const shutdown = () => {
    log.info("shutting down");
    feed.stop();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error({ err }, "fatal");
  process.exit(1);
});
