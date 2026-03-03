"use client";

export default function AlertBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#fff0f0] border-b border-[rgba(255,92,92,0.15)] text-[12px] text-[#ff5c5c] font-medium">
      <span>⚠️</span>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 text-[16px]">
        ✕
      </button>
    </div>
  );
}