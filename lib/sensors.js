export const SENSORS = [
  { key: "temperature", name: "Temperature", subtitle: "MKR ENV Shield", unit: "°C", icon: "🌡", color: "#ff5c5c", bgColor: "rgba(255,92,92,0.1)", lightColor: "#fff0f0", active: true, realtimeStyle: "bignumber", range: { min: -5, max: 50 } },
  { key: "humidity", name: "Humidity", subtitle: "MKR ENV Shield", unit: "%", icon: "💧", color: "#4d9fff", bgColor: "rgba(77,159,255,0.1)", lightColor: "#eef5ff", active: true, realtimeStyle: "gauge", range: { min: 0, max: 100 } },
  { key: "weight", name: "Shelf Weight", subtitle: "Load Cell · HX711", unit: "g", icon: "⚖️", color: "#00c48c", bgColor: "rgba(0,196,140,0.1)", lightColor: "#e6faf3", active: true, realtimeStyle: "bignumber", range: { min: 0, max: 5000 } },
  { key: "tvoc_level", name: "TVOC Level", subtitle: "Gas Sensor · UART", unit: "Lv", icon: "🧪", color: "#8b5cf6", bgColor: "rgba(139,92,246,0.1)", lightColor: "#f3f0ff", active: true, realtimeStyle: "gauge", range: { min: 0, max: 5 } },
  { key: "illuminance", name: "Light", subtitle: "MKR ENV Shield", unit: "lux", icon: "☀️", color: "#ff9f43", bgColor: "rgba(255,159,67,0.1)", lightColor: "#fff5eb", active: true, realtimeStyle: "bignumber", range: { min: 0, max: 1000 } },
  { key: "freshness", name: "Freshness", subtitle: "TCS34725 · RGB Sensor", unit: "", icon: "🎨", color: "#00c48c", bgColor: "rgba(0,196,140,0.1)", lightColor: "#e6faf3", active: true, realtimeStyle: "bignumber",  range: { min: 0, max: 100 } 
},
];

export const ACTIVE_SENSORS = SENSORS.filter((s) => s.active);

const STATUS_STYLES = {
  NORMAL:      { label: "Normal",         className: "bg-emerald-50 text-emerald-600" },
  OK:          { label: "OK",             className: "bg-emerald-50 text-emerald-600" },
  FRESH:       { label: "Fresh",          className: "bg-emerald-50 text-emerald-600" },
  STORE_OPEN:  { label: "Store Open",     className: "bg-emerald-50 text-emerald-600" },
  HIGH:        { label: "Too High",       className: "bg-red-50 text-red-500" },
  LOW:         { label: "Too Low",        className: "bg-red-50 text-red-500" },
  OUT_OF_RANGE:{ label: "Out of Range",   className: "bg-red-50 text-red-500" },
  ENERGY_SAVE: { label: "Energy Save",    className: "bg-amber-50 text-amber-500" },
  AGING:       { label: "Aging",          className: "bg-amber-50 text-amber-500" },
  REMOVE:      { label: "Remove Item",    className: "bg-red-50 text-red-500" },
  SPOILED:     { label: "Spoiled",        className: "bg-red-50 text-red-500" },
  EMPTY:       { label: "Empty — Restock", className: "bg-red-50 text-red-500" },
  LOW_STOCK:   { label: "Low Stock",      className: "bg-amber-50 text-amber-500" },
  DANGER:      { label: "Danger",         className: "bg-red-50 text-red-500" },
  WARNING:     { label: "Warning",        className: "bg-amber-50 text-amber-500" },
  GOOD:        { label: "Good",           className: "bg-emerald-50 text-emerald-600" },
  DARK:        { label: "Dark",           className: "bg-amber-50 text-amber-500" },
};

export function getStatusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.NORMAL;
}