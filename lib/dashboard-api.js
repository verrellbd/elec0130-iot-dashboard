const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const DEVICE_ID = process.env.NEXT_PUBLIC_DEVICE_ID || "ArduinoMKR1010";
const isConfigured = API_URL.length > 0 && !API_URL.includes("YOUR_API");
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

// ===== REAL API CALLS (your AWS endpoints) =====

export async function getLatestReadings() {
  if (isConfigured) {
    const res = await fetch(`${API_URL}/latest?device_id=${DEVICE_ID}`, {
        headers: { "x-api-key": API_KEY },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const raw = await res.json();
    return parseLatest(raw);
  }
  return simulateLatest();
}

export async function getHistory(sensorType, range, customFrom, customTo) {
  if (isConfigured) {
    let url = `${API_URL}/history?device_id=${DEVICE_ID}&type=${sensorType}&range=${range}`;
    if (range === "custom" && customFrom && customTo) url += `&from=${customFrom}&to=${customTo}`;
    const res = await fetch(url, {
        headers: { "x-api-key": API_KEY },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const raw = await res.json();
    return parseHistory(raw, sensorType);
  }
  return simulateHistory(sensorType, range);
}

export async function updateThresholds(thresholds) {
  if (isConfigured) {
    const res = await fetch(`${API_URL}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({
            action: "update_thresholds",
            thresholds: {
            temperature_min: thresholds.temperature.min,
            temperature_max: thresholds.temperature.max,
            humidity_min: thresholds.humidity.min,
            humidity_max: thresholds.humidity.max,
            },
        }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return;
  }
  await new Promise((r) => setTimeout(r, 800));
}

export async function exportCSV(range) {
  if (isConfigured) {
    const res = await fetch(`${API_URL}/history?device_id=${DEVICE_ID}&range=${range}&format=csv`, {
      headers: { "x-api-key": API_KEY },
    });
    return res.text();
  }
  return simulateCSV();
}

// ===== PARSE AWS RESPONSE =====

function parseLatest(raw) {
  const d = getDefaultThresholds();

  // Your API returns: { payload: { temperature, humidity, ... }, deviceId, timestamp }
  const data = raw.payload || raw;

  const temp = parseFloat(data.temperature ?? 0);
  const humid = parseFloat(data.humidity ?? 0);

  // AWS timestamp() returns milliseconds
  let ts = data.timestamp ?? raw.timestamp ?? Date.now();
  if (typeof ts === "number" || !isNaN(Number(ts))) {
    ts = new Date(Number(ts)).toISOString();
  }

  return {
    device_id: data.deviceId ?? raw.deviceId ?? DEVICE_ID,
    timestamp: ts,
    temperature: {
      value: Math.round(temp * 10) / 10,
      unit: "°C",
      status: temp > d.temperature.max ? "HIGH" : temp < d.temperature.min ? "LOW" : "NORMAL",
    },
    humidity: {
      value: Math.round(humid * 10) / 10,
      unit: "%",
      status: humid > d.humidity.max || humid < d.humidity.min ? "OUT_OF_RANGE" : "NORMAL",
    },
  };
}

function parseHistory(raw, sensorType) {
  const items = raw.data || raw || [];

  const data = items
    .map((item) => {
      const p = item.payload || item;
      const value = parseFloat(p[sensorType] ?? 0);
      const ts = p.timestamp || item.timestamp;
      // Only use real AWS timestamps (13+ digits), skip Arduino millis
      if (typeof ts === "number" && ts < 1000000000000) return null;
      return {
        timestamp: new Date(Number(ts)).toISOString(),
        value: Math.round(value * 10) / 10,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (data.length === 0) return { sensor_type: sensorType, range: "realtime", data: [], stats: { min: 0, max: 0, avg: 0 } };

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return {
    sensor_type: sensorType,
    range: "realtime",
    data: data,
    stats: {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
    },
  };
}

// ===== DEFAULT THRESHOLDS =====

export function getDefaultThresholds() {
  return {
    temperature: { enabled: true, min: 0, max: 5 },
    humidity: { enabled: true, min: 40, max: 75 },
  };
}

export async function getThresholds() {
  if (isConfigured) {
    const res = await fetch(`${API_URL}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ action: "get_thresholds" }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const t = data.thresholds || {};
    return {
      temperature: { enabled: true, min: t.temperature_min ?? 0, max: t.temperature_max ?? 5 },
      humidity: { enabled: true, min: t.humidity_min ?? 40, max: t.humidity_max ?? 75 },
    };
  }
  return getDefaultThresholds();
}

// ===== SIMULATION =====

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function round(v, d) { const f = 10 ** d; return Math.round(v * f) / f; }

const sim = { temp: 3.2, humid: 65.4, light: 420, gas: 85, weight: 2450 };

function simulateLatest() {
  sim.temp = clamp(sim.temp + (Math.random() - 0.48) * 0.3, -1, 8);
  sim.humid = clamp(sim.humid + (Math.random() - 0.5) * 1.5, 30, 90);
  sim.light = clamp(sim.light + (Math.random() - 0.5) * 20, 0, 800);
  sim.gas = clamp(sim.gas + (Math.random() - 0.35) * 3, 20, 600);
  let w = sim.weight + (Math.random() - 0.5) * 15;
  if (Math.random() < 0.03) w -= 750;
  if (Math.random() < 0.01) w += 750;
  sim.weight = clamp(w, 0, 4000);
  const d = getDefaultThresholds();
  return {
    device_id: DEVICE_ID, timestamp: new Date().toISOString(),
    temperature: { value: round(sim.temp, 1), unit: "°C", status: sim.temp > d.temperature.max ? "HIGH" : sim.temp < d.temperature.min ? "LOW" : "NORMAL" },
    humidity: { value: round(sim.humid, 1), unit: "%", status: sim.humid > d.humidity.max || sim.humid < d.humidity.min ? "OUT_OF_RANGE" : "NORMAL" },
    light: { value: round(sim.light, 0), unit: "lux", status: sim.light < d.light.energy_save_below ? "ENERGY_SAVE" : "STORE_OPEN" },
    gas: { value: round(sim.gas, 0), unit: "ppb", status: sim.gas >= d.gas.critical_remove ? "SPOILED" : sim.gas >= d.gas.spoilage_alert ? "REMOVE" : sim.gas >= d.gas.aging_warning ? "AGING" : "FRESH" },
    weight: { value: round(sim.weight, 0), unit: "g", status: sim.weight <= d.weight.empty_shelf ? "EMPTY" : sim.weight <= d.weight.low_stock ? "LOW_STOCK" : "OK" },
  };
}

function simulateHistory(sensorType, range) {
  const now = Date.now();
  const ms = { realtime: 300000, "1h": 3600000, "3h": 10800000, "1d": 86400000, "7d": 604800000 };
  const dur = ms[range] || ms["1h"];
  const points = Math.min(120, Math.max(30, Math.floor(dur / 60000)));
  const cfg = {
    temperature: { base: 3.2, amp: 1.2, freq: 0.1 }, humidity: { base: 64, amp: 5, freq: 0.08 },
    light: { base: 380, amp: 80, freq: 0.15 }, gas: { base: 78, amp: 25, freq: 0.05 }, weight: { base: 2400, amp: 300, freq: 0.03 },
  };
  const c = cfg[sensorType] || cfg.temperature;
  const data = [];
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < points; i++) {
    const t = now - dur + (i / points) * dur;
    const v = round(c.base + Math.sin(i * c.freq) * c.amp + (Math.random() - 0.5) * c.amp * 0.5, sensorType === "weight" ? 0 : 1);
    data.push({ timestamp: new Date(t).toISOString(), value: v });
    if (v < min) min = v; if (v > max) max = v; sum += v;
  }
  return { sensor_type: sensorType, range, data, stats: { min: round(min, 1), max: round(max, 1), avg: round(sum / points, 1) } };
}

function simulateCSV() {
  let csv = "timestamp,temperature_C,humidity_pct,light_lux,tvoc_ppb,weight_g\n";
  for (let i = 0; i < 100; i++) {
    const t = new Date(Date.now() - (100 - i) * 60000).toISOString();
    csv += `${t},${(3 + Math.random() * 2).toFixed(1)},${(60 + Math.random() * 10).toFixed(1)},${Math.round(350 + Math.random() * 100)},${Math.round(70 + Math.random() * 40)},${Math.round(2200 + Math.random() * 500)}\n`;
  }
  return csv;
}