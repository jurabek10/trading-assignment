import { useMemo } from "react";
import type { Quote, Sector } from "@tma/shared";
import { useStore } from "../store";

export type SortedSector = {
  sector: Sector;
  rows: Quote[];
};

export function useSortedSectors(): SortedSector[] {
  const sectors = useStore((s) => s.sectors);
  const sectorOrder = useStore((s) => s.sectorOrder);
  const quotes = useStore((s) => s.quotes);

  return useMemo(() => {
    const list: SortedSector[] = sectorOrder
      .map((id) => sectors[id])
      .filter((s): s is Sector => Boolean(s))
      .map((sector) => {
        const rows = sector.shcodes
          .map((c) => quotes[c])
          .filter((q): q is Quote => Boolean(q))
          .sort((a, b) => {
            if (b.changeRate !== a.changeRate)
              return b.changeRate - a.changeRate;
            return a.shcode.localeCompare(b.shcode);
          });
        return { sector, rows };
      });
    list.sort((a, b) => {
      if (b.sector.score !== a.sector.score)
        return b.sector.score - a.sector.score;
      return a.sector.id.localeCompare(b.sector.id);
    });
    return list;
  }, [sectors, sectorOrder, quotes]);
}
