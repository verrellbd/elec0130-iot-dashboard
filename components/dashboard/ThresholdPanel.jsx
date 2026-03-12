"use client";

const SECTIONS = [
  {
    title: "Temperature",
    icon: "🌡",
    iconBg: "#fff0f0",
    name: "Temperature Range",
    fields: [
      { label: "Min Threshold", path: ["temperature", "min"], unit: "°C", step: 0.5 },
      { label: "Max Threshold", path: ["temperature", "max"], unit: "°C", step: 0.5 },
      { label: "Danger Threshold", path: ["temperature", "danger"], unit: "°C", step: 0.5 },
    ],
  },
  {
    title: "Humidity",
    icon: "💧",
    iconBg: "#eef5ff",
    name: "Humidity Range",
    fields: [
      { label: "Min Threshold", path: ["humidity", "min"], unit: "%", step: 1 },
      { label: "Max Threshold", path: ["humidity", "max"], unit: "%", step: 1 },
    ],
  },
  {
    title: "Inventory",
    icon: "⚖️",
    iconBg: "#e6faf3",
    name: "Weight Sensor",
    fields: [
      { label: "Low Stock Below", path: ["weight", "low_stock"], unit: "g", step: 50 },
    ],
  },
  {
    title: "Air Quality",
    icon: "🧪",
    iconBg: "#f3f0ff",
    name: "TVOC Gas Sensor",
    fields: [
      { label: "Fan On At Level",    path: ["tvoc", "fan_threshold"],    unit: "Lv", step: 1 },
      { label: "Buzzer At Level",    path: ["tvoc", "buzzer_threshold"], unit: "Lv", step: 1 },
    ],
  },
  {
    title: "Lighting",
    icon: "☀️",
    iconBg: "#fff5eb",
    name: "Light Sensor",
    fields: [
      { label: "Too Dark Below", path: ["light", "threshold"], unit: "lux", step: 1 },
    ],
  },
  {
    title: "Freshness",
    icon: "🎨",
    iconBg: "#e6faf3",
    name: "RGB Color Sensor",
    fields: [
      { label: "Aging Above",   path: ["freshness", "aging_threshold"],   unit: "bi",  step: 0.01 },
      { label: "Spoiled Above", path: ["freshness", "spoiled_threshold"], unit: "bi",  step: 0.01 },
    ],
  },
];

function getVal(obj, path) {
  let c = obj;
  for (const k of path) c = c?.[k];
  return c;
}

function setVal(obj, path, val) {
  const clone = JSON.parse(JSON.stringify(obj));
  let c = clone;
  for (let i = 0; i < path.length - 1; i++) c = c[path[i]];
  c[path[path.length - 1]] = val;
  return clone;
}

export default function ThresholdPanel({ thresholds, onChange, onSave, onReset }) {
  const handleChange = (path, val) => onChange(setVal(thresholds, path, val));

  let lastTitle = "";

  return (
    <div className="pb-24">
      {SECTIONS.map((sec, si) => {
        const showTitle = sec.title && sec.title !== lastTitle;
        if (sec.title) lastTitle = sec.title;

        return (
          <div key={si}>
            {showTitle && (
              <div className="text-[11px] font-semibold text-[#8b93a7] uppercase tracking-widest mb-2.5 pl-1 mt-5 first:mt-0">
                {sec.title}
              </div>
            )}
            <div className="bg-white rounded-xl border border-[#e4e8ee] p-4 mb-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-3.5">
                <div
                  className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[14px]"
                  style={{ background: sec.iconBg }}
                >
                  {sec.icon}
                </div>
                <div className="flex-1 text-[13px] font-semibold text-[#1a1d26]">
                  {sec.name}
                </div>
              </div>

              {/* Fields */}
              {sec.fields.map((f, fi) => (
                <div
                  key={fi}
                  className={`flex items-center justify-between py-2 ${
                    fi > 0 ? "border-t border-[#e4e8ee]" : ""
                  }`}
                >
                  <span className="text-[12px] text-[#5a6175] font-medium">{f.label}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={getVal(thresholds, f.path) ?? 0}
                      step={f.step}
                      onChange={(e) =>
                        handleChange(f.path, parseFloat(e.target.value) || 0)
                      }
                      className="w-[70px] px-2.5 py-1.5 border border-[#e4e8ee] rounded-lg text-[13px] font-medium text-center text-[#1a1d26] bg-[#f0f2f5] outline-none focus:border-[#00c48c] focus:bg-white transition-colors"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    />
                    <span
                      className="text-[11px] text-[#8b93a7] min-w-[28px]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {f.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Footer buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4e8ee] p-3 flex gap-2.5 max-w-[480px] mx-auto z-30">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-lg text-[13px] font-semibold bg-[#f0f2f5] text-[#5a6175] border border-[#e4e8ee] hover:bg-[#e4e8ee] transition-colors"
        >
          Reset Default
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-3 rounded-lg text-[13px] font-semibold bg-[#00c48c] text-white shadow-[0_2px_8px_rgba(0,196,140,0.3)] hover:bg-[#00a074] transition-colors"
        >
          Save & Push to Device
        </button>
      </div>
    </div>
  );
}