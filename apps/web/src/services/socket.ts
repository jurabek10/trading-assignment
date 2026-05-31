import type { WSMessage } from "@tma/shared";
import { useStore } from "../store";
import { fetchSnapshot } from "./api";

export function connectSocket(): () => void {
  let socket: WebSocket | null = null;
  let backoff = 1000;
  let stopped = false;
  let reconnectTimer: number | null = null;

  const wsUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/ws`;
  })();

  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(wsUrl);

    socket.onopen = async () => {
      backoff = 1000;
      useStore.getState().setConnected(true);
      try {
        const snap = await fetchSnapshot();
        useStore.getState().applySnapshot(snap);
      } catch {
        // server will also push a snapshot frame
      }
    };

    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WSMessage;
        const s = useStore.getState();
        switch (msg.type) {
          case "snapshot":
            s.applySnapshot(msg.snapshot);
            break;
          case "quote":
            s.applyQuote(msg.quote);
            break;
          case "sectorScores":
            s.applyScores(msg.scores);
            break;
          case "marketIndex":
            s.applyIndex(msg.index);
            break;
          case "heartbeat":
            break;
        }
      } catch {
        // ignore malformed
      }
    };

    socket.onclose = () => {
      useStore.getState().setConnected(false);
      scheduleReconnect();
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    if (reconnectTimer != null) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      backoff = Math.min(backoff * 2, 30_000);
      connect();
    }, backoff);
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}
