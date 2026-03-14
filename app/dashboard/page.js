"use client";

import { useState, useEffect, useCallback } from "react";
import { getLatestReadings, getHistory, updateThresholds, getDefaultThresholds, exportCSV, getThresholds } from "@/lib/dashboard-api";
import {ACTIVE_SENSORS} from "@/lib/sensors";
import TopBar from "@/components/dashboard/TopBar";
import AlertBanner from "@/components/dashboard/AlertBanner";
import TabNav from "@/components/dashboard/TabNav";
import MonitorTab from "@/components/dashboard/MonitorTab";
import ThresholdPanel from "@/components/dashboard/ThresholdPanel";
import Toast from "@/components/dashboard/Toast";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/auth";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("monitor");
  const [timeRange, setTimeRange] = useState("realtime");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [latest, setLatest] = useState(null);
  const [histories, setHistories] = useState({});
  const [thresholds, setThresholds] = useState(getDefaultThresholds());
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("--");
  const [toast, setToast] = useState({ message: "", visible: false });
  const [alertMsg, setAlertMsg] = useState(null);
  const router = useRouter();
  const [user, setUser] = useState(null);

  // Check login on page load
  useEffect(() => {
    const stored = sessionStorage.getItem("smartshelf_user");
    if (!stored) {
      router.push("/");
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  const fetchLatest = useCallback(async () => {
    try {
      const data = await getLatestReadings(thresholds);
      setLatest(data);

      // Online only if last reading is fresher than 30s
      const ageMs = Date.now() - new Date(data.timestamp).getTime();
      const isOnline = ageMs < 30000;
      setConnected(isOnline);

      setLastUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

      // Alert conditions
      if (isOnline) {
        if (data.temperature?.status === "HIGH" || data.temperature?.status === "LOW") {
          setAlertMsg(`Temperature ${data.temperature.value}°C — ${data.temperature.status}!`);
        } else if (data.tvoc_level?.status === "DANGER") {
          setAlertMsg(`TVOC Level ${data.tvoc_level.value} — DANGER!`);
        } else if (data.weight?.status === "LOW_STOCK") {
          setAlertMsg(`Low Stock (${data.weight.value}g) — Restock needed!`);
        } else if (data.freshness?.status === "SPOILED") {
          setAlertMsg(`Freshness SPOILED — Remove item!`);
        } else {
          setAlertMsg(null);
        }
      } else {
        setAlertMsg(null); // clear alert when offline
      }
    } catch {
      setConnected(false);
    }
  }, [thresholds]);

  const fetchHistories = useCallback(async () => {
    const results = {};
    await Promise.all(
      ACTIVE_SENSORS.map(async (s) => {
        try { results[s.key] = await getHistory(s.key, timeRange, customFrom, customTo); } catch {}
      })
    );
    setHistories((prev) => ({ ...prev, ...results }));
  }, [timeRange, customFrom, customTo]);

  useEffect(() => {
    fetchLatest();
    fetchHistories();
    getThresholds().then(setThresholds).catch(() => {});
    const timer = setInterval(() => {
      fetchLatest();
      if (activeTab === "monitor") fetchHistories();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchLatest, fetchHistories, activeTab]);

  useEffect(() => {
    // Clear old history when switching time range
    setHistories({});
    fetchHistories();
  }, [timeRange, fetchHistories]);
  
  const showToast = (msg) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  };

  const handleSave = async () => {
    try { await updateThresholds(thresholds); showToast("✅ Thresholds saved & pushed via MQTT"); }
    catch { showToast("❌ Failed to save"); }
  };

  const handleReset = () => {
    setThresholds(getDefaultThresholds());
    showToast("Thresholds reset to defaults");
  };

  const handleExport = async () => {
    try {
      const csv = await exportCSV(timeRange);
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `smartshelf_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      showToast("CSV downloaded");
    } catch { showToast("Export failed"); }
  };

  const handleApplyCustom = () => {
    if (customFrom && customTo) { fetchHistories(); showToast("Custom range applied"); }
  };

  if (!user) return null;

  return (
    <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-[#f5f7fa]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <TopBar connected={connected} user={user} onLogout={() => {
        sessionStorage.removeItem("smartshelf_user");
        router.push("/");
        }} />
      <AlertBanner message={alertMsg} onClose={() => setAlertMsg(null)} />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} showSettings={isAdmin(user)} />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-6">
        {activeTab === "monitor" && (
          <MonitorTab
            latest={latest}
            histories={histories}
            timeRange={timeRange}
            onTimeChange={setTimeRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onApplyCustom={handleApplyCustom}
            lastUpdated={lastUpdated}
            onExport={handleExport}
            thresholds={thresholds}
            connected={connected}
          />
        )}
        {activeTab === "settings" && (
          <ThresholdPanel
            thresholds={thresholds}
            onChange={setThresholds}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
      </main>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}