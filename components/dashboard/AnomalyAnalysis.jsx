// components/dashboard/AnomalyAnalysis.jsx
const STATUS_STYLE = {
  CRITICAL: { badge: "bg-red-50 text-red-600" },
  WARNING:  { badge: "bg-amber-50 text-amber-600" },
  NORMAL:   { badge: "bg-emerald-50 text-emerald-600" },
};

export default function AnomalyAnalysis({ stats }) {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#e4e8ee] p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[#1a1d26] mb-4 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-red-500 rounded-full"></span>
        Anomaly Events Summary
      </h3>

      <div className="space-y-4">
        {stats.map((item) => {
          const s = STATUS_STYLE[item.status] || STATUS_STYLE.NORMAL;
          return (
            <div key={item.type} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                <div>
                  <div className="text-[13px] font-semibold text-gray-700">{item.type}</div>
                  <div className="text-[11px] text-gray-400">Frequency: {item.freq}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[#1a1d26]">+{item.count}</div>
                <div className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${s.badge}`}>
                  {item.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
