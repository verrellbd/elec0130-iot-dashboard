"use client";

const TABS = [
  { key: "monitor", icon: "📊", label: "Monitor" },
  { key: "settings", icon: "⚙️", label: "Thresholds" },
];

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <nav className="flex bg-white border-b border-[#e4e8ee] px-5 sticky top-[53px] z-20">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 py-3 text-[13px] font-semibold text-center relative transition-colors ${
            activeTab === tab.key ? "text-[#00a074]" : "text-[#8b93a7] hover:text-[#5a6175]"
          }`}
        >
          <span className="mr-1.5">{tab.icon}</span>
          {tab.label}
          {activeTab === tab.key && (
            <span className="absolute bottom-0 left-[15%] right-[15%] h-[2.5px] bg-[#00c48c] rounded-t" />
          )}
        </button>
      ))}
    </nav>
  );
}