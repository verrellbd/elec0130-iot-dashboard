"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

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
import ActuatorCard from "@/components/dashboard/ActuatorCard";
import AnomalyAnalysis from "@/components/dashboard/AnomalyAnalysis";

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

  const [actuators, setActuators] = useState({ fan: "OFF", led: "OFF", buzzer: "OFF" });
  const [anomalyStats, setAnomalyStats] = useState([
    { type: "TVOC Level 3/4", count: 0, icon: "🧪" },
    { type: "Temp Alert", count: 0, icon: "🌡️" },
    { type: "Low Stock", count: 0, icon: "⚖️" }
  ]);
  

  const handleCommand = async (device) => {
    console.log("click device", device); 

    // Step 1: Update the local UI status immediately (regardless of API)
    const nextStatus = actuators[device] === "ON" ? "OFF" : "ON";
    setActuators(prev => ({ ...prev, [device]: nextStatus }));

    // Step 2: Silently request the server
    try {
      const res = await fetch(`${API_URL}/command`, {
        method: "POST",
        headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ device, action: nextStatus })
      });
      
      if (!res.ok) throw new Error("API call failed");
    } catch (err) {
      // If the request fails, revert the switch and show an error
      setActuators(prev => ({ ...prev, [device]: nextStatus === "ON" ? "OFF" : "ON" }));
      setAlertMsg(`Failed to control ${device}: ${err.message}`);
    }
  };



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
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchLatest, fetchHistories, activeTab]);

  useEffect(() => {
    // Clear old history when switching time range
    setHistories({});
    fetchHistories();
  }, [timeRange, fetchHistories]);

  
  useEffect(() => {
    if (!histories || Object.keys(histories).length === 0) return;

    const calculateStats = () => {
      // 1. Get Time Spans (hours)
      //Assuming that all historical data have the same time span, we take the temperature data to calculate
      const tempData = histories.temperature?.data || [];
      if (tempData.length < 2) return;
      
      const startTime = new Date(tempData[0].timestamp).getTime();
      const endTime = new Date(tempData[tempData.length - 1].timestamp).getTime();
      const hoursSpan = Math.max((endTime - startTime) / (1000 * 60 * 60), 1);

      // 2. Define anomaly counters
      let counts = { temp: 0, weight: 0, gas: 0, humidity: 0 };

      // 3. Iterate through data for statistics
      // Count temperature anomalies (>20 or <12)
      histories.temperature?.data?.forEach(d => {
        if (d.value > 20 || d.value < 12) counts.temp++;
      });

      // Count weight anomalies (<100)
      histories.weight?.data?.forEach(d => {
        if (d.value < 100) counts.weight++;
      });

      // Count gas/TVOC anomalies (Level 3/4 Assume the corresponding value. > 150)
      histories.gas?.data?.forEach(d => {
        if (d.value > 150) counts.gas++; 
      });

      // Count humidity anomalies (>80)
      histories.humidity?.data?.forEach(d => {
        if (d.value > 80) counts.humidity++;
      });

      // 4. Update status
      setAnomalyStats([
        { 
          type: "Temp Alert (>20°C / <12°C)", 
          count: counts.temp, 
          freq: `${(counts.temp / hoursSpan).toFixed(1)} times/hour`,
          icon: "🌡️",
          status: counts.temp > 10 ? "CRITICAL" : "NORMAL"
        },
        { 
          type: "Low Stock (<100g)", 
          count: counts.weight, 
          freq: `${(counts.weight / hoursSpan).toFixed(1)} times/hour`,
          icon: "⚖️",
          status: counts.weight > 5 ? "WARNING" : "NORMAL"
        },
        { 
          type: "TVOC Level 3/4", 
          count: counts.gas, 
          freq: `${(counts.gas / hoursSpan).toFixed(1)} times/hour`,
          icon: "🧪",
          status: counts.gas > 0 ? "CRITICAL" : "NORMAL"
        }
      ]);
    };

    calculateStats();
  }, [histories]); // When historical data is updated, recalculate






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
          <div className="space-y-6"> 
            
            {/* 1. Sensors */}
            <section>
              <h2 className="text-[14px] font-bold text-[#1a1d26] mb-3 px-1">Sensor Real-time</h2>
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
            </section>

            {/* 2. Actuators */}
            <section>
              <h2 className="text-[14px] font-bold text-[#1a1d26] mb-3 px-1">Device Control</h2>
              <div className="grid grid-cols-2 gap-3">
                <ActuatorCard 
                  name="Cooling Fan" 
                  icon="🌀" 
                  status={actuators.fan} 
                  onToggle={() => handleCommand("fan")} 
                />
                <ActuatorCard 
                  name="Status LED" 
                  icon="💡" 
                  status={actuators.led} 
                  onToggle={() => handleCommand("led")} 
                />
                <ActuatorCard 
                  name="Alarm Buzzer" 
                  icon="🔊" 
                  status={actuators.buzzer} 
                  onToggle={() => handleCommand("buzzer")} 
                />
              </div>
            </section>

            {/* 3. Anomalies */}
            <section>
              <h2 className="text-[14px] font-bold text-[#1a1d26] mb-3 px-1">Anomaly Insights</h2>
              <AnomalyAnalysis stats={anomalyStats} />
            </section>
            
          </div>
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

