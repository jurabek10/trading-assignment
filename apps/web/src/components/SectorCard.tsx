import type { SortedSector } from "../hooks/useSortedSectors";
import { formatPct } from "../format";
import { StockRow } from "./StockRow";

type Props = { item: SortedSector };

export function SectorCard({ item }: Props) {
  const { sector, rows } = item;
  const up = sector.score >= 0;
  const scoreColor = up ? "text-white" : "text-white";
  const topShcode = rows[0]?.shcode;

  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="bg-teal-tma px-2 py-1 flex items-center justify-between">
        <span className="text-white text-[13px] font-bold">
          {sector.nameKo}
        </span>
        <span className={`text-[13px] font-bold tabular-nums ${scoreColor}`}>
          {formatPct(sector.score)}
        </span>
      </div>
      <div className="px-2 py-1 text-[11px] text-gray-600 truncate border-b border-gray-100">
        {sector.headline}
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((q) => (
          <StockRow
            key={q.shcode}
            quote={q}
            highlight={q.shcode === topShcode && q.changeRate > 0}
          />
        ))}
      </div>
    </div>
  );
}
