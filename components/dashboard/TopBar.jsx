"use client";

export default function TopBar({ connected }) {
  return (
    <header className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-[#e4e8ee] sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-[9px] bg-[#00c48c] flex items-center justify-center text-base shadow-[0_2px_8px_rgba(0,196,140,0.3)]">
          🛒
        </div>
        <div>
          <span className="text-base font-bold tracking-tight">SmartShelf</span>
          <span className="text-[13px] text-[#8b93a7] font-normal ml-1.5">Store 01</span>
        </div>
      </div>
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
          connected
            ? "bg-[#e6faf3] border-[rgba(0,196,140,0.2)] text-[#00a074]"
            : "bg-[#fff0f0] border-[rgba(255,92,92,0.2)] text-[#ff5c5c]"
        }`}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div
          className={`w-[7px] h-[7px] rounded-full ${
            connected
              ? "bg-[#00c48c] shadow-[0_0_6px_rgba(0,196,140,0.5)] animate-pulse-dot"
              : "bg-[#ff5c5c]"
          }`}
        />
        {connected ? "Online" : "Offline"}
      </div>
    </header>
  );
}