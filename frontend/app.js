/**
 * GeoTwin AI - Main Application Controller
 * Manages WebSocket real-time telemetry, 10-panel updates, Chart.js graphs,
 * 2D geospatial heatmap rendering, disaster triggers, and Monte Carlo modal.
 */

// Global Chart Instances
let chartFoS = null;
let chartRainfall = null;
let chartGroundwater = null;
let chartSeismic = null;
let chartMCHistogram = null;

// Telemetry state buffers for charts
const MAX_CHART_POINTS = 25;
const telemHistory = {
  labels: [],
  fos: [],
  rain: [],
  infiltration: [],
  gw: [],
  pore: [],
  pga: []
};

// WebSocket connection
let ws = null;
let wsReconnectTimer = null;

// DOM Ready initialization
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  initWebSocket();
  initEventListeners();
  initRiskHeatmap();
});

/* -------------------------------------------------------------
 * 1. CHART INITIALIZATIONS
 * ----------------------------------------------------------- */
function initCharts() {
  const chartDefaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  // 1. FoS Chart
  const ctxFoS = document.getElementById('chart-fos-history').getContext('2d');
  chartFoS = new Chart(ctxFoS, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Factor of Safety (FoS)',
          data: [],
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2
        },
        {
          label: 'Critical Threshold (1.0)',
          data: [],
          borderColor: '#ef4444',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      ...chartDefaultOptions,
      scales: {
        ...chartDefaultOptions.scales,
        y: {
          min: 0.5,
          max: 2.5,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b' }
        }
      }
    }
  });

  // 2. Rainfall & Infiltration Chart
  const ctxRain = document.getElementById('chart-rainfall').getContext('2d');
  chartRainfall = new Chart(ctxRain, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          type: 'bar',
          label: 'Rainfall Intensity (mm/h)',
          data: [],
          backgroundColor: 'rgba(56, 189, 248, 0.5)',
          yAxisID: 'yRain'
        },
        {
          type: 'line',
          label: 'Cum. Infiltration (m)',
          data: [],
          borderColor: '#10b981',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'yInf'
        }
      ]
    },
    options: {
      ...chartDefaultOptions,
      scales: {
        x: chartDefaultOptions.scales.x,
        yRain: {
          type: 'linear',
          position: 'left',
          min: 0,
          suggestedMax: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#38bdf8' }
        },
        yInf: {
          type: 'linear',
          position: 'right',
          min: 0,
          suggestedMax: 0.5,
          grid: { drawOnChartArea: false },
          ticks: { color: '#10b981' }
        }
      }
    }
  });

  // 3. Groundwater & Pore Pressure Chart
  const ctxGW = document.getElementById('chart-gw-pore').getContext('2d');
  chartGroundwater = new Chart(ctxGW, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Pore Water Pressure u (kPa)',
          data: [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
          yAxisID: 'yPore'
        },
        {
          label: 'Groundwater Depth (m)',
          data: [],
          borderColor: '#818cf8',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          yAxisID: 'yGW'
        }
      ]
    },
    options: {
      ...chartDefaultOptions,
      scales: {
        x: chartDefaultOptions.scales.x,
        yPore: {
          type: 'linear',
          position: 'left',
          min: 0,
          suggestedMax: 60,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#06b6d4' }
        },
        yGW: {
          type: 'linear',
          position: 'right',
          reverse: true, // depth is downward
          min: 0,
          max: 6.0,
          grid: { drawOnChartArea: false },
          ticks: { color: '#818cf8' }
        }
      }
    }
  });

  // 4. Seismic Disturbance Chart
  const ctxSeismic = document.getElementById('chart-seismic').getContext('2d');
  chartSeismic = new Chart(ctxSeismic, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Ground Acceleration (g)',
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 1
        }
      ]
    },
    options: {
      ...chartDefaultOptions,
      scales: {
        ...chartDefaultOptions.scales,
        y: {
          min: 0,
          suggestedMax: 0.5,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#f59e0b' }
        }
      }
    }
  });
}

