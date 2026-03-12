"use client";

import { ACTIVE_SENSORS } from "@/lib/sensors";
import SensorCard from "./SensorCard";
import BigNumber from "./BigNumber";
import Gauge from "./Gauge";
import DeviceControl from "./DeviceControl";
import AnomalyInsights from "./AnomalyInsights";
import TimeFilter from "./TimeFilter";

export default function MonitorTab({
  latest,
  histories,
  timeRange,
  onTimeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
  lastUpdated,
  onExport,
  thresholds,
  connected,
}) {
  const isRealtime = timeRange === "realtime";

  return (
    <>
      <TimeFilter
        timeRange={timeRange}
        onTimeChange={onTimeChange}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={onCustomFromChange}
        onCustomToChange={onCustomToChange}
        onApplyCustom={onApplyCustom}
      />

      {/* Offline banner for realtime mode */}
      {isRealtime && !connected && (
        <div className="bg-white rounded-xl border border-[#e4e8ee] p-8 mb-3 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="text-[32px] mb-2">📡</div>
          <div className="text-[14px] font-semibold text-[#1a1d26] mb-1">Device Offline</div>
          <div className="text-[12px] text-[#8b93a7]">Waiting for data from SmartShelf...</div>
        </div>
      )}

      {/* Sensor cards — hide realtime cards when offline */}
      {(!isRealtime || connected) && ACTIVE_SENSORS.map((s) => {
        if (isRealtime) {
          if (s.realtimeStyle === "gauge") return <Gauge key={s.key} config={s} latest={latest} />;
          return <BigNumber key={s.key} config={s} latest={latest} />;
        }
        if (s.noHistory) return null; // ← skip freshness in history mode
        return <SensorCard key={s.key} config={s} latest={latest} history={histories[s.key]} />;
      })}

      {/* Device Control + Anomaly Insights — only in realtime + online */}
      {isRealtime && connected && (
        <>
          <DeviceControl latest={latest} />
          <AnomalyInsights latest={latest} thresholds={thresholds} />
        </>
      )}

      <div className="flex items-center justify-between mt-2">
        <p
          className="text-[11px] text-[#8b93a7]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Last updated: {lastUpdated}
        </p>
        <button
          onClick={onExport}
          className="text-[11px] text-[#00a074] font-semibold hover:underline"
        >
          📥 Export CSV
        </button>
      </div>
    </>
  );
}