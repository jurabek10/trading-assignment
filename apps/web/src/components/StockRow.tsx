import { memo, useEffect, useRef, useState } from "react";
import type { Quote } from "@tma/shared";
import { formatPct, formatPrice, formatTradingValue } from "../format";
import { PriceBar } from "./PriceBar";

type Props = {
  quote: Quote;
  highlight?: boolean;
};

export const StockRow = memo(function StockRow({ quote, highlight }: Props) {
  const up = quote.changeRate >= 0;
  const color = up ? "text-upRed" : "text-downBlue";
  const [flash, setFlash] = useState(false);
  const lastPrice = useRef(quote.price);

  useEffect(() => {
    if (lastPrice.current !== quote.price) {
      lastPrice.current = quote.price;
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 350);
      return () => clearTimeout(id);
    }
  }, [quote.price]);

  return (
    <div
      className={`px-2 py-1 ${highlight ? "bg-highlight" : ""} ${
        flash && !highlight ? "flash" : ""
      }`}
    >
      <div className="flex items-baseline justify-between leading-tight">
        <span className="text-[13px] font-medium text-gray-900 truncate max-w-[55%]">
          {quote.name}
        </span>
        <span className={`text-[13px] font-bold tabular-nums ${color}`}>
          {up ? "▲" : "▼"}
          {formatPct(quote.changeRate)}
        </span>
      </div>
      <div className="flex items-baseline justify-between leading-tight">
        <span className="text-[12px] text-gray-700 tabular-nums">
          {formatPrice(quote.price)}
          {quote.lastTradeTime && (
            <span className="ml-1 text-[11px] text-gray-400">
              {quote.lastTradeTime}
            </span>
          )}
        </span>
        <span className="text-[12px] text-gray-700 tabular-nums">
          {formatTradingValue(quote.tradingValue)}
        </span>
      </div>
      <div className="pt-1">
        <PriceBar q={quote} />
      </div>
    </div>
  );
});