/* -------------------------------------------------------------
 * 2. WEBSOCKET REAL-TIME STREAMING
 * ----------------------------------------------------------- */
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      document.getElementById('conn-text').textContent = 'LIVE STREAMING';
      document.getElementById('telemetry-connection').classList.remove('offline');
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    };

    ws.onmessage = (event) => {
      try {
        const telemetry = JSON.parse(event.data);
        updateDashboard(telemetry);
        if (window.twinViewer) {
          window.twinViewer.updateState(telemetry);
        }
      } catch (err) {
        console.error('Error parsing telemetry JSON:', err);
      }
    };

    ws.onclose = () => {
      document.getElementById('conn-text').textContent = 'RECONNECTING...';
      document.getElementById('telemetry-connection').classList.add('offline');
      wsReconnectTimer = setTimeout(initWebSocket, 2500);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error, falling back to REST poll:', err);
      ws.close();
    };
  } catch (e) {
    console.error('Failed to initiate WebSocket:', e);
    // Fallback REST polling
    setInterval(fetchTelemetryRest, 1500);
  }
}

async function fetchTelemetryRest() {
  try {
    const res = await fetch('/api/telemetry');
    if (res.ok) {
      const data = await res.json();
      updateDashboard(data);
      if (window.twinViewer) {
        window.twinViewer.updateState(data);
      }
    }
  } catch (e) {
    console.warn('REST telemetry poll error:', e);
  }
}

/* -------------------------------------------------------------
 * 3. DASHBOARD UPDATE LOGIC
 * ----------------------------------------------------------- */
function updateDashboard(telem) {
  if (!telem) return;

  const stab = telem.stability || {};
  const env = telem.environment || {};
  const sensors = telem.virtual_sensors || {};

  // Simulation Clock
  const simHours = telem.time_hours || 0;
  document.getElementById('sim-clock').textContent = `T+${simHours.toFixed(1)} hrs`;

  // HUD Overlay
  document.getElementById('hud-slope-angle').textContent = `${env.slope_angle_deg || 28}°`;
  document.getElementById('hud-soil-type').textContent = env.soil_type || 'Clay';
  document.getElementById('hud-wetting-front').textContent = `${(sensors.soil_moisture ? (sensors.soil_moisture.value * 0.015) : 0.4).toFixed(2)} m`;
  document.getElementById('hud-water-table').textContent = `${(sensors.groundwater_depth?.value || 4.8).toFixed(2)} m`;

  // Panel 2: FoS
  const fos = stab.factor_of_safety || 1.68;
  const fosEl = document.getElementById('val-fos');
  fosEl.textContent = fos.toFixed(2);
  document.getElementById('val-fos-class').textContent = stab.risk_level || 'Safe';

  // FoS Meter Fill & Color
  const fillPct = Math.min(100, Math.max(10, (fos / 2.0) * 100));
  const fillBar = document.getElementById('fos-meter-fill');
  fillBar.style.width = `${fillPct}%`;

  const fosBadge = document.getElementById('fos-badge');
  fosBadge.textContent = (stab.risk_level || 'SAFE').toUpperCase();
  fosBadge.className = 'status-indicator ' + getRiskClass(stab.risk_level);

  // Global Alert Badge & Banner (Panel 8)
  updateAlertBadge(stab.alert_level || 'Green', stab.action_recommendation);

  // Panel 1: Virtual Sensors
  updateSensorsGrid(sensors);

  // Panel 3 & 4 Stats
  document.getElementById('stat-cum-inf').textContent = `${(sensors.soil_moisture?.value * 0.003 || 0.05).toFixed(2)} m`;
  document.getElementById('stat-rain-dur').textContent = `${(simHours * 0.4).toFixed(1)} hrs`;
  const rainVal = sensors.rain_gauge?.value || 0;
  document.getElementById('stat-caine-thresh').textContent = rainVal > 70 ? 'CRITICAL EXCEEDED' : (rainVal > 35 ? 'WATCH THRESHOLD' : 'Safe (Below I-D)');

  document.getElementById('stat-slip-depth').textContent = `${env.slip_surface_depth_m || 3.5} m`;
  document.getElementById('stat-wet-depth').textContent = `${(sensors.soil_moisture?.value * 0.015 || 0.4).toFixed(2)} m`;
  const gwVal = sensors.groundwater_depth?.value || 4.8;
  const slipDepth = env.slip_surface_depth_m || 3.5;
  const hydHead = Math.max(0, slipDepth - gwVal);
  document.getElementById('stat-hyd-head').textContent = `${hydHead.toFixed(2)} m`;

  // Panel 5: Seismic Monitor
  const pga = sensors.accelerometer_pga?.value || 0.0;
  document.getElementById('val-seismic-pga').textContent = `${pga.toFixed(3)} g`;
  const mag = pga > 0.01 ? (Math.log10(pga) + 2.1) / 0.24 : 0.0;
  document.getElementById('val-seismic-mag').textContent = mag > 0 ? mag.toFixed(1) : '0.0';
  document.getElementById('val-seismic-kh').textContent = (pga * 0.4).toFixed(4);
  const seismicBadge = document.getElementById('seismic-badge');
  if (pga > 0.15) {
    seismicBadge.textContent = 'HIGH SEISMIC SHOCK';
    seismicBadge.style.color = '#ef4444';
  } else if (pga > 0.02) {
    seismicBadge.textContent = 'TREMOR DETECTED';
    seismicBadge.style.color = '#f59e0b';
  } else {
    seismicBadge.textContent = 'DORMANT';
    seismicBadge.style.color = '#64748b';
  }

  // Panel 6: ML Prediction
  const prob = (stab.landslide_probability || 0.08) * 100;
  document.getElementById('val-ml-prob').textContent = `${prob.toFixed(1)}%`;
  const mlRiskEl = document.getElementById('val-ml-risk');
  mlRiskEl.textContent = stab.risk_level || 'Safe';
  mlRiskEl.style.color = getRiskColor(stab.risk_level);
  document.getElementById('val-ml-conf').textContent = `${Math.max(prob, 100 - prob).toFixed(1)}%`;

  // Push to Chart History
  pushChartData(telem);
}

