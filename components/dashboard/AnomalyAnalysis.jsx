// components/dashboard/AnomalyAnalysis.jsx
export default function AnomalyAnalysis({ alerts }) {
  // Simulate abnormal data from a database
  const stats = [
    { label: "TVOC Level 3/4", count: 15, freq: "1.5 times/hour", status: "Critical" },
    { label: "Low Stock (<100g)", count: 3, freq: "0.3 times/hour", status: "Warning" },
    { label: "Temp Fluctuation", count: 22, freq: "2.2 times/hour", status: "Normal" },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#e4e8ee] p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[#1a1d26] mb-4 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-red-500 rounded-full"></span>
        Anomaly Events Summary
      </h3>
      
      <div className="space-y-4">
        {stats.map((item) => (
          <div key={item.label} className="flex items-center justify-between border-b border-gray-50 pb-3">
            <div>
              <div className="text-[13px] font-semibold text-gray-700">{item.label}</div>
              <div className="text-[11px] text-gray-400">Frequency: {item.freq}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-red-500">+{item.count}</div>
              <div className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold uppercase">
                {item.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}