"use client";

import { useRef, useEffect } from "react";
import { getStatusStyle } from "@/lib/sensors";

export default function SensorCard({ config, latest, history }) {
  const canvasRef = useRef(null);

  const reading = latest ? latest[config.key] : null;
  const value = reading?.value ?? "--";
  const status = reading?.status ?? "NORMAL";
  const style = getStatusStyle(status);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    // Clear canvas when no data
    if (!history?.data?.length) {
      ctx.clearRect(0, 0, rect.width, rect.height);
      return;
    }

    const data = history.data;
    const vals = data.map((d) => d.value);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;

    const padLeft = 40;
    const padRight = 10;
    const padTop = 10;
    const padBottom = 22;
    const chartW = rect.width - padLeft - padRight;
    const chartH = rect.height - padTop - padBottom;

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Y axis labels
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#8b93a7";
    for (let i = 0; i <= 2; i++) {
      const yVal = minV + (range * (2 - i)) / 2;
      const y = padTop + (chartH * i) / 2;
      ctx.fillText(yVal.toFixed(1), padLeft - 6, y + 3);
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
    }

    // X axis labels — smart formatting based on time range
    ctx.textAlign = "center";
    ctx.fillStyle = "#8b93a7";

    const firstTime = new Date(data[0].timestamp).getTime();
    const lastTime = new Date(data[data.length - 1].timestamp).getTime();
    const spanMs = lastTime - firstTime;
    const spanHours = spanMs / (1000 * 60 * 60);

    let labelCount, formatLabel;

    if (spanHours <= 1) {
      labelCount = 3;
      formatLabel = (date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } else if (spanHours <= 6) {
      labelCount = 4;
      formatLabel = (date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } else if (spanHours <= 24) {
      labelCount = 5;
      formatLabel = (date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } else {
      labelCount = 7;
      formatLabel = (date) => {
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        if (isToday) return "Today";
        return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
      };
    }

    const labelIndices = [];
    for (let i = 0; i < labelCount; i++) {
      labelIndices.push(Math.round((i / (labelCount - 1)) * (data.length - 1)));
    }

    const uniqueLabels = [...new Set(labelIndices)];
    uniqueLabels.forEach((idx) => {
      const x = padLeft + (idx / (data.length - 1)) * chartW;
      const date = new Date(data[idx].timestamp);
      const label = formatLabel(date);
      if (x < padLeft + 15 || x > padLeft + chartW - 15) {
        ctx.textAlign = x < padLeft + 15 ? "left" : "right";
      } else {
        ctx.textAlign = "center";
      }
      ctx.fillText(label, x, rect.height - 4);
    });

    // Points
    const points = data.map((d, i) => ({
      x: padLeft + (i / (data.length - 1)) * chartW,
      y: padTop + chartH * (1 - (d.value - minV) / range),
    }));
    if (points.length < 2) return;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    grad.addColorStop(0, config.bgColor);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.moveTo(points[0].x, padTop + chartH);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const xc = (points[i - 1].x + points[i].x) / 2;
      const yc = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(padLeft + chartW, padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const xc = (points[i - 1].x + points[i].x) / 2;
      const yc = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot
    const last = points[points.length - 1];
    ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = config.color; ctx.fill();
    ctx.beginPath(); ctx.arc(last.x, last.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
  }, [history, config]);

  const stats = history?.stats;

  return (
    <div className="bg-white rounded-xl border border-[#e4e8ee] p-4 mb-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
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
        <div className="text-right">
          <div>
            <span
              className="text-2xl font-bold tracking-tighter leading-none"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: config.color }}
            >
              {typeof value === "number"
                ? config.key === "weight" ? Math.round(value) : value.toFixed(1)
                : value}
            </span>
            <span className="text-xs text-[#8b93a7] font-medium ml-0.5">{config.unit}</span>
          </div>
          <span
            className={`inline-block px-2 py-0.5 rounded-[10px] text-[10px] font-semibold mt-1 ${style.className}`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {style.label}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[140px] rounded-lg bg-[#f0f2f5] relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
        {history && history.data && history.data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[12px] text-[#8b93a7] font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              No data available for this period
            </span>
          </div>
        )}
        {!history && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[12px] text-[#8b93a7] font-medium">
              Loading...
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && history?.data?.length > 0 &&  (
        <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-[#e4e8ee]">
          {[
            { label: "Min", val: stats.min },
            { label: "Avg", val: stats.avg },
            { label: "Max", val: stats.max },
          ].map((s) => (
            <div key={s.label} className="flex-1 text-center">
              <div className="text-[10px] text-[#8b93a7] font-medium uppercase tracking-wider">
                {s.label}
              </div>
              <div
                className="text-[13px] font-semibold mt-0.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {config.key === "weight" ? Math.round(s.val) : s.val.toFixed(1)}
                <span className="text-[10px] text-[#8b93a7] ml-0.5">{config.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}