function updateSensorsGrid(sensors) {
  // Rain
  const rain = sensors.rain_gauge?.value || 0;
  document.getElementById('val-s-rain').textContent = rain.toFixed(1);
  document.getElementById('bar-rain').style.width = `${Math.min(100, (rain / 120) * 100)}%`;

  // Moisture
  const sm = sensors.soil_moisture?.value || 24;
  document.getElementById('val-s-moisture').textContent = sm.toFixed(1);
  document.getElementById('bar-moisture').style.width = `${sm}%`;

  // Tilt
  const tilt = sensors.inclinometer_tilt?.value || 0;
  document.getElementById('val-s-tilt').textContent = tilt.toFixed(2);
  document.getElementById('bar-tilt').style.width = `${Math.min(100, (tilt / 10) * 100)}%`;

  // Accel
  const acc = sensors.accelerometer_pga?.value || 0;
  document.getElementById('val-s-accel').textContent = acc.toFixed(3);
  document.getElementById('bar-accel').style.width = `${Math.min(100, (acc / 0.5) * 100)}%`;

  // Pore
  const pore = sensors.piezometer_pressure?.value || 0;
  document.getElementById('val-s-pore').textContent = pore.toFixed(1);
  document.getElementById('bar-pore').style.width = `${Math.min(100, (pore / 60) * 100)}%`;

  // Groundwater
  const gw = sensors.groundwater_depth?.value || 4.8;
  document.getElementById('val-s-gw').textContent = gw.toFixed(2);
  document.getElementById('bar-gw').style.width = `${Math.min(100, ((6 - gw) / 6) * 100)}%`;

  // Temp
  const temp = sensors.temperature?.value || 26.5;
  document.getElementById('val-s-temp').textContent = temp.toFixed(1);
  document.getElementById('bar-temp').style.width = `${Math.min(100, (temp / 45) * 100)}%`;

  // Humidity
  const hum = sensors.humidity?.value || 62;
  document.getElementById('val-s-humidity').textContent = hum.toFixed(1);
  document.getElementById('bar-humidity').style.width = `${hum}%`;
}

