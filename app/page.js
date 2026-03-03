"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticate } from "@/lib/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const user = authenticate(username, password);
      if (user) {
        // Store user in sessionStorage (resets on tab close)
        sessionStorage.setItem("smartshelf_user", JSON.stringify(user));
        router.push("/dashboard");
      } else {
        setError("Invalid username or password");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#00c48c] flex items-center justify-center text-3xl mx-auto mb-4 shadow-[0_4px_16px_rgba(0,196,140,0.3)]">
            🛒
          </div>
          <h1 className="text-2xl font-bold text-[#1a1d26] tracking-tight">SmartShelf</h1>
          <p className="text-[13px] text-[#8b93a7] mt-1">IoT Monitoring Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-[#e4e8ee] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <h2 className="text-[15px] font-semibold text-[#1a1d26] mb-5">Sign in to your account</h2>

          <form onSubmit={handleLogin}>
            {/* Username */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#5a6175] mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-4 py-3 rounded-xl border border-[#e4e8ee] bg-[#f5f7fa] text-[14px] text-[#1a1d26] outline-none focus:border-[#00c48c] focus:bg-white transition-colors placeholder:text-[#8b93a7]"
              />
            </div>

            {/* Password */}
            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[#5a6175] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-xl border border-[#e4e8ee] bg-[#f5f7fa] text-[14px] text-[#1a1d26] outline-none focus:border-[#00c48c] focus:bg-white transition-colors placeholder:text-[#8b93a7]"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-[#fff0f0] border border-[rgba(255,92,92,0.15)] text-[12px] text-[#ff5c5c] font-medium">
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3 rounded-xl text-[14px] font-semibold bg-[#00c48c] text-white shadow-[0_4px_12px_rgba(0,196,140,0.3)] hover:bg-[#00a074] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-5 pt-4 border-t border-[#e4e8ee]">
            <p className="text-[11px] text-[#8b93a7] mb-2 font-medium">Demo accounts:</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setUsername("admin"); setPassword("admin123"); }}
                className="flex-1 py-2 rounded-lg bg-[#f5f7fa] border border-[#e4e8ee] text-[11px] text-[#5a6175] font-medium hover:border-[#00c48c] transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                admin / admin123
              </button>
              <button
                onClick={() => { setUsername("viewer"); setPassword("viewer123"); }}
                className="flex-1 py-2 rounded-lg bg-[#f5f7fa] border border-[#e4e8ee] text-[11px] text-[#5a6175] font-medium hover:border-[#00c48c] transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                viewer / viewer123
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}