"use client";

import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";
const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || "ArduinoMKR1010";

// Single fetch — Lambda ignores type param so we get all fields in one call
async function fetchAll1HHistory() {
  try {
    const res = await fetch(
      `${API_URL}/history?device_id=${DEVICE_ID}&range=1h`,
      { headers: API_KEY ? { "x-api-key": API_KEY } : {} }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

function calcFreq(history, count) {
  if (!history || history.length < 2) return "0.0";
  const ms =
    new Date(history[history.length - 1]?.timestamp).getTime() -
    new Date(history[0]?.timestamp).getTime();
  const hours = ms / 3600000;
  return hours > 0 ? (count / Math.max(hours, 0.1)).toFixed(1) : "0.0";
}

const severityStyles = {
  critical: { color: "#ff5c5c", label: "CRITICAL" },
  warning:  { color: "#ff9f43", label: "WARNING"  },
  normal:   { color: "#00c48c", label: "NORMAL"   },
};

export default function AnomalyInsights({ latest, thresholds }) {
  const [anomalies, setAnomalies]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [lastFetch, setLastFetch]   = useState(null);

  const latestRef     = useRef(latest);
  const thresholdsRef = useRef(thresholds);

  useEffect(() => { latestRef.current = latest; },         [latest]);
  useEffect(() => { thresholdsRef.current = thresholds; }, [thresholds]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      // One fetch for all sensor data
      const allHistory = await fetchAll1HHistory();
      // TEMP DEBUG — remove after fixing
      console.log("first 3 items:", JSON.stringify(allHistory.slice(0, 3), null, 2));

    console.log("total rows:", allHistory.length);
    console.log("tvoc>=3:", allHistory.filter(d => Number(d.tvoc_level) >= 3).length);
    console.log("weight<500:", allHistory.filter(d => Number(d.weight) < 500).length);
    console.log("temp out:", allHistory.filter(d => Number(d.temperature) > 8 || Number(d.temperature) < 0).length);
    console.log("humid out:", allHistory.filter(d => Number(d.humidity) < 85 || Number(d.humidity) > 95).length);
    console.log("freshness bad:", allHistory.filter(d => d.freshness === "AGING" || d.freshness === "SPOILED").length);


      // Split into per-sensor arrays using actual field names from your API
      const tvocHistory      = allHistory.map(d => ({ value: d.tvoc_level  ?? d.tv  ?? 0,  timestamp: d.timestamp }));
      const weightHistory    = allHistory.map(d => ({ value: d.weight      ?? d.w   ?? 0,  timestamp: d.timestamp }));
      const tempHistory      = allHistory.map(d => ({ value: d.temperature ?? d.t   ?? 0,  timestamp: d.timestamp }));
      const humidHistory     = allHistory.map(d => ({ value: d.humidity    ?? d.h   ?? 0,  timestamp: d.timestamp }));
      const freshnessHistory = allHistory.map(d => ({ value: d.freshness   ?? d.fr  ?? "", timestamp: d.timestamp }));

      // Read refs after fetch
      const cur    = latestRef.current;
      const thresh = thresholdsRef.current;

      if (!cur) {
        setLoading(false);
        return;
      }

      const events = [];

      // ── TVOC ──────────────────────────────────────────────
      const tvocVal = cur.tvoc_level?.value ?? -1;
      if (tvocVal >= 0) {
        const highCount = tvocHistory.filter(d => Number(d.value) >= 3).length;
        events.push({
          name: "TVOC Level 3/4",
          count: highCount,
          frequency: `${calcFreq(tvocHistory, highCount)} times/hour`,
          severity: tvocVal >= 4 ? "critical" : tvocVal >= 3 ? "warning" : "normal",
        });
      }

      // ── Low Stock ──────────────────────────────────────────
      const lowStockThreshold = thresh?.weight?.low_stock ?? 500;
      const weightVal = cur.weight?.value ?? null;
      if (weightVal !== null) {
        const lowCount = weightHistory.filter(
          d => Number(d.value) < lowStockThreshold
        ).length;
        events.push({
          name: `Low Stock (<${lowStockThreshold}g)`,
          count: lowCount,
          frequency: `${calcFreq(weightHistory, lowCount)} times/hour`,
          severity: cur.ls === 1 ? "warning" : "normal",
        });
      }

      // ── Temperature ────────────────────────────────────────
      const tempMin = thresh?.temperature?.min ?? 0;
      const tempMax = thresh?.temperature?.max ?? 8;
      const tempVal = cur.temperature?.value ?? null;
      if (tempVal !== null) {
        const outCount = tempHistory.filter(
          d => Number(d.value) > tempMax || Number(d.value) < tempMin
        ).length;
        events.push({
          name: "Temp Out of Range",
          count: outCount,
          frequency: `${calcFreq(tempHistory, outCount)} times/hour`,
          severity:
            cur.temperature?.status === "HIGH" || cur.temperature?.status === "LOW"
              ? "critical"
              : outCount > 5 ? "warning" : "normal",
        });
      }

      // ── Humidity ───────────────────────────────────────────
      const humidMin = thresh?.humidity?.min ?? 85;
      const humidMax = thresh?.humidity?.max ?? 95;
      const humidVal = cur.humidity?.value ?? null;
      if (humidVal !== null) {
        const outCount = humidHistory.filter(
          d => Number(d.value) < humidMin || Number(d.value) > humidMax
        ).length;
        events.push({
          name: "Humidity Out of Range",
          count: outCount,
          frequency: `${calcFreq(humidHistory, outCount)} times/hour`,
          severity: cur.humidity?.status === "OUT_OF_RANGE" ? "warning" : "normal",
        });
      }

      // ── Freshness ──────────────────────────────────────────
      const freshnessVal = cur.freshness?.value ?? cur.freshness ?? null;
      if (freshnessVal) {
        const agingCount = freshnessHistory.filter(
          d => d.value === "AGING" || d.value === "SPOILED"
        ).length;
        events.push({
          name: "Freshness Degraded",
          count: agingCount,
          frequency: `${calcFreq(freshnessHistory, agingCount)} times/hour`,
          severity:
            freshnessVal === "SPOILED" ? "critical" :
            freshnessVal === "AGING"   ? "warning"  : "normal",
        });
      }

      setAnomalies(events);
      setLoading(false);
      setLastFetch(
        new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      );
    };

    run();
    const interval = setInterval(run, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-3">
      <div className="text-[11px] font-semibold text-[#8b93a7] uppercase tracking-widest mb-2.5 pl-1">
        Anomaly Insights
      </div>
      <div className="bg-white rounded-xl border border-[#e4e8ee] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[16px]">🚩</span>
            <span className="text-[13px] font-semibold text-[#1a1d26]">
              Anomaly Events Summary
            </span>
          </div>
          <div className="text-right">
            <div
              className="text-[10px] text-[#8b93a7]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              LAST 1H
            </div>
            {lastFetch && (
              <div
                className="text-[9px] text-[#b0b8c8]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                updated {lastFetch}
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-[12px] text-[#8b93a7] text-center py-4">
            Loading...
          </div>
        )}

        {/* Empty */}
        {!loading && anomalies.length === 0 && (
          <div className="text-[12px] text-[#8b93a7] text-center py-4">
            No anomaly data yet
          </div>
        )}

        {/* Rows */}
        {!loading && anomalies.map((a, i) => {
          const s = severityStyles[a.severity] || severityStyles.normal;
          return (
            <div
              key={a.name}
              className={`flex items-center justify-between py-3 ${
                i > 0 ? "border-t border-[#e4e8ee]" : ""
              }`}
            >
              <div>
                <div className="text-[13px] font-semibold text-[#1a1d26]">
                  {a.name}
                </div>
                <div className="text-[11px] text-[#8b93a7] mt-0.5">
                  Frequency: {a.frequency}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-[16px] font-bold"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: s.color }}
                >
                  +{a.count}
                </div>
                <div
                  className="text-[9px] font-bold mt-0.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: s.color }}
                >
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}