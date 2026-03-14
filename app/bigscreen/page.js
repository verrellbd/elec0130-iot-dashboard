"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getLatestReadings, getHistory, getRawHistory, getThresholds, getDefaultThresholds } from "@/lib/dashboard-api";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Config ──────────────────────────────────────────────────────────────────

const METRICS = [
  { key: "temperature", label: "TEMP",     unit: "°C",  color: "#f87171", icon: "🌡" },
  { key: "humidity",    label: "HUMIDITY", unit: "%",   color: "#38bdf8", icon: "💧" },
  { key: "illuminance", label: "LIGHT",    unit: "lux", color: "#fbbf24", icon: "☀️" },
  { key: "weight",      label: "WEIGHT",   unit: "g",   color: "#34d399", icon: "⚖️" },
  { key: "tvoc_level",  label: "TVOC",     unit: "Lv",  color: "#c084fc", icon: "🧪" },
];

const STATUS_COLOR = {
  NORMAL: "#34d399", OK: "#34d399", FRESH: "#34d399", GOOD: "#34d399", STORE_OPEN: "#34d399",
  HIGH: "#f87171",   LOW: "#38bdf8", DANGER: "#ff4444", SPOILED: "#f87171",
  EMPTY: "#f87171",  REMOVE: "#f87171", OUT_OF_RANGE: "#f87171",
  WARNING: "#fbbf24", AGING: "#fbbf24", "LOW STOCK": "#fbbf24", LOW_STOCK: "#fbbf24", DARK: "#94a3b8",
  "TOO WET": "#60a5fa", "TOO DRY": "#fbbf24",
  "POOR AIR": "#fbbf24", "SEVERE AIR": "#f87171",
};

const TIME_RANGES = [
  { label: "1H", value: "1h" },
  { label: "3H", value: "3h" },
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "Custom", value: "custom" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts, spanH = 1) {
  const d = new Date(ts);
  if (spanH > 36) return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function shelfLifeColor(pct) {
  if (pct <= 25) return "#f87171";
  if (pct <= 50) return "#fbbf24";
  if (pct <= 75) return "#a3e635";
  return "#34d399";
}

function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1)  return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// Sensor status from live reading vs thresholds
function getSensorStatus(key, value, thr) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (key === "temperature") {
    if (value > thr.temperature.danger) return "DANGER";
    if (value > thr.temperature.max)    return "HIGH";
    if (value < thr.temperature.min)    return "LOW";
    return "NORMAL";
  }
  if (key === "humidity") {
    if (value > thr.humidity.max) return "TOO WET";
    if (value < thr.humidity.min) return "TOO DRY";
    return "NORMAL";
  }
  if (key === "weight") {
    if (value < 0) return null;
    return value < thr.weight.low_stock ? "LOW STOCK" : "OK";
  }
  if (key === "tvoc_level") {
    if (value < 0) return null;
    if (value >= thr.tvoc.buzzer_threshold) return "SEVERE AIR";
    if (value >= thr.tvoc.fan_threshold)    return "POOR AIR";
    return "GOOD";
  }
  return null;
}

// Anomaly types derived from thresholds
function getAnomalyTypes(thr) {
  return [
    { key: "tempDanger", label: "Temp Danger",         icon: "🌡", color: "#ff4444",
      check: r => Number.isFinite(r.temperature) && r.temperature > thr.temperature.danger },
    { key: "tempHigh",   label: "Temp High",            icon: "🌡", color: "#f87171",
      check: r => Number.isFinite(r.temperature) && r.temperature > thr.temperature.max && r.temperature <= thr.temperature.danger },
    { key: "tempLow",    label: "Temp Low",             icon: "🌡", color: "#38bdf8",
      check: r => Number.isFinite(r.temperature) && r.temperature < thr.temperature.min },
    { key: "tooWet",     label: "Humidity Too Wet",     icon: "💧", color: "#60a5fa",
      check: r => Number.isFinite(r.humidity) && r.humidity > thr.humidity.max },
    { key: "tooDry",     label: "Humidity Too Dry",     icon: "💧", color: "#fbbf24",
      check: r => Number.isFinite(r.humidity) && r.humidity < thr.humidity.min },
    { key: "severeAir",  label: "Severe Air Quality",   icon: "💨", color: "#f87171",
      check: r => r.tvoc >= 0 && r.tvoc >= thr.tvoc.buzzer_threshold },
    { key: "poorAir",    label: "Poor Air Quality",     icon: "💨", color: "#fbbf24",
      check: r => r.tvoc >= 0 && r.tvoc >= thr.tvoc.fan_threshold && r.tvoc < thr.tvoc.buzzer_threshold },
    { key: "lowStock",   label: "Low-stock Sleep Mode", icon: "📦", color: "#fbbf24",
      check: r => Number.isFinite(r.weight) && r.weight >= 0 && r.weight < thr.weight.low_stock },
  ];
}

