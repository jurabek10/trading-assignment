import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { Logger } from "pino";
import type { Quote, MarketIndex, WSMessage, Snapshot } from "@tma/shared";
import type { Store } from "./store.js";

const HEARTBEAT_MS = 15_000;

export function attachWsHub(
  httpServer: Server,
  store: Store,
  log: Logger,
): { snapshot: () => Snapshot; clientCount: () => number } {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Set<WebSocket>();

  const snapshot = (): Snapshot => ({
    sectors: store.getSectors(),
    quotes: store.getAllQuotes(),
    marketIndex: store.getMarketIndex(),
    serverTs: Date.now(),
  });

  wss.on("connection", (ws) => {
    clients.add(ws);
    log.info({ clients: clients.size }, "ws client connected");
    send(ws, { type: "snapshot", snapshot: snapshot() });
    ws.on("close", () => {
      clients.delete(ws);
      log.info({ clients: clients.size }, "ws client disconnected");
    });
    ws.on("error", (err) => log.warn({ err }, "ws client error"));
  });

  const broadcast = (msg: WSMessage) => {
    const data = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  };

  store.on("quote", (q: Quote) => broadcast({ type: "quote", quote: q }));
  store.on("sectorScores", (scores: Record<string, number>) =>
    broadcast({ type: "sectorScores", scores }),
  );
  store.on("marketIndex", (index: MarketIndex) =>
    broadcast({ type: "marketIndex", index }),
  );

  const heartbeat = setInterval(() => {
    broadcast({ type: "heartbeat", ts: Date.now() });
  }, HEARTBEAT_MS);

  httpServer.on("close", () => {
    clearInterval(heartbeat);
    wss.close();
  });

  return { snapshot, clientCount: () => clients.size };
}

function send(ws: WebSocket, msg: WSMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
