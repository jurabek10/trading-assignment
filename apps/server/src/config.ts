import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SectorMeta } from "@tma/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

type RawSector = {
  id: string;
  nameKo: string;
  nameEn: string;
  headline: string;
  stocks: { shcode: string; name: string }[];
};

type RawConfig = { sectors: RawSector[] };

export type LoadedConfig = {
  sectors: SectorMeta[];
  names: Record<string, string>;
};

export function loadSectorsConfig(): LoadedConfig {
  const path = resolve(__dirname, "../../../config/sectors.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawConfig;
  const sectors: SectorMeta[] = raw.sectors.map((s) => ({
    id: s.id,
    nameKo: s.nameKo,
    nameEn: s.nameEn,
    headline: s.headline,
    shcodes: s.stocks.map((st) => st.shcode),
  }));
  const names: Record<string, string> = {};
  for (const s of raw.sectors) {
    for (const st of s.stocks) {
      names[st.shcode] = st.name;
    }
  }
  return { sectors, names };
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? "*",
  useLs: process.env.USE_LS === "1",
  ls: {
    appKey: process.env.LS_APP_KEY ?? "",
    appSecret: process.env.LS_APP_SECRET ?? "",
    // LS Securities (LS증권) Open API endpoints. Override only if LS changes them.
    restBase: process.env.LS_REST_BASE ?? "https://openapi.ls-sec.co.kr:8080",
    wsBase: process.env.LS_WS_BASE ?? "wss://openapi.ls-sec.co.kr:9443/websocket",
  },
};
