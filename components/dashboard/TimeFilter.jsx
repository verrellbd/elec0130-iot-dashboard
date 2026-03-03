"use client";

const TIME_OPTIONS = [
  { label: "Real-time", value: "realtime" },
  { label: "1H", value: "1h" },
  { label: "3H", value: "3h" },
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "Custom", value: "custom" },
];

export default function TimeFilter({ timeRange, onTimeChange, customFrom, customTo, onCustomFromChange, onCustomToChange, onApplyCustom }) {
  return (
    <>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TIME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onTimeChange(opt.value)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all whitespace-nowrap ${
              timeRange === opt.value
                ? "bg-[#00c48c] text-white border-[#00c48c] shadow-[0_2px_8px_rgba(0,196,140,0.25)]"
                : "bg-white text-[#5a6175] border-[#e4e8ee] hover:border-[#00c48c]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {timeRange === "custom" && (
        <div className="flex gap-2 mb-4 items-center">
          <input
            type="datetime-local"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-lg border border-[#e4e8ee] bg-white text-[12px] outline-none focus:border-[#00c48c]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
          <span className="text-[12px] text-[#8b93a7]">to</span>
          <input
            type="datetime-local"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-lg border border-[#e4e8ee] bg-white text-[12px] outline-none focus:border-[#00c48c]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
          <button
            onClick={onApplyCustom}
            className="px-4 py-2 rounded-lg bg-[#00c48c] text-white text-[12px] font-semibold"
          >
            Apply
          </button>
        </div>
      )}
    </>
  );
}