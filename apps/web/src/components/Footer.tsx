import { useStore } from "../store";

export function Footer() {
  const idx = useStore((s) => s.marketIndex);
  const connected = useStore((s) => s.connected);

  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="px-3 py-2 text-[11px] text-gray-500 leading-snug">
        마켓중심 정보는 정성적평가에 의해 선별된 참고용 자료이며, 벌류와 환권의 유무는 매수·매도 권유가 아닙니다. 모든 투자의 책임은 본인에게 있으며, 데이터 오류나 지연 등으로 발생할 수 있는 손실 등에 대해 ㈜코리아정보분석은 법적 책임을 지지 않습니다.
      </div>
      <div className="px-3 py-1 text-[12px] text-gray-700 border-t border-gray-100">
        <span className="text-gray-500">14:46 </span>
        <span className="text-upRed">[특징주]</span> 삼성전기, 1.5조 북미 빅테크 수주에 52주 신고가···시총 100조···
      </div>
      {idx && (
        <div className="px-3 py-1 text-[12px] flex items-center gap-4 border-t border-gray-100 tabular-nums">
          <span className="text-gray-700">코스피</span>
          <span className="text-gray-900 font-medium">{idx.kospi.value.toFixed(2)}</span>
          <span className={idx.kospi.change >= 0 ? "text-upRed" : "text-downBlue"}>
            {idx.kospi.change >= 0 ? "+" : ""}
            {idx.kospi.change.toFixed(2)} ({idx.kospi.changePct.toFixed(2)}%)
          </span>
          <span className="ml-4 text-gray-700">코스닥</span>
          <span className="text-gray-900 font-medium">{idx.kosdaq.value.toFixed(2)}</span>
          <span className={idx.kosdaq.change >= 0 ? "text-upRed" : "text-downBlue"}>
            {idx.kosdaq.change >= 0 ? "+" : ""}
            {idx.kosdaq.change.toFixed(2)} ({idx.kosdaq.changePct.toFixed(2)}%)
          </span>
          <span className={`ml-auto text-[11px] ${connected ? "text-emerald-600" : "text-gray-400"}`}>
            {connected ? "● 실시간" : "○ 연결중"}
          </span>
        </div>
      )}
      <div className="grid grid-cols-5 text-[12px] text-gray-500 border-t border-gray-200">
        {[
          { k: "market", label: "마켓중심", active: true },
          { k: "nxt", label: "NXT" },
          { k: "schedule", label: "마켓일정" },
          { k: "fjon", label: "F존" },
          { k: "summary", label: "시장종합" },
        ].map((t) => (
          <button
            key={t.k}
            className={`py-2 ${t.active ? "text-teal-tma font-bold" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </footer>
  );
}
