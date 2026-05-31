import { useSortedSectors } from "../hooks/useSortedSectors";
import { SectorCard } from "./SectorCard";

export function SectorGrid() {
  const sectors = useSortedSectors();
  if (sectors.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        시세 수신 대기중...
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-2">
      {sectors.map((s) => (
        <SectorCard key={s.sector.id} item={s} />
      ))}
    </div>
  );
}
