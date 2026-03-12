"use client";

import { useRef, useEffect } from "react";
import { getStatusStyle } from "@/lib/sensors";

export default function Gauge({ config, latest }) {
  const canvasRef = useRef(null);
  const reading = latest ? latest[config.key] : null;
  const value = reading?.value ?? "--";
  const status = reading?.status ?? "NORMAL";
  const style = getStatusStyle(status);

  const r = config.range || { min: 0, max: 100 };
  const pct = typeof value === "number"
    ? Math.max(0, Math.min(1, (value - r.min) / (r.max - r.min)))
    : 0;

  const displayValue = typeof value === "number"
    ? config.key === "tvoc_level" ? Math.round(value)
    : config.key === "uvIndex" ? value.toFixed(2)
    : value.toFixed(1)
    : value;

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 200, h = 115;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.clearRect(0, 0, w, h);

    const cx = 100, cy = 100, radius = 78;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = "#f0f2f5";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.stroke();

    // Color gradient arc (faint)
    const grad = ctx.createLinearGradient(20, 0, 180, 0);
    grad.addColorStop(0, "#4ade80");
    grad.addColorStop(0.6, "#facc15");
    grad.addColorStop(1, "#ff5c5c");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.15;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Value arc
    const valueAngle = startAngle + pct * Math.PI;
    if (pct > 0.01) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, valueAngle);
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Needle dot
    const dotX = cx + radius * Math.cos(valueAngle);
    const dotY = cy + radius * Math.sin(valueAngle);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }, [value, config, pct]);

  return (
    <div className="bg-white rounded-xl border border-[#e4e8ee] p-5 mb-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex items-center gap-2 mb-2">
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

      <div className="flex flex-col items-center">
        <canvas ref={canvasRef} />
        <div style={{ marginTop: "-12px" }}>
          <span
            className="text-[28px] font-bold tracking-tighter leading-none"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: config.color }}
          >
            {displayValue}
          </span>
          <span className="text-[13px] font-medium ml-0.5" style={{ color: "#8b93a7" }}>{config.unit}</span>
        </div>
        <div className="flex justify-between w-[180px] mt-1">
          <span className="text-[10px] text-[#8b93a7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {r.min}{config.unit}
          </span>
          <span className="text-[10px] text-[#8b93a7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {r.max}{config.unit}
          </span>
        </div>
        <span
          className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-semibold mt-1.5 ${style.className}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {style.label}
        </span>
      </div>
    </div>
  );
}