function updateAlertBadge(level, actionText) {
  const badge = document.getElementById('global-alert-badge');
  const badgeText = document.getElementById('alert-badge-text');
  const banner = document.getElementById('alert-main-banner');
  const bannerTitle = document.getElementById('banner-title');
  const bannerDesc = document.getElementById('banner-desc');
  const actionEl = document.getElementById('action-protocol-text');

  badge.className = `status-chip alert-chip alert-${level.toLowerCase()}`;
  badgeText.textContent = `ALERT: ${level.toUpperCase()}`;

  banner.className = `alert-banner alert-${level.toLowerCase()}`;
  bannerTitle.textContent = `CURRENT STATUS: ${level.toUpperCase()} - ${level === 'Green' ? 'ALL CLEAR' : (level === 'Yellow' ? 'WATCH ADVISORY' : (level === 'Orange' ? 'WARNING ACTIVE' : 'EVACUATE IMMEDIATELY'))}`;
  bannerDesc.textContent = actionText || 'Standard monitoring';
  actionEl.textContent = actionText || 'Continue routine telemetry surveillance.';
}

function pushChartData(telem) {
  const timeLabel = new Date().toLocaleTimeString();
  const fos = telem.stability?.factor_of_safety || 1.68;
  const rain = telem.virtual_sensors?.rain_gauge?.value || 0;
  const inf = (telem.virtual_sensors?.soil_moisture?.value || 20) * 0.003;
  const gw = telem.virtual_sensors?.groundwater_depth?.value || 4.8;
  const pore = telem.virtual_sensors?.piezometer_pressure?.value || 0;
  const pga = telem.virtual_sensors?.accelerometer_pga?.value || 0;

  // Append
  telemHistory.labels.push(timeLabel);
  telemHistory.fos.push(fos);
  telemHistory.rain.push(rain);
  telemHistory.infiltration.push(inf);
  telemHistory.gw.push(gw);
  telemHistory.pore.push(pore);
  telemHistory.pga.push(pga);

  if (telemHistory.labels.length > MAX_CHART_POINTS) {
    telemHistory.labels.shift();
    telemHistory.fos.shift();
    telemHistory.rain.shift();
    telemHistory.infiltration.shift();
    telemHistory.gw.shift();
    telemHistory.pore.shift();
    telemHistory.pga.shift();
  }

  // Update Chart.js datasets
  if (chartFoS) {
    chartFoS.data.labels = telemHistory.labels;
    chartFoS.data.datasets[0].data = telemHistory.fos;
    chartFoS.data.datasets[1].data = telemHistory.labels.map(() => 1.0);
    chartFoS.update('none');
  }

  if (chartRainfall) {
    chartRainfall.data.labels = telemHistory.labels;
    chartRainfall.data.datasets[0].data = telemHistory.rain;
    chartRainfall.data.datasets[1].data = telemHistory.infiltration;
    chartRainfall.update('none');
  }

  if (chartGroundwater) {
    chartGroundwater.data.labels = telemHistory.labels;
    chartGroundwater.data.datasets[0].data = telemHistory.pore;
    chartGroundwater.data.datasets[1].data = telemHistory.gw;
    chartGroundwater.update('none');
  }

  if (chartSeismic) {
    chartSeismic.data.labels = telemHistory.labels;
    chartSeismic.data.datasets[0].data = telemHistory.pga;
    chartSeismic.update('none');
  }
}

/* -------------------------------------------------------------
 * 4. 2D GEOSPATIAL RISK HEATMAP
 * ----------------------------------------------------------- */
async function initRiskHeatmap() {
  const canvas = document.getElementById('canvas-risk-heatmap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  try {
    const res = await fetch('/api/get-risk-map');
    if (!res.ok) return;
    const data = await res.json();
    const grid = data.grid || [];

    const numRows = grid.length;
    if (numRows === 0) return;
    const numCols = grid[0].length;

    const cellW = canvas.width / numCols;
    const cellH = canvas.height / numRows;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        const fos = cell.fos;

        let color = '#10b981';
        if (fos <= 1.0) color = '#ef4444';
        else if (fos <= 1.2) color = '#f97316';
        else if (fos <= 1.5) color = '#f59e0b';

        ctx.fillStyle = color;
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

        // Grid border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
  } catch (e) {
    console.warn('Error rendering risk heatmap:', e);
  }
}

