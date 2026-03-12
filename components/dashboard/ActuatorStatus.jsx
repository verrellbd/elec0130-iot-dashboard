"use client";

export default function ActuatorStatus({ latest }) {
  const actuators = latest?._actuators || { led: "OFF", fan: "OFF", buzzer: "OFF", alert: false, lowStock: false, badAir: false };

  const items = [
    { name: "LED", icon: "💡", state: actuators.led, onColor: "#ff9f43", offColor: "#d1d7e0" },
    { name: "Fan", icon: "🌀", state: actuators.fan, onColor: "#4d9fff", offColor: "#d1d7e0" },
    { name: "Buzzer", icon: "🔔", state: actuators.buzzer, onColor: "#ff5c5c", offColor: "#d1d7e0" },
  ];

  const flags = [
    { name: "Alert", active: actuators.alert },
    { name: "Low Stock", active: actuators.lowStock },
    { name: "Bad Air", active: actuators.badAir },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#e4e8ee] p-4 mb-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[17px] bg-[#f0f2f5]">
          ⚡
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[#1a1d26]">Actuator Status</div>
          <div className="text-[11px] text-[#8b93a7]">LED · Fan · Buzzer</div>
        </div>
      </div>

      {/* Actuator indicators */}
      <div className="flex gap-2 mb-3">
        {items.map((item) => {
          const isOn = item.state === "ON";
          return (
            <div
              key={item.name}
              className="flex-1 rounded-lg p-3 text-center border transition-all"
              style={{
                background: isOn ? item.onColor + "15" : "#f5f7fa",
                borderColor: isOn ? item.onColor + "40" : "#e4e8ee",
              }}
            >
              <div className="text-[20px] mb-1">{item.icon}</div>
              <div className="text-[11px] font-semibold text-[#1a1d26]">{item.name}</div>
              <div
                className="text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full inline-block"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  background: isOn ? item.onColor + "20" : "#e4e8ee",
                  color: isOn ? item.onColor : "#8b93a7",
                }}
              >
                {isOn ? "ON" : "OFF"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert flags */}
      <div className="flex gap-1.5 pt-2.5 border-t border-[#e4e8ee]">
        {flags.map((flag) => (
          <div
            key={flag.name}
            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-semibold ${
              flag.active
                ? "bg-red-50 text-red-500"
                : "bg-[#f5f7fa] text-[#8b93a7]"
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {flag.active ? "⚠ " : ""}{flag.name}
          </div>
        ))}
      </div>
    </div>
  );
}