"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

export default function DeviceControl({ latest }) {
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState({});

  // Use override state if toggled manually, otherwise use live data
  const getState = (key, field) => {
    if (overrides[key] !== undefined) return overrides[key] ? "ON" : "OFF";
    return latest?._actuators?.[field] || "OFF";
  };

  const actuators = latest?._actuators || { led: "OFF", fan: "OFF", buzzer: "OFF" };

  const devices = [
    { key: "fan",    name: "Cooling Fan",  icon: "🌀", field: "fan",    color: "#00c48c", bgColor: "#eef5ff" },
    { key: "led",    name: "Status LED",   icon: "💡", field: "led",    color: "#00c48c", bgColor: "#fff5eb" },
    { key: "buzzer", name: "Alarm Buzzer", icon: "🔔", field: "buzzer", color: "#00c48c", bgColor: "#f3f0ff" },
  ];

  const toggle = async (device) => {
    const currentState = getState(device.key, device.field);
    const turnOn = currentState !== "ON";

    setLoading((p) => ({ ...p, [device.key]: true }));
    setOverrides((p) => ({ ...p, [device.key]: turnOn }));

    try {
      await fetch(`${API_URL}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(API_KEY ? { "x-api-key": API_KEY } : {}),
        },
        body: JSON.stringify({
          action: turnOn ? `${device.key}_on` : `${device.key}_off`,
        }),
      });
    } catch (e) {
      console.error("Toggle failed:", e);
      // Revert override if API call failed
      setOverrides((p) => ({ ...p, [device.key]: !turnOn }));
    }

    setLoading((p) => ({ ...p, [device.key]: false }));
  };

  return (
    <div className="mb-3">
      <div className="text-[11px] font-semibold text-[#8b93a7] uppercase tracking-widest mb-2.5 pl-1">
        Device Control
      </div>
      <div className="grid grid-cols-2 gap-2">
        {devices.map((d, i) => {
          const isOn = getState(d.key, d.field) === "ON";
          const busy = loading[d.key];
          return (
            <div
              key={d.name}
              className={`bg-white rounded-xl border p-4 flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all ${
                i === 2 ? "col-span-1" : ""
              }`}
              style={{
                borderColor: isOn ? d.color + "40" : "#e4e8ee",
                background: isOn ? d.color + "08" : "#fff",
              }}
            >
              <div
                className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-[18px]"
                style={{ background: isOn ? d.color + "20" : "#f0f2f5" }}
              >
                {d.icon}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[#1a1d26]">{d.name}</div>
                <div
                  className="text-[11px] font-semibold mt-0.5"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: isOn ? d.color : "#8b93a7",
                  }}
                >
                  {busy ? "..." : isOn ? "ACTIVE" : "STANDBY"}
                </div>
              </div>
              <button
                onClick={() => toggle(d)}
                disabled={busy}
                className={`w-10 h-[22px] rounded-full relative transition-colors ${
                  busy ? "opacity-50" : ""
                }`}
                style={{ background: isOn ? d.color : "#d1d7e0" }}
              >
                <div
                  className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
                    isOn ? "translate-x-[18px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}