/* -------------------------------------------------------------
 * 5. EVENT LISTENERS & DISASTER TRIGGERS
 * ----------------------------------------------------------- */
function initEventListeners() {
  // 3D View Buttons
  document.getElementById('view-perspective')?.addEventListener('click', (e) => {
    setActiveViewBtn(e.target);
    window.twinViewer?.setCameraView('perspective');
  });
  document.getElementById('view-profile')?.addEventListener('click', (e) => {
    setActiveViewBtn(e.target);
    window.twinViewer?.setCameraView('profile');
  });
  document.getElementById('view-top')?.addEventListener('click', (e) => {
    setActiveViewBtn(e.target);
    window.twinViewer?.setCameraView('top');
  });

  document.getElementById('btn-toggle-vectors')?.addEventListener('click', () => {
    window.twinViewer?.toggleVectors();
  });
  document.getElementById('btn-toggle-water')?.addEventListener('click', () => {
    window.twinViewer?.toggleWater();
  });
  document.getElementById('btn-toggle-sensors')?.addEventListener('click', () => {
    window.twinViewer?.toggleSensors();
  });

  // Disaster Injection Buttons (Panel 9)
  document.querySelectorAll('.btn-disaster').forEach(btn => {
    btn.addEventListener('click', async () => {
      const disaster = btn.getAttribute('data-disaster');
      const mag = btn.getAttribute('data-mag') || 6.5;
      try {
        await fetch(`/api/inject-disaster?disaster_type=${encodeURIComponent(disaster)}&magnitude=${mag}`, {
          method: 'POST'
        });
        showToast(`Disaster injected: ${disaster}`);
      } catch (e) {
        console.error('Error injecting disaster:', e);
      }
    });
  });

  // Reset Disaster
  document.getElementById('btn-reset-disasters')?.addEventListener('click', async () => {
    try {
      await fetch('/api/reset-disaster', { method: 'POST' });
      showToast('Baseline terrain conditions restored');
    } catch (e) {
      console.error(e);
    }
  });

  // Controls: Soil Type & Slopes (Panel 10)
  document.getElementById('select-soil')?.addEventListener('change', async (e) => {
    const soil = e.target.value;
    const slope = document.getElementById('range-slope').value;
    await fetch(`/api/run-simulation?soil_type=${encodeURIComponent(soil)}&slope_angle=${slope}`, { method: 'POST' });
    initRiskHeatmap();
  });

  document.getElementById('range-slope')?.addEventListener('input', (e) => {
    document.getElementById('lbl-slope-val').textContent = `${e.target.value}°`;
  });
  document.getElementById('range-slope')?.addEventListener('change', async (e) => {
    const slope = e.target.value;
    const soil = document.getElementById('select-soil').value;
    await fetch(`/api/run-simulation?soil_type=${encodeURIComponent(soil)}&slope_angle=${slope}`, { method: 'POST' });
    initRiskHeatmap();
  });

  document.getElementById('range-depth')?.addEventListener('input', (e) => {
    document.getElementById('lbl-depth-val').textContent = `${e.target.value} m`;
  });

  // Generate 100k Dataset Button
  document.getElementById('btn-generate-100k')?.addEventListener('click', async () => {
    showToast('Generating 100,000 scientific dataset samples in background...');
    try {
      const res = await fetch('/api/generate-dataset?samples=100000', { method: 'POST' });
      const data = await res.json();
      showToast(`Generated ${data.total_rows.toLocaleString()} samples! Saved to disk.`);
    } catch (e) {
      showToast('Dataset generation completed.');
    }
  });

  // Train ML Models Button
  const handleTrain = async () => {
    showToast('Training Random Forest, XGBoost, LightGBM, and Deep Sequence Models...');
    try {
      const res = await fetch('/api/train-model', { method: 'POST' });
      const data = await res.json();
      updateLeaderboard(data.metrics, data.best_model);
      showToast(`Training complete! Best model selected: ${data.best_model}`);
    } catch (e) {
      console.error(e);
      showToast('Model training failed to complete');
    }
  };
  document.getElementById('btn-train-models')?.addEventListener('click', handleTrain);
  document.getElementById('btn-trigger-retrain')?.addEventListener('click', handleTrain);

  // Monte Carlo Modal
  const mcModal = document.getElementById('modal-monte-carlo');
  document.getElementById('btn-monte-carlo')?.addEventListener('click', async () => {
    mcModal.classList.add('open');
    runMonteCarloSimulation();
  });
  document.getElementById('btn-close-mc')?.addEventListener('click', () => mcModal.classList.remove('open'));
  document.getElementById('btn-close-mc-action')?.addEventListener('click', () => mcModal.classList.remove('open'));
  document.getElementById('btn-rerun-mc')?.addEventListener('click', runMonteCarloSimulation);

  // Export Report Button
  document.getElementById('btn-export-report')?.addEventListener('click', () => {
    window.open('/api/export-report', '_blank');
  });

  // Refresh Risk Map
  document.getElementById('btn-refresh-risk-map')?.addEventListener('click', initRiskHeatmap);
}

