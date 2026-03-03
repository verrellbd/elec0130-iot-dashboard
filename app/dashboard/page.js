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

  const fetchLatest = useCallback(async () => {
    try {
      const data = await getLatestReadings();
      setLatest(data);
      setConnected(true);
      setLastUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      if (data.temperature.status === "HIGH" || data.temperature.status === "LOW") {
        setAlertMsg(`Temperature ${data.temperature.value}°C — ${data.temperature.status}!`);
      } else if (data.gas.status === "SPOILED" || data.gas.status === "REMOVE") {
        setAlertMsg(`TVOC ${data.gas.value} ppb — ${data.gas.status}!`);
      } else if (data.weight.status === "EMPTY") {
        setAlertMsg(`Shelf EMPTY (${data.weight.value}g) — Restock needed!`);
      }
    } catch {
      setConnected(false);
    }
  }, []);

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

  useEffect(() => { fetchHistories(); }, [timeRange, fetchHistories]);

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

  return (
    <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-[#f5f7fa]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <TopBar connected={connected} />
      <AlertBanner message={alertMsg} onClose={() => setAlertMsg(null)} />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

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