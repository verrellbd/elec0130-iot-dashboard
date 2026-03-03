"use client";

export default function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1d26] text-white px-5 py-2.5 rounded-xl text-[13px] font-medium shadow-[0_8px_24px_rgba(0,0,0,0.1)] z-50 toast-enter whitespace-nowrap">
      {message}
    </div>
  );
}