const ACTUATOR_META = {
  fan:    { icon: "🌀", label: "Fan" },
  led:    { icon: "💡", label: "LED" },
  buzzer: { icon: "🔊", label: "Buzzer" },
};

function buildAnomalyEvents(records, thresholds) {
  if (!records || records.length === 0) return [];
  const anomalyTypes = getAnomalyTypes(thresholds);
  const events = [];

  for (const atype of anomalyTypes) {
    let startRec = null;
    let actFirst = {};
    let actLast  = {};

    for (const rec of records) {
      if (atype.check(rec)) {
        if (!startRec) { startRec = rec; actFirst = {}; actLast = {}; }
        for (const a of ["fan", "led", "buzzer"]) {
          if (rec[a]) { if (!actFirst[a]) actFirst[a] = rec.timestamp; actLast[a] = rec.timestamp; }
        }
      } else if (startRec) {
        events.push({
          type: atype.label, icon: atype.icon, color: atype.color,
          startTime: startRec.timestamp, endTime: rec.timestamp, ongoing: false,
          durationMs: new Date(rec.timestamp) - new Date(startRec.timestamp),
          actuators: ["fan", "led", "buzzer"].filter(a => actFirst[a]).map(a => ({
            ...ACTUATOR_META[a],
            durationMs: new Date(actLast[a]) - new Date(actFirst[a]),
          })),
        });
        startRec = null;
      }
    }
    // Still ongoing
    if (startRec) {
      const last = records[records.length - 1];
      events.push({
        type: atype.label, icon: atype.icon, color: atype.color,
        startTime: startRec.timestamp, endTime: null, ongoing: true,
        durationMs: new Date(last.timestamp) - new Date(startRec.timestamp),
        actuators: ["fan", "led", "buzzer"].filter(a => actFirst[a]).map(a => ({
          ...ACTUATOR_META[a],
          durationMs: new Date(actLast[a]) - new Date(actFirst[a]),
        })),
      });
    }
  }

  return events.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, icon, value, unit, color, status }) {
  const warn = status && !["NORMAL","OK","FRESH","GOOD","STORE_OPEN"].includes(status);
  return (
    <div style={{
      borderRadius: 10, padding: "10px 12px", transition: "all 0.3s",
      border: `1px solid ${warn ? "rgba(248,113,113,0.35)" : "rgba(0,200,180,0.14)"}`,
      background: warn ? "rgba(248,113,113,0.06)" : "rgba(0,200,180,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#2a5060", textTransform: "uppercase" }}>
          {icon} {label}
        </span>
        {status && (
          <span style={{
            fontSize: 8, padding: "2px 5px", borderRadius: 4, fontWeight: 700,
            textTransform: "uppercase",
            color: STATUS_COLOR[status] || "#94a3b8",
            background: `${STATUS_COLOR[status] || "#94a3b8"}18`,
          }}>
            {status}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{
          fontSize: 28, fontWeight: 700, lineHeight: 1,
          fontFamily: "'JetBrains Mono', monospace",
          color: value !== null ? color : "#2a4050",
        }}>
          {value ?? "--"}
        </span>
        <span style={{ fontSize: 11, color: "#2a5060" }}>{unit}</span>
      </div>
    </div>
  );
}

function ShelfLifeBar({ label, pct, detail }) {
  const clr = shelfLifeColor(pct);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#7a9aaa" }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: clr }}>{pct}%</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: `${pct}%`, borderRadius: 5,
          background: `linear-gradient(90deg, ${clr}80, ${clr})`,
          boxShadow: pct > 0 ? `0 0 12px ${clr}60` : "none",
          transition: "width 0.8s ease, background 0.5s ease",
        }} />
      </div>
      <div style={{ fontSize: 10, color: "#2a5060", marginTop: 4, fontFamily: "monospace" }}>
        {detail}
      </div>
    </div>
  );
}

