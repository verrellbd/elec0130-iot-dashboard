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

      {ACTIVE_SENSORS.map((s) => {
        if (isRealtime) {
          if (s.realtimeStyle === "gauge") {
            return <Gauge key={s.key} config={s} latest={latest} />;
          }
          return <BigNumber key={s.key} config={s} latest={latest} />;
        }
        return <SensorCard key={s.key} config={s} latest={latest} history={histories[s.key]} />;
      })}

      {/* Device Control + Anomaly Insights — only in real-time mode */}
      {isRealtime && (
        <>
          <DeviceControl latest={latest} />
          <AnomalyInsights latest={latest} thresholds={thresholds} />
        </>
      )}

      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] text-[#8b93a7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Last updated: {lastUpdated}
        </p>
        <button onClick={onExport} className="text-[11px] text-[#00a074] font-semibold hover:underline">
          📥 Export CSV
        </button>
      </div>
    </>
  );
}