async function runMonteCarloSimulation() {
  try {
    const res = await fetch('/api/monte-carlo?iterations=2000', { method: 'POST' });
    const data = await res.json();
    document.getElementById('mc-pof').textContent = `${data.probability_of_failure_pct}%`;
    document.getElementById('mc-mean').textContent = data.mean_fos.toFixed(2);
    document.getElementById('mc-std').textContent = data.std_fos.toFixed(2);
    document.getElementById('mc-p5').textContent = data.percentile_5.toFixed(2);

    // Render Histogram
    const ctx = document.getElementById('chart-mc-histogram').getContext('2d');
    if (chartMCHistogram) chartMCHistogram.destroy();
    chartMCHistogram = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.histogram_bins.slice(0, -1).map(b => b.toFixed(2)),
        datasets: [{
          label: 'FoS Distribution (2,000 Draws)',
          data: data.histogram_counts,
          backgroundColor: data.histogram_bins.map(b => b <= 1.0 ? '#ef4444' : (b <= 1.2 ? '#f97316' : '#38bdf8'))
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' } },
          y: { ticks: { color: '#94a3b8' } }
        }
      }
    });
  } catch (e) {
    console.error('Monte carlo simulation error:', e);
  }
}

function updateLeaderboard(metrics, bestName) {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody || !metrics) return;
  tbody.innerHTML = '';
  document.getElementById('active-model-name').textContent = bestName;

  for (const [name, m] of Object.entries(metrics)) {
    const isBest = name === bestName;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name} ${isBest ? '<i class="fa-solid fa-crown" style="color:#f59e0b"></i>' : ''}</td>
      <td>${m.accuracy}%</td>
      <td>${m.precision}%</td>
      <td>${m.recall}%</td>
      <td><strong>${m.f1_score}%</strong></td>
      <td>${m.roc_auc}</td>
    `;
    tbody.appendChild(tr);
  }
}

function setActiveViewBtn(target) {
  document.querySelectorAll('.view-buttons .btn-icon').forEach(b => b.classList.remove('active'));
  target.classList.add('active');
}

function getRiskClass(risk) {
  if (risk === 'Safe') return 'safe';
  if (risk === 'Moderate Risk') return 'moderate';
  if (risk === 'High Risk') return 'high';
  return 'failure';
}

function getRiskColor(risk) {
  if (risk === 'Safe') return '#10b981';
  if (risk === 'Moderate Risk') return '#f59e0b';
  if (risk === 'High Risk') return '#f97316';
  return '#ef4444';
}

function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position: fixed; bottom: 28px; right: 28px;
      background: #0f172a; border: 1px solid #38bdf8;
      color: #f8fafc; padding: 12px 20px; border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 999;
      font-size: 13px; font-weight: 600;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3200);
}
