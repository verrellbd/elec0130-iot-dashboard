'use client';

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  // State management
  const [latestData, setLatestData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [allHistoricalData, setAllHistoricalData] = useState([]);
  const [previousData, setPreviousData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [prediction, setPrediction] = useState(null);
  
  // Time filter states
  const [timeFilter, setTimeFilter] = useState('1hour');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Configuration
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const TEMP_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_TEMP_THRESHOLD || '30');
  const HUMIDITY_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_HUMIDITY_THRESHOLD || '70');

  // Helper to get value from nested payload or top level
  const getValue = (item, key) => {
    if (!item) return null;
    if (item.payload && item.payload[key] !== undefined) {
      return item.payload[key];
    }
    return item[key];
  };

  // Fetch latest data
  const fetchLatestData = async () => {
    try {
      const response = await fetch(`${API_URL}/latest`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setLatestData(data);
      setIsConnected(true);
      setIsLoading(false);
      
      checkThresholds(data);
      
      if (previousData) {
        calculatePredictions(data, previousData);
      }
      
      setPreviousData(data);
    } catch (error) {
      console.error('Error fetching latest data:', error);
      setIsConnected(false);
      setIsLoading(false);
    }
  };

  // Fetch historical data
  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`${API_URL}/history?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const result = await response.json();
      const data = result.data || result;
      
      setAllHistoricalData(data);
      filterDataByTime(data, timeFilter);
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  // Filter data based on time range
  const filterDataByTime = (data, filter) => {
    if (!data || data.length === 0) return;
    
    const now = Date.now();
    let filteredData = [];
    
    switch (filter) {
      case '15min':
        filteredData = data.filter(d => now - d.timestamp <= 15 * 60 * 1000);
        break;
      case '30min':
        filteredData = data.filter(d => now - d.timestamp <= 30 * 60 * 1000);
        break;
      case '1hour':
        filteredData = data.filter(d => now - d.timestamp <= 60 * 60 * 1000);
        break;
      case '3hours':
        filteredData = data.filter(d => now - d.timestamp <= 3 * 60 * 60 * 1000);
        break;
      case '6hours':
        filteredData = data.filter(d => now - d.timestamp <= 6 * 60 * 60 * 1000);
        break;
      case '12hours':
        filteredData = data.filter(d => now - d.timestamp <= 12 * 60 * 60 * 1000);
        break;
      case '24hours':
        filteredData = data.filter(d => now - d.timestamp <= 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate).getTime();
          const end = new Date(customEndDate).getTime();
          filteredData = data.filter(d => d.timestamp >= start && d.timestamp <= end);
        } else {
          filteredData = data;
        }
        break;
      case 'all':
      default:
        filteredData = data;
        break;
    }
    
    setHistoricalData(filteredData);
  };

  // Handle time filter change
  const handleTimeFilterChange = (filter) => {
    setTimeFilter(filter);
    filterDataByTime(allHistoricalData, filter);
  };

  // Handle custom date range
  const applyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setTimeFilter('custom');
      filterDataByTime(allHistoricalData, 'custom');
    }
  };

  // Send command to Arduino
  const sendCommand = async (command) => {
    try {
      const response = await fetch(`${API_URL}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (!response.ok) throw new Error('Failed to send command');

      addEvent(`Command sent: ${command}`);
      showAlert('info', `✅ Command sent: ${command}`);
      
      setTimeout(() => setAlerts([]), 3000);
    } catch (error) {
      console.error('Error sending command:', error);
      showAlert('danger', `❌ Failed to send command`);
    }
  };

  // Check thresholds
  const checkThresholds = (data) => {
    const temp = getValue(data, 'temperature');
    const hum = getValue(data, 'humidity');
    
    const newAlerts = [];

    if (temp && temp > TEMP_THRESHOLD) {
      newAlerts.push({
        type: 'danger',
        message: `🔥 High Temperature: ${temp.toFixed(1)}°C (Threshold: ${TEMP_THRESHOLD}°C)`
      });
      addEvent(`High temperature detected: ${temp.toFixed(1)}°C`);
    }

    if (hum && hum > HUMIDITY_THRESHOLD) {
      newAlerts.push({
        type: 'warning',
        message: `💧 High Humidity: ${hum.toFixed(1)}% (Threshold: ${HUMIDITY_THRESHOLD}%)`
      });
      addEvent(`High humidity detected: ${hum.toFixed(1)}%`);
    }

    setAlerts(newAlerts);
  };

  // Calculate predictions
  const calculatePredictions = (current, previous) => {
    const currentTemp = getValue(current, 'temperature');
    const prevTemp = getValue(previous, 'temperature');
    
    if (!currentTemp || !prevTemp) return;
    
    const tempDiff = currentTemp - prevTemp;
    const tempRatePerMin = (tempDiff / 3) * 60;

    if (tempRatePerMin > 0.1 && currentTemp < TEMP_THRESHOLD) {
      const tempToGo = TEMP_THRESHOLD - currentTemp;
      const minutesToThreshold = tempToGo / tempRatePerMin;

      if (minutesToThreshold < 15) {
        setPrediction({
          message: `At current rate (+${tempRatePerMin.toFixed(2)}°C/min), temperature will reach ${TEMP_THRESHOLD}°C in ${minutesToThreshold.toFixed(1)} minutes`
        });
      } else {
        setPrediction(null);
      }
    } else {
      setPrediction(null);
    }
  };

  // Add event to log
  const addEvent = (message) => {
    setEvents(prev => [{
      time: new Date().toLocaleTimeString(),
      message
    }, ...prev.slice(0, 19)]);
  };

  // Show alert
  const showAlert = (type, message) => {
    setAlerts([{ type, message }]);
  };

  // Calculate trend
  const getTrend = (current, previous, threshold = 0.2) => {
    if (!previous || !current) return { icon: '→', text: 'Waiting...', class: 'text-gray-400' };
    
    const diff = current - previous;
    
    if (diff > threshold) {
      return { icon: '↗️', text: `Rising (+${diff.toFixed(2)})`, class: 'text-red-500' };
    } else if (diff < -threshold) {
      return { icon: '↘️', text: `Falling (${diff.toFixed(2)})`, class: 'text-blue-500' };
    }
    return { icon: '→', text: 'Stable', class: 'text-gray-500' };
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!historicalData.length) return null;

    const labels = historicalData.map(d => 
      new Date(d.timestamp).toLocaleTimeString()
    );

    const temperatures = historicalData.map(d => parseFloat(getValue(d, 'temperature')) || 0);
    const humidity = historicalData.map(d => parseFloat(getValue(d, 'humidity')) || 0);
    const pressure = historicalData.map(d => parseFloat(getValue(d, 'pressure')) || 0);
    const uvIndex = historicalData.map(d => parseFloat(getValue(d, 'uvIndex')) || 0);

    return {
      tempHumidity: {
        labels,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: temperatures,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Humidity (%)',
            data: humidity,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }
        ]
      },
      pressureUV: {
        labels,
        datasets: [
          {
            label: 'Pressure (kPa)',
            data: pressure,
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            yAxisID: 'y'
          },
          {
            label: 'UV Index',
            data: uvIndex,
            borderColor: 'rgb(245, 158, 11)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      }
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      y: {
        beginAtZero: false
      }
    }
  };

  const multiAxisOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      y: { 
        type: 'linear', 
        position: 'left',
        title: { display: true, text: 'Pressure (kPa)' }
      },
      y1: { 
        type: 'linear', 
        position: 'right',
        title: { display: true, text: 'UV Index' },
        grid: { drawOnChartArea: false }
      }
    }
  };

  // Initialize and set up intervals
  useEffect(() => {
    fetchLatestData();
    fetchHistoricalData();

    const latestInterval = setInterval(fetchLatestData, 3000);
    const historyInterval = setInterval(fetchHistoricalData, 30000);

    return () => {
      clearInterval(latestInterval);
      clearInterval(historyInterval);
    };
  }, []);

  const chartData = prepareChartData();

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
          <p className="text-white text-xl">Loading sensor data...</p>
          <p className="text-purple-200 text-sm mt-2">Connecting to Arduino...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!latestData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Connect</h2>
          <p className="text-gray-600 mb-4">Cannot fetch sensor data from API</p>
          <div className="bg-gray-100 p-4 rounded-lg mb-4 text-left">
            <p className="text-sm text-gray-700 font-mono break-all">
              API URL: {API_URL || 'NOT SET - Check .env.local'}
            </p>
          </div>
          <button 
            onClick={() => {
              setIsLoading(true);
              fetchLatestData();
            }}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            🌡️ Arduino IoT Dashboard
          </h1>
          <p className="text-purple-100 text-lg">
            Real-time Environmental Monitoring with Predictive Analytics
          </p>
        </div>

        {/* Status Bar */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-semibold">
              Status: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="text-gray-500 text-sm">
            Last update: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Alerts */}
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className={`mb-4 p-4 rounded-lg ${
              alert.type === 'danger' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' :
              alert.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500' :
              'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
            }`}
          >
            {alert.message}
          </div>
        ))}

        {/* Prediction */}
        {prediction && (
          <div className="mb-6 bg-purple-100 border-l-4 border-purple-500 p-4 rounded-lg">
            <p className="text-purple-900">
              ⚠️ <strong>Prediction:</strong> {prediction.message}
            </p>
          </div>
        )}

        {/* Sensor Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Temperature Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-purple-600 font-semibold text-sm uppercase tracking-wide">
                🌡️ Temperature
              </h3>
              <span className="text-3xl">
                {getTrend(
                  getValue(latestData, 'temperature'),
                  getValue(previousData, 'temperature')
                ).icon}
              </span>
            </div>
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {getValue(latestData, 'temperature')?.toFixed(1) || '--'}
              <span className="text-2xl text-gray-500 ml-2">°C</span>
            </div>
            <p className={`text-sm ${getTrend(
              getValue(latestData, 'temperature'),
              getValue(previousData, 'temperature')
            ).class}`}>
              {getTrend(
                getValue(latestData, 'temperature'),
                getValue(previousData, 'temperature')
              ).text}
            </p>
          </div>

          {/* Humidity Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-purple-600 font-semibold text-sm uppercase tracking-wide">
                💧 Humidity
              </h3>
              <span className="text-3xl">
                {getTrend(
                  getValue(latestData, 'humidity'),
                  getValue(previousData, 'humidity'),
                  1
                ).icon}
              </span>
            </div>
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {getValue(latestData, 'humidity')?.toFixed(1) || '--'}
              <span className="text-2xl text-gray-500 ml-2">%</span>
            </div>
            <p className={`text-sm ${getTrend(
              getValue(latestData, 'humidity'),
              getValue(previousData, 'humidity'),
              1
            ).class}`}>
              {getTrend(
                getValue(latestData, 'humidity'),
                getValue(previousData, 'humidity'),
                1
              ).text}
            </p>
          </div>

          {/* Pressure Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-purple-600 font-semibold text-sm uppercase tracking-wide">
                🌀 Pressure
              </h3>
              <span className="text-3xl">
                {getTrend(
                  getValue(latestData, 'pressure'),
                  getValue(previousData, 'pressure'),
                  0.1
                ).icon}
              </span>
            </div>
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {getValue(latestData, 'pressure')?.toFixed(2) || '--'}
              <span className="text-2xl text-gray-500 ml-2">kPa</span>
            </div>
            <p className={`text-sm ${getTrend(
              getValue(latestData, 'pressure'),
              getValue(previousData, 'pressure'),
              0.1
            ).class}`}>
              {getTrend(
                getValue(latestData, 'pressure'),
                getValue(previousData, 'pressure'),
                0.1
              ).text}
            </p>
          </div>

          {/* UV Index Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-purple-600 font-semibold text-sm uppercase tracking-wide">
                ☀️ UV Index
              </h3>
              <span className="text-3xl">
                {getTrend(
                  getValue(latestData, 'uvIndex'),
                  getValue(previousData, 'uvIndex'),
                  0.1
                ).icon}
              </span>
            </div>
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {getValue(latestData, 'uvIndex')?.toFixed(2) || '--'}
            </div>
            <p className={`text-sm ${getTrend(
              getValue(latestData, 'uvIndex'),
              getValue(previousData, 'uvIndex'),
              0.1
            ).class}`}>
              {getTrend(
                getValue(latestData, 'uvIndex'),
                getValue(previousData, 'uvIndex'),
                0.1
              ).text}
            </p>
          </div>
        </div>

        {/* Time Range Filter */}
        {allHistoricalData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">⏱️ Time Range Filter</h3>
            
            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['15min', '30min', '1hour', '3hours', '6hours', '12hours', '24hours', 'all'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleTimeFilterChange(filter)}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    timeFilter === filter
                      ? 'bg-purple-600 text-white shadow-lg transform scale-105'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {filter === '15min' && 'Last 15 min'}
                  {filter === '30min' && 'Last 30 min'}
                  {filter === '1hour' && 'Last 1 hour'}
                  {filter === '3hours' && 'Last 3 hours'}
                  {filter === '6hours' && 'Last 6 hours'}
                  {filter === '12hours' && 'Last 12 hours'}
                  {filter === '24hours' && 'Last 24 hours'}
                  {filter === 'all' && 'All Data'}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">📅 Custom Date Range:</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={applyCustomDateRange}
                  disabled={!customStartDate || !customEndDate}
                  className={`font-semibold px-6 py-2 rounded-lg transition ${
                    customStartDate && customEndDate
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Apply Custom Range
                </button>
                <button
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                    handleTimeFilterChange('1hour');
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold px-6 py-2 rounded-lg transition"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Data Info & Export */}
            <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-sm font-semibold text-purple-900 mb-1">
                    Showing {historicalData.length} data points
                    {allHistoricalData.length > 0 && ` (out of ${allHistoricalData.length} total)`}
                  </p>
                  {timeFilter === 'custom' && customStartDate && customEndDate && (
                    <p className="text-xs text-purple-700">
                      From {new Date(customStartDate).toLocaleString()} to {new Date(customEndDate).toLocaleString()}
                    </p>
                  )}
                  {timeFilter !== 'custom' && timeFilter !== 'all' && (
                    <p className="text-xs text-purple-700">Time range: {timeFilter.replace('min', ' minutes').replace('hour', ' hour').replace('s', '')}</p>
                  )}
                  {timeFilter === 'all' && (
                    <p className="text-xs text-purple-700">Showing all available data</p>
                  )}
                </div>
              </div>
              
              {/* Export Button */}
              <button
                onClick={() => {
                  if (historicalData.length === 0) {
                    alert('No data to export!');
                    return;
                  }
                  
                  const csv = [
                    ['Timestamp', 'Date/Time', 'Temperature (°C)', 'Humidity (%)', 'Pressure (kPa)', 'UV Index', 'UVA', 'UVB', 'Illuminance'],
                    ...historicalData.map(d => [
                      d.timestamp,
                      new Date(d.timestamp).toLocaleString(),
                      getValue(d, 'temperature')?.toFixed(2) || '',
                      getValue(d, 'humidity')?.toFixed(2) || '',
                      getValue(d, 'pressure')?.toFixed(2) || '',
                      getValue(d, 'uvIndex')?.toFixed(2) || '',
                      getValue(d, 'uva')?.toFixed(2) || '',
                      getValue(d, 'uvb')?.toFixed(2) || '',
                      getValue(d, 'illuminance')?.toFixed(2) || ''
                    ])
                  ].map(row => row.join(',')).join('\n');
                  
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `sensor-data-${timeFilter}-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-2"
              >
                📥 Export to CSV
              </button>
            </div>
          </div>
        )}

        {/* Charts */}
        {chartData && (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                📈 Temperature & Humidity History
              </h3>
              <Line data={chartData.tempHumidity} options={chartOptions} />
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                📊 Pressure & UV Index Trends
              </h3>
              <Line data={chartData.pressureUV} options={multiAxisOptions} />
            </div>
          </>
        )}

        {/* Remote Controls */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">🎮 Remote Control</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => sendCommand('led_on')}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:shadow-lg transform hover:scale-105"
            >
              💡 LED ON
            </button>
            <button
              onClick={() => sendCommand('led_off')}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:shadow-lg transform hover:scale-105"
            >
              🔴 LED OFF
            </button>
            <button
              onClick={() => sendCommand('get_status')}
              className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:shadow-lg transform hover:scale-105"
            >
              📊 Get Status
            </button>
            <button
              onClick={() => sendCommand('set_interval_3000')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:shadow-lg transform hover:scale-105"
            >
              ⏱️ 3s Interval
            </button>
            <button
              onClick={() => sendCommand('set_interval_5000')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:shadow-lg transform hover:scale-105"
            >
              ⏱️ 5s Interval
            </button>
            <button
              onClick={() => sendCommand('set_interval_10000')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:shadow-lg transform hover:scale-105"
            >
              ⏱️ 10s Interval
            </button>
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Event Log</h3>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No events yet...</p>
            ) : (
              events.map((event, idx) => (
                <div key={idx} className="bg-gray-50 border-l-4 border-purple-500 p-3 rounded">
                  <span className="text-gray-500 text-sm mr-3">{event.time}</span>
                  <span className="text-gray-900">{event.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}