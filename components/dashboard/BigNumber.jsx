"use client";

import { getStatusStyle } from "@/lib/sensors";

export default function BigNumber({ config, latest }) {
  const reading = latest ? latest[config.key] : null;
  const value = reading?.value ?? "--";
  const status = reading?.status ?? "NORMAL";
  const style = getStatusStyle(status);

  const r = config.range || { min: 0, max: 100 };
  const pct = typeof value === "number"
    ? Math.max(0, Math.min(100, ((value - r.min) / (r.max - r.min)) * 100))
    : 0;

  // Format value based on sensor type
  const displayValue = typeof value === "number"
    ? config.key === "weight" ? Math.round(value)
    : config.key === "pressure" ? value.toFixed(2)
    : value.toFixed(1)
    : value;

  return (
    <div className="bg-white rounded-xl border border-[#e4e8ee] p-5 mb-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[17px]"
            style={{ background: config.lightColor }}
          >
            {config.icon}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#1a1d26]">{config.name}</div>
            <div className="text-[11px] text-[#8b93a7]">{config.subtitle}</div>
          </div>
        </div>
        <div>
          <span
            className="text-[44px] font-bold leading-none tracking-tighter"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: config.color }}
          >
            {displayValue}
          </span>
          <span className="text-[16px] font-medium ml-0.5" style={{ color: "#8b93a7" }}>{config.unit}</span>
        </div>
        <span
          className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-semibold mt-2 ${style.className}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {style.label}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-[10px] h-[90px] bg-[#f0f2f5] rounded-[5px] relative overflow-hidden">
          <div
            className="absolute bottom-0 w-full rounded-[5px] transition-all duration-700"
            style={{
              height: `${pct}%`,
              background: `linear-gradient(to top, ${config.color}, ${config.color}88)`,
            }}
          />
        </div>
        <div
          className="text-[9px] text-[#8b93a7] mt-1.5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {r.min}–{r.max}
        </div>
      </div>
    </div>
  );
}