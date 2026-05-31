import { useEffect, useState } from "react";
import { formatNowKR } from "../format";

export function Header() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[20px] font-extrabold tracking-tight text-teal-tma">
            티마
          </span>
          <span className="text-[12px] text-gray-500 tabular-nums">
            {formatNowKR(now)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <button aria-label="memo" className="text-[16px]">📝</button>
          <button aria-label="refresh" className="text-[16px]">⟳</button>
          <button aria-label="calendar" className="text-[16px]">📅</button>
        </div>
      </div>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-100 rounded-md px-2 py-1">
          <input
            disabled
            placeholder="종목, 테마명을 입력하세요."
            className="bg-transparent text-[12px] flex-1 placeholder-gray-500 outline-none"
          />
          <span className="text-gray-500">🔍</span>
        </div>
      </div>
    </header>
  );
}
