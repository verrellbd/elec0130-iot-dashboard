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
    const payload = {
      action: "update_thresholds",
      thresholds: {
        temperature_min: thresholds.temperature?.min ?? 0,
        temperature_max: thresholds.temperature?.max ?? 8,
        temp_danger_threshold: thresholds.temperature?.danger ?? 40,
        humidity_min: thresholds.humidity?.min ?? 85,
        humidity_max: thresholds.humidity?.max ?? 95,
        low_stock_weight: thresholds.weight?.low_stock ?? 500,
        tvoc_fan_threshold: thresholds.tvoc?.fan_threshold ?? 3,
        tvoc_buzzer_threshold: thresholds.tvoc?.buzzer_threshold ?? 4,
        light_threshold: thresholds.light?.threshold ?? 5,
        freshness_aging_threshold: thresholds.freshness?.aging_threshold ?? 0.08,
        freshness_spoiled_threshold: thresholds.freshness?.spoiled_threshold ?? 0.15,
      },
    };

    const res = await fetch(`${API_URL}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error: ${res.status} - ${body}`);
    }
    return;
  }
  await new Promise((r) => setTimeout(r, 800));
}

export async function exportCSV(range) {
  if (isConfigured) {
    const res = await fetch(`${API_URL}/history?device_id=${DEVICE_ID}&range=${range}`, {
      headers: { "x-api-key": API_KEY },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const rows = data.data || [];

    if (rows.length === 0) return "";

    // Define columns and their display names
    const columns = [
      { key: "timestamp",    label: "Timestamp"       },
      { key: "temperature",  label: "Temperature (C)" },
      { key: "humidity",     label: "Humidity (%)"    },
      { key: "illuminance",  label: "Illuminance (lux)"},
      { key: "weight",       label: "Weight (g)"      },
      { key: "tvoc_level",   label: "TVOC Level"      },
      { key: "tvoc_indexA",  label: "TVOC Index A"    },
      { key: "tvoc_indexB",  label: "TVOC Index B"    },
      { key: "freshness",    label: "Freshness"       },
      { key: "brownIndex",   label: "Brown Index"     },
      { key: "led",          label: "LED"             },
      { key: "fan",          label: "Fan"             },
      { key: "buzzer",       label: "Buzzer"          },
      { key: "alert",        label: "Alert"           },
      { key: "lowStock",     label: "Low Stock"       },
      { key: "badAir",       label: "Bad Air"         },
    ];

    const header = columns.map(c => c.label).join(",");

    const csvRows = rows.map(row => {
      return columns.map(c => {
        let val = row[c.key] ?? "";
        // Format timestamp to readable date
        if (c.key === "timestamp") {
          val = new Date(Number(val)).toISOString().replace("T", " ").slice(0, 19);
        }
        // Wrap in quotes if contains comma
        if (String(val).includes(",")) val = `"${val}"`;
        return val;
      }).join(",");
    });

    return [header, ...csvRows].join("\n");
  }
  return "";
}

// ===== PARSE AWS RESPONSE =====

function parseLatest(raw) {
  const d = getDefaultThresholds();

  // Data is now flat (no payload wrapper)
  const temp = parseFloat(raw.temperature ?? 0);
  const humid = parseFloat(raw.humidity ?? 0);
  const weight = parseFloat(raw.weight ?? 0);
  const tvocLevel = parseInt(raw.tvoc_level ?? -1);
  const lux = parseFloat(raw.illuminance ?? 0);
  const pressure = parseFloat(raw.pressure ?? 0);

  let ts = raw.timestamp ?? Date.now();
  if (typeof ts === "number" || !isNaN(Number(ts))) {
    ts = new Date(Number(ts)).toISOString();
  }

  return {
    device_id: raw.deviceId ?? DEVICE_ID,
    timestamp: ts,
    temperature: {
      value: Math.round(temp * 10) / 10,
      unit: "°C",
      status: temp >= d.temperature.danger ? "DANGER"
            : temp > d.temperature.max     ? "HIGH"
            : temp < d.temperature.min     ? "LOW"
            : "NORMAL",
    },
    humidity: {
      value: Math.round(humid * 10) / 10,
      unit: "%",
      status: humid > d.humidity.max || humid < d.humidity.min ? "OUT_OF_RANGE" : "NORMAL",
    },
    weight: {
      value: Math.round(weight),
      unit: "g",
      status: weight <= d.weight.low_stock ? "LOW_STOCK" : "OK",
    },
    tvoc_level: {
      value: tvocLevel,
      unit: "Lv",
      status: tvocLevel >= d.tvoc.buzzer_threshold ? "DANGER" : tvocLevel >= d.tvoc.fan_threshold ? "WARNING" : tvocLevel < 0 ? "NORMAL" : "GOOD",
    },
    illuminance: {
      value: Math.round(lux * 10) / 10,
      unit: "lux",
      status: lux <= d.light.threshold ? "DARK" : "NORMAL",
    },
    pressure: {
      value: Math.round(pressure * 100) / 100,
      unit: "kPa",
      status: "NORMAL",
    },
    _actuators: {
      led: raw.led === 1 ? "ON" : "OFF",
      fan: raw.fan === 1 ? "ON" : "OFF",
      buzzer: raw.buzzer === 1 ? "ON" : "OFF",
      alert: raw.alert === 1,
      lowStock: raw.lowStock === 1,
      badAir: raw.badAir === 1,
    },
    freshness: {
      value:  raw.freshness ?? "FRESH",
      unit:   "",
      status: raw.freshness ?? "FRESH",
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
    temperature: { enabled: true, min: 0, max: 8, danger: 40 },
    humidity: { enabled: true, min: 85, max: 95 },
    weight: { enabled: true, low_stock: 500 },
    tvoc: { enabled: true, fan_threshold: 3, buzzer_threshold: 4 },
    light: { enabled: true, threshold: 5 },
    freshness: { enabled: true, aging_threshold: 0.08, spoiled_threshold: 0.15 },
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
      temperature: {
        min:    t.temperature_min         ?? 0,
        max:    t.temperature_max         ?? 8,
        danger: t.temp_danger_threshold   ?? 40,
      },
      humidity: {
        min: t.humidity_min ?? 85,
        max: t.humidity_max ?? 95,
      },
      weight: {
        low_stock: t.low_stock_weight ?? 500,
      },
      tvoc: {
        fan_threshold:    t.tvoc_fan_threshold    ?? 3,
        buzzer_threshold: t.tvoc_buzzer_threshold ?? 4,
      },
      light: {
        threshold: t.light_threshold ?? 5,
      },
      freshness: {
        aging_threshold:   t.freshness_aging_threshold   ?? 0.08,
        spoiled_threshold: t.freshness_spoiled_threshold ?? 0.15,
      },
    };
  }
  return getDefaultThresholds();
}

// ===== SIMULATION =====

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function round(v, d) { const f = 10 ** d; return Math.round(v * f) / f; }

const sim = { temp: 3.2, humid: 65.4, light: 420, gas: 1, weight: 2450 };

function simulateLatest() {
  sim.temp = clamp(sim.temp + (Math.random() - 0.48) * 0.3, -1, 8);
  sim.humid = clamp(sim.humid + (Math.random() - 0.5) * 1.5, 30, 90);
  sim.light = clamp(sim.light + (Math.random() - 0.5) * 20, 0, 800);
  sim.gas = clamp(sim.gas + (Math.random() - 0.35) * 0.3, 0, 5);
  sim.weight = clamp(sim.weight + (Math.random() - 0.5) * 15, 0, 4000);
  const d = getDefaultThresholds();
  return {
    device_id: DEVICE_ID, timestamp: new Date().toISOString(),
    temperature: { value: round(sim.temp, 1), unit: "°C", status: sim.temp > d.temperature.max ? "HIGH" : sim.temp < d.temperature.min ? "LOW" : "NORMAL" },
    humidity: { value: round(sim.humid, 1), unit: "%", status: sim.humid > d.humidity.max || sim.humid < d.humidity.min ? "OUT_OF_RANGE" : "NORMAL" },
    weight: { value: round(sim.weight, 0), unit: "g", status: sim.weight <= d.weight.low_stock ? "LOW_STOCK" : "OK" },
    tvoc_level: { value: Math.round(sim.gas), unit: "Lv", status: sim.gas >= 4 ? "DANGER" : sim.gas >= 3 ? "WARNING" : "GOOD" },
    illuminance: { value: round(sim.light, 1), unit: "lux", status: sim.light <= 5 ? "DARK" : "NORMAL" },
    pressure: { value: round(101.3 + (Math.random() - 0.5) * 0.5, 2), unit: "kPa", status: "NORMAL" },
    _actuators: { led: "OFF", fan: "OFF", buzzer: "OFF", alert: false, lowStock: false, badAir: false },
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