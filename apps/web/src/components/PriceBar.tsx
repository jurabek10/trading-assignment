import type { Quote } from "@tma/shared";

type Props = { q: Quote };

export function PriceBar({ q }: Props) {
  const up = q.changeRate >= 0;
  const span = Math.max(q.high - q.low, 1);
  const pos = ((q.price - q.low) / span) * 100;
  const clamped = Math.max(2, Math.min(98, pos));

  // Width of the colored bar from prevClose to current price.
  const prevPos = ((q.prevClose - q.low) / span) * 100;
  const left = Math.min(prevPos, clamped);
  const right = Math.max(prevPos, clamped);
  const barColor = up ? "bg-upRedBar" : "bg-downBlueBar";

  return (
    <div className="relative h-[6px] w-full bg-gray-200 rounded-sm overflow-hidden">
      <div
        className={`absolute top-0 h-full ${barColor}`}
        style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}
      />
      <div
        className="absolute top-[-2px] h-[10px] w-[2px] bg-gray-700"
        style={{ left: `${clamped}%` }}
      />
    </div>
  );
}