function AlertRow({ icon, label, isActive, activeColor, badge, hint }) {
  const clr = isActive ? activeColor : "#34d399";
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8, marginBottom: 8,
      background: isActive ? `${activeColor}10` : "rgba(255,255,255,0.02)",
      border: `1px solid ${isActive ? activeColor + "30" : "rgba(255,255,255,0.05)"}`,
      transition: "all 0.3s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#b0c4d0" }}>{icon} {label}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
          textTransform: "uppercase", color: clr, background: `${clr}18`,
        }}>
          {badge}
        </span>
      </div>
      {isActive && hint && (
        <div style={{ fontSize: 10, color: activeColor + "cc", marginTop: 5, paddingLeft: 2, lineHeight: 1.4 }}>
          → {hint}
        </div>
      )}
    </div>
  );
}

function ActuatorRow({ icon, label, isOn }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 10px", borderRadius: 8, marginBottom: 6,
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
    }}>
      <span style={{ fontSize: 12, color: "#b0c4d0" }}>{icon} {label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: isOn ? "#34d399" : "#2a4050",
          boxShadow: isOn ? "0 0 7px #34d399" : "none",
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: isOn ? "#34d399" : "#2a4050" }}>
          {isOn ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );
}

function AnomalyEventCard({ event, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        borderRadius: 8, padding: "8px 10px", cursor: "pointer",
        border: `1px solid ${expanded ? event.color + "40" : event.color + "20"}`,
        background: expanded ? `${event.color}0e` : `${event.color}05`,
        transition: "all 0.2s",
      }}
    >
      {/* Title row — always visible */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: event.color }}>
          {event.icon} {event.type}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 700, textTransform: "uppercase",
            color: event.ongoing ? "#fbbf24" : "#34d399",
            background: event.ongoing ? "#fbbf2418" : "#34d39918",
          }}>
            {event.ongoing ? "ONGOING" : "RESOLVED"}
          </span>
          <span style={{ fontSize: 9, color: "#2a5060" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 7 }}>
          <div style={{ fontSize: 9, color: "#3a6070", fontFamily: "monospace", lineHeight: 1.6 }}>
            <div>Start: {fmtDateTime(event.startTime)}</div>
            <div>End:&nbsp;&nbsp;&nbsp;{event.endTime ? fmtDateTime(event.endTime) : "—  (still active)"}</div>
            <div>Duration: <span style={{ color: "#7ab0c0" }}>{fmtDuration(event.durationMs)}</span></div>
          </div>
          {event.actuators.length > 0 && (
            <div style={{ marginTop: 5, paddingTop: 5, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 8, color: "#1a4050", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
                Actuators triggered
              </div>
              {event.actuators.map(a => (
                <div key={a.label} style={{ fontSize: 9, color: "#5a8090", fontFamily: "monospace", lineHeight: 1.6 }}>
                  {a.icon} {a.label}:&nbsp;
                  <span style={{ color: "#7ab0c0" }}>{fmtDuration(a.durationMs)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BigScreen() {
  const router = useRouter();

  const [latest,     setLatest]     = useState(null);
  const [histories,  setHistories]  = useState({});
  const [connected,  setConnected]  = useState(true);
  const [clock,      setClock]      = useState("");
  const [envRange,   setEnvRange]   = useState("1h");
  const [customFrom,    setCustomFrom]    = useState("");
  const [customTo,      setCustomTo]      = useState("");
  const [thresholds,        setThresholds]        = useState(getDefaultThresholds());
  const [rawAnomalyRecords, setRawAnomalyRecords] = useState([]);
  const [anomalyEvents,     setAnomalyEvents]     = useState([]);
  const [anomalyPage,       setAnomalyPage]       = useState(0);
  const [expandedAnomaly,   setExpandedAnomaly]   = useState(null);

  // Refs for stable timer callbacks (avoids stale closures)
  const envRangeRef   = useRef("1h");
  const customFromRef = useRef("");
  const customToRef   = useRef("");
  useEffect(() => { envRangeRef.current   = envRange;   }, [envRange]);
  useEffect(() => { customFromRef.current = customFrom; }, [customFrom]);
  useEffect(() => { customToRef.current   = customTo;   }, [customTo]);

  // Real-time clock
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Data fetchers ─────────────────────────────────────────────────────────

  const fetchLatestData = useCallback(async () => {
    try { setLatest(await getLatestReadings()); setConnected(true); }
    catch { setConnected(false); }
  }, []);

  // Uses refs so this callback is stable and always uses the latest range params
  const fetchEnvHistory = useCallback(async () => {
    const r = envRangeRef.current;
    const f = customFromRef.current;
    const t = customToRef.current;
    if (r === "custom" && (!f || !t)) return;
    const [temp, humid] = await Promise.all([
      getHistory("temperature", r, f, t).catch(() => null),
      getHistory("humidity",    r, f, t).catch(() => null),
    ]);
    setHistories(prev => ({ ...prev, temperature: temp, humidity: humid }));
  }, []);

  const fetchWeightHistory = useCallback(async () => {
    const data = await getHistory("weight", "1d").catch(() => null);
    setHistories(prev => ({ ...prev, weight: data }));
  }, []);

  const fetchAnomalyHistory = useCallback(async () => {
    const records = await getRawHistory("7d").catch(() => []);
    setRawAnomalyRecords(records);
  }, []);

  // Recompute anomaly events whenever raw records or thresholds change
  useEffect(() => {
    setAnomalyEvents(buildAnomalyEvents(rawAnomalyRecords, thresholds));
    setAnomalyPage(0);
    setExpandedAnomaly(null);
  }, [rawAnomalyRecords, thresholds]);

  // Initial load + 30s auto-refresh
  useEffect(() => {
    const stored = sessionStorage.getItem("smartshelf_user");
    if (!stored) { router.push("/"); return; }
    getThresholds().then(setThresholds).catch(() => {});
    fetchLatestData();
    fetchWeightHistory();
    fetchAnomalyHistory();
    const timer = setInterval(() => {
      fetchLatestData();
      fetchEnvHistory();
      fetchWeightHistory();
      getThresholds().then(setThresholds).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchLatestData, fetchEnvHistory, fetchWeightHistory, fetchAnomalyHistory, router]);

  // Re-fetch env history whenever range changes (non-custom)
  useEffect(() => {
    envRangeRef.current = envRange;
    if (envRange !== "custom") {
      setHistories(prev => ({ ...prev, temperature: null, humidity: null }));
      fetchEnvHistory();
    }
  }, [envRange, fetchEnvHistory]);

  // Apply custom range
  const handleApplyCustom = () => {
    if (!customFrom || !customTo) return;
    customFromRef.current = customFrom;
    customToRef.current   = customTo;
    setHistories(prev => ({ ...prev, temperature: null, humidity: null }));
    fetchEnvHistory();
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  // Merge temp + humidity into a single series for the dual-line chart
  const tempData  = histories.temperature?.data || [];
  const humidData = histories.humidity?.data    || [];
  const spanH = tempData.length < 2 ? 1
    : (new Date(tempData[tempData.length - 1].timestamp) - new Date(tempData[0].timestamp)) / 3_600_000;
  const envChartData = tempData
    .map((d, i) => ({
      t:     fmtTime(d.timestamp, spanH),
      temp:  d.value >= -50 && d.value <= 100 ? d.value : null,
      humid: humidData[i]?.value ?? null,
    }))
    .filter(d => d.temp !== null);

  const weightChartData = (histories.weight?.data || [])
    .filter(d => d.value >= 0)
    .map(d => ({
      t: fmtTime(d.timestamp, 24),
      v: d.value,
    }));

  // Shelf-life calculations
  const act       = latest?._actuators || {};
  const freshness = latest?.freshness?.value      ?? "FRESH";
  const brownIdx  = latest?.freshness?.brownIndex ?? 0;
  const tvocLevel = latest?.tvoc_level?.value      ?? -1;

  // TVOC shelf life: threshold 4 = alarm (0%), -1 = sensor off (100%)
  const tvocPct = tvocLevel < 0
    ? 100
    : Math.max(0, Math.round((1 - tvocLevel / 4) * 100));
  const tvocDetail = tvocLevel < 0
    ? "Sensor inactive · no reading"
    : `Level ${tvocLevel} / 4 · ${tvocPct > 50 ? "Good" : tvocPct > 25 ? "Fan active" : "⚠ Alarm triggered"}`;

  // Color / brown-index shelf life
  const colorPctMap = { FRESH: 100, AGING: 50, REMOVE: 20, SPOILED: 0, DARK: 0 };
  const colorPct = brownIdx > 0.15 ? 0 : (colorPctMap[freshness] ?? 100);
  const colorDetail = `${freshness} · BrownIndex ${typeof brownIdx === "number" ? brownIdx.toFixed(3) : "--"}`;

  const freshClr = ({ FRESH: "#34d399", AGING: "#fbbf24", SPOILED: "#f87171", REMOVE: "#f87171" })[freshness] || "#94a3b8";

  // Threshold-based status for MetricCards and AlertRows
  const tempStatus   = getSensorStatus("temperature", latest?.temperature?.value ?? null, thresholds);
  const humidStatus  = getSensorStatus("humidity",    latest?.humidity?.value    ?? null, thresholds);
  const weightStatus = getSensorStatus("weight",      latest?.weight?.value      ?? null, thresholds);
  const tvocStatus   = getSensorStatus("tvoc_level",  tvocLevel >= 0 ? tvocLevel : null,  thresholds);

  const isSystemAlert = !!latest && (tempStatus === "LOW" || tempStatus === "HIGH" || tempStatus === "DANGER");
  const isLowStock    = !!latest && weightStatus === "LOW STOCK";
  const isHumidAlert  = !!latest && (humidStatus === "TOO WET" || humidStatus === "TOO DRY");
  const isBadAir      = !!latest && (tvocStatus === "POOR AIR" || tvocStatus === "SEVERE AIR");

  // Hardware fault detection
  // Temperature: fault only if no reading (negatives are valid physics)
  // All others: fault if no reading OR value < 0
  const faultedSensors = latest ? METRICS.filter(m => {
    const v = latest[m.key]?.value;
    if (v === null || v === undefined) return true;
    if (m.key !== "temperature" && v < 0) return true;
    return false;
  }) : [];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
      background: "linear-gradient(135deg, #020810 0%, #04101e 60%, #020c14 100%)",
      fontFamily: "'DM Sans', sans-serif", color: "#e0eaf4",
    }}>

      {/* ── HEADER ── */}
      <header style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 28px",
        borderBottom: "1px solid rgba(0,200,180,0.1)",
        background: "rgba(2,12,28,0.9)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, fontSize: 19,
            background: "linear-gradient(135deg,#00c48c,#006fff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 22px rgba(0,196,140,0.45)",
          }}>🛒</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#00d4aa", textShadow: "0 0 18px rgba(0,212,170,0.45)" }}>SmartShelf</div>
            <div style={{ fontSize: 10, color: "#1a4a58", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>Analytics BigScreen · Store 01</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#34d399" : "#f87171", boxShadow: connected ? "0 0 10px #34d399" : "none" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", fontFamily: "monospace", color: connected ? "#34d399" : "#f87171" }}>
              {connected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#00d4aa", textShadow: "0 0 18px rgba(0,212,170,0.5)", letterSpacing: "0.06em" }}>
            {clock}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid rgba(0,200,180,0.18)", background: "transparent", color: "#2a6070", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,212,170,0.5)"; e.currentTarget.style.color = "#00d4aa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,200,180,0.18)"; e.currentTarget.style.color = "#2a6070"; }}
          >
            ← Mobile
          </button>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <main style={{
        flex: 1, minHeight: 0,
        display: "grid", gridTemplateColumns: "210px 1fr 215px",
        gap: 14, padding: 14,
      }}>

        {/* ── LEFT: Live sensor metrics (no pressure) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#0e3040", textTransform: "uppercase", marginBottom: 2 }}>Live Sensors</div>
          {METRICS.filter(m => m.key !== "illuminance").map(m => {
            const reading = latest?.[m.key];
            return (
              <MetricCard key={m.key} label={m.label} icon={m.icon}
                value={reading?.value ?? null} unit={m.unit} color={m.color}
                status={getSensorStatus(m.key, reading?.value ?? null, thresholds)} />
            );
          })}

          {/* ── Anomaly History ── */}
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#0e3040", textTransform: "uppercase", marginTop: 6, marginBottom: 2 }}>
            Anomaly History · 7 Days
          </div>
          {anomalyEvents.length === 0 ? (
            <div style={{ fontSize: 10, color: "#1a4050", textAlign: "center", padding: "14px 0", fontFamily: "monospace" }}>
              No anomalies recorded
            </div>
          ) : (() => {
            const PAGE_SIZE = 5;
            const totalPages = Math.ceil(anomalyEvents.length / PAGE_SIZE);
            const pageEvents = anomalyEvents.slice(anomalyPage * PAGE_SIZE, anomalyPage * PAGE_SIZE + PAGE_SIZE);
            return (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pageEvents.map((ev, i) => {
                    const globalIdx = anomalyPage * PAGE_SIZE + i;
                    return (
                      <AnomalyEventCard
                        key={globalIdx}
                        event={ev}
                        expanded={expandedAnomaly === globalIdx}
                        onToggle={() => setExpandedAnomaly(prev => prev === globalIdx ? null : globalIdx)}
                      />
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "0 2px" }}>
                    <button
                      onClick={() => { setAnomalyPage(p => Math.max(0, p - 1)); setExpandedAnomaly(null); }}
                      disabled={anomalyPage === 0}
                      style={{
                        padding: "3px 8px", borderRadius: 5, cursor: anomalyPage === 0 ? "default" : "pointer",
                        fontSize: 9, fontWeight: 700, border: "1px solid",
                        borderColor: anomalyPage === 0 ? "rgba(0,200,180,0.1)" : "rgba(0,200,180,0.25)",
                        background: "transparent",
                        color: anomalyPage === 0 ? "#1a3a48" : "#2a8070",
                      }}
                    >
                      ← Prev
                    </button>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "#2a5060" }}>
                      {anomalyPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => { setAnomalyPage(p => Math.min(totalPages - 1, p + 1)); setExpandedAnomaly(null); }}
                      disabled={anomalyPage === totalPages - 1}
                      style={{
                        padding: "3px 8px", borderRadius: 5, cursor: anomalyPage === totalPages - 1 ? "default" : "pointer",
                        fontSize: 9, fontWeight: 700, border: "1px solid",
                        borderColor: anomalyPage === totalPages - 1 ? "rgba(0,200,180,0.1)" : "rgba(0,200,180,0.25)",
                        background: "transparent",
                        color: anomalyPage === totalPages - 1 ? "#1a3a48" : "#2a8070",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* ── CENTER: 3 panels ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

          {/* ── Hardware Fault Banner ── */}
          {faultedSensors.length > 0 && (
            <div style={{
              flexShrink: 0, borderRadius: 8, padding: "8px 14px",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.35)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                  Hardware Fault Detected
                </div>
                <div style={{ fontSize: 9, color: "#c05050", fontFamily: "monospace", lineHeight: 1.5 }}>
                  {faultedSensors.map(m => (
                    <span key={m.key} style={{
                      display: "inline-block", marginRight: 8, padding: "1px 6px",
                      borderRadius: 3, background: "rgba(248,113,113,0.12)",
                      border: "1px solid rgba(248,113,113,0.2)",
                    }}>
                      {m.icon} {m.label}
                    </span>
                  ))}
                  <span style={{ marginLeft: 4, color: "#7a3030" }}>— no valid reading</span>
                </div>
              </div>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f87171", boxShadow: "0 0 8px #f87171", flexShrink: 0 }} />
            </div>
          )}

          {/* Chart 1 — Temperature + Humidity dual-line with time range selector */}
          <div style={{
            flex: 2.2, minHeight: 0, borderRadius: 10, padding: "10px 12px",
            border: "1px solid rgba(0,200,180,0.1)", background: "rgba(0,200,180,0.025)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5, flexShrink: 0, gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#1a5060", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                🌡 Temp &amp; 💧 Humidity
              </span>
              {/* Time range buttons */}
              <div style={{ display: "flex", gap: 3 }}>
                {TIME_RANGES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setEnvRange(r.value)}
                    style={{
                      padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                      fontSize: 9, fontWeight: 700, border: "1px solid",
                      borderColor: envRange === r.value ? "#00d4aa" : "rgba(0,200,180,0.2)",
                      background: envRange === r.value ? "rgba(0,212,170,0.15)" : "transparent",
                      color: envRange === r.value ? "#00d4aa" : "#2a6070",
                      transition: "all 0.15s",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date inputs */}
            {envRange === "custom" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexShrink: 0, alignItems: "center" }}>
                <input type="datetime-local" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  style={{ flex: 1, padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(0,200,180,0.2)", background: "rgba(0,20,40,0.6)", color: "#7ab0c0", fontSize: 10, outline: "none" }} />
                <span style={{ color: "#2a5060", fontSize: 10 }}>→</span>
                <input type="datetime-local" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  style={{ flex: 1, padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(0,200,180,0.2)", background: "rgba(0,20,40,0.6)", color: "#7ab0c0", fontSize: 10, outline: "none" }} />
                <button onClick={handleApplyCustom}
                  style={{ padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontSize: 9, fontWeight: 700, border: "1px solid #00d4aa", background: "rgba(0,212,170,0.15)", color: "#00d4aa" }}>
                  Apply
                </button>
              </div>
            )}

            {/* Dual-axis line chart */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={envChartData} margin={{ top: 4, right: 12, bottom: 0, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#1a5060", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="temp"  orientation="left"  tick={{ fontSize: 9, fill: "#f87171aa", fontFamily: "monospace" }} tickLine={false} axisLine={false} width={30} unit="°" />
                  <YAxis yAxisId="humid" orientation="right" tick={{ fontSize: 9, fill: "#38bdf8aa", fontFamily: "monospace" }} tickLine={false} axisLine={false} width={28} unit="%" />
                  <Tooltip
                    contentStyle={{ background: "#060f20", border: "1px solid rgba(0,200,180,0.3)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }}
                    labelStyle={{ color: "#2a7080" }}
                    formatter={(v, name) => name === "temp" ? [`${v}°C`, "Temperature"] : [`${v}%`, "Humidity"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 9, fontFamily: "monospace", paddingTop: 2 }}
                    formatter={name => name === "temp" ? "🌡 Temp (°C)" : "💧 Humidity (%)"} />
                  <Line yAxisId="temp"  type="monotone" dataKey="temp"  stroke="#f87171" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#f87171" }} />
                  <Line yAxisId="humid" type="monotone" dataKey="humid" stroke="#38bdf8" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#38bdf8" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2 — Shelf Weight, past 24h */}
          <div style={{
            flex: 1.4, minHeight: 0, borderRadius: 10, padding: "10px 12px",
            border: "1px solid rgba(0,200,180,0.1)", background: "rgba(0,200,180,0.025)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#1a5060", textTransform: "uppercase" }}>
                ⚖️ Shelf Weight · Past 24h
              </span>
              {histories.weight?.stats && (
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#2a5060" }}>
                  <span style={{ color: "#38bdf8" }}>MIN</span> {histories.weight.stats.min}g
                  <span style={{ color: "#34d399", marginLeft: 10 }}>AVG</span> {histories.weight.stats.avg}g
                  <span style={{ color: "#f87171", marginLeft: 10 }}>MAX</span> {histories.weight.stats.max}g
                </span>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightChartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#1a5060", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#1a5060", fontFamily: "monospace" }} tickLine={false} axisLine={false} width={36} unit="g" />
                  <Tooltip
                    contentStyle={{ background: "#060f20", border: "1px solid rgba(0,200,180,0.3)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }}
                    labelStyle={{ color: "#2a7080" }}
                    formatter={v => [`${v}g`, "Weight"]}
                  />
                  <Area type="monotone" dataKey="v" stroke="#34d399" strokeWidth={1.5} fill="url(#wg)" dot={false} activeDot={{ r: 3, fill: "#34d399" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Panel 3 — Estimated Shelf Life Remaining (2 progress bars) */}
          <div style={{
            flex: 0.9, minHeight: 0, borderRadius: 10, padding: "12px 16px",
            border: "1px solid rgba(0,200,180,0.1)", background: "rgba(0,200,180,0.025)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#1a5060", textTransform: "uppercase", marginBottom: 12, flexShrink: 0 }}>
              🕐 Estimated Shelf Life Remaining
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
              <ShelfLifeBar label="🧪 Gas (TVOC)"        pct={tvocPct}   detail={tvocDetail}  />
              <ShelfLifeBar label="🎨 Color (Brown Index)" pct={colorPct} detail={colorDetail} />
            </div>
          </div>

        </div>

        {/* ── RIGHT: Status panels ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>

          {/* Alert Status */}
          <div style={{ borderRadius: 10, border: "1px solid rgba(0,200,180,0.1)", background: "rgba(2,12,28,0.7)", padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#0e3040", textTransform: "uppercase", marginBottom: 10 }}>
              Alert Status
            </div>
            <AlertRow
              icon="🌡" label="Temperature"
              isActive={isSystemAlert}
              activeColor={tempStatus === "DANGER" ? "#ff4444" : tempStatus === "LOW" ? "#38bdf8" : "#f87171"}
              badge={isSystemAlert ? tempStatus : "NORMAL"}
              hint={tempStatus === "DANGER"
                ? "Temperature critical · Fan + Buzzer triggered"
                : tempStatus === "LOW"
                ? "Temperature below min threshold · Risk of freezing"
                : "Temperature above max threshold · Check cooling"}
            />
            <AlertRow
              icon="💧" label="Humidity"
              isActive={isHumidAlert}
              activeColor="#60a5fa"
              badge={isHumidAlert ? humidStatus : "NORMAL"}
              hint={humidStatus === "TOO WET"
                ? "Humidity above max · Risk of mould / condensation"
                : "Humidity below min · Product may dry out"}
            />
            <AlertRow
              icon="📦" label="Stock Level"
              isActive={isLowStock}
              activeColor="#fbbf24"
              badge={isLowStock ? "LOW STOCK" : "SUFFICIENT"}
              hint="Weight below threshold · Restock required · Sleep mode active"
            />
            <AlertRow
              icon="💨" label="Air Quality"
              isActive={isBadAir}
              activeColor={tvocStatus === "SEVERE AIR" ? "#f87171" : "#fbbf24"}
              badge={isBadAir ? tvocStatus : "NORMAL"}
              hint={tvocStatus === "SEVERE AIR"
                ? "TVOC critical · Buzzer alarm triggered"
                : "TVOC elevated · Ventilation fan active"}
            />
          </div>

          {/* Device Status */}
          <div style={{ borderRadius: 10, border: "1px solid rgba(0,200,180,0.1)", background: "rgba(2,12,28,0.7)", padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#0e3040", textTransform: "uppercase", marginBottom: 10 }}>
              Device Control
            </div>
            <ActuatorRow icon="🌀" label="Cooling Fan"  isOn={act.fan    === "ON"} />
            <ActuatorRow icon="💡" label="Status LED"   isOn={act.led    === "ON"} />
            <ActuatorRow icon="🔊" label="Alarm Buzzer" isOn={act.buzzer === "ON"} />
          </div>

          {/* Freshness Summary */}
          <div style={{ borderRadius: 10, border: "1px solid rgba(0,200,180,0.1)", background: "rgba(2,12,28,0.7)", padding: "12px 14px", flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#0e3040", textTransform: "uppercase", marginBottom: 10 }}>
              Freshness Summary
            </div>
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", color: freshClr, letterSpacing: "0.1em", textShadow: `0 0 20px ${freshClr}60` }}>
                {freshness}
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
                {[
                  { label: "Brown Index", value: typeof brownIdx === "number" ? brownIdx.toFixed(3) : "--", color: "#c084fc" },
                  { label: "TVOC Level",  value: tvocLevel < 0 ? "N/A" : `${tvocLevel} / 4`,              color: "#c084fc" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: 11, color: "#3a6070" }}>{item.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
