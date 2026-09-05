# System Deployment & Quickstart Guide

This guide provides instructions for launching the interactive Web UI and AI backend, running MATLAB scripts, generating datasets, and deploying to production.

---

## 1. Prerequisites

* **Operating System:** Windows 10/11, Linux, or macOS.
* **Python Runtime:** Python 3.10+ (tested on Python 3.14).
* **Dependencies:** `fastapi`, `uvicorn`, `scikit-learn`, `pandas`, `scipy`.
* **MATLAB (Optional for Desktop/Simulink):** MATLAB R2020b or later with Simulink, Statistics and Machine Learning Toolbox.

---

## 2. Quickstart: Launch Interactive Web Platform

To launch the FastAPI backend server and serve the interactive 3D Web UI:

```powershell
# Navigate to workspace root
cd d:\MATRIX

# Start the server using Python
& "C:\Users\Adithyakrishna U\AppData\Local\Programs\Python\Python314\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Once started, open your web browser to:
👉 **`http://127.0.0.1:8000`**

### Available Features in Web Dashboard:
1. **Interactive 3D Digital Twin (Three.js):**
   * Rotate: Left click + drag
   * Pan: Right click + drag
   * Zoom: Scroll wheel
   * View buttons: `3D` (Perspective), `Side` (Slope Profile), `Top` (Bird's Eye)
   * Toggle layers: Displacement Vectors, Water Table Plane, Virtual Sensors
2. **10 Real-Time Monitoring Panels:**
   * Live Virtual Sensors Telemetry
   * Factor of Safety Gauge & Trend Curve
   * Rainfall & Green-Ampt Infiltration Rates
   * Groundwater Rise & Piezometer Pressure Profile
   * Seismic PGA Seismograph
   * ML Prediction & Comparative Leaderboard
   * 2D Geospatial Cross-Section Heatmap
   * Early Warning Alert Feed & Directive Directives
   * Disaster Simulation Studio (Cloudburst, 7.2M Earthquake, Cyclone, Flash Flood)
   * Digital Twin Soil Type & Slope Angle Sliders
3. **Probabilistic Monte Carlo Simulation:** Click `Monte Carlo` in the top navigation to view the 2,000-draw histogram and failure probability.
4. **PDF/HTML Geotechnical Report:** Click `Export Report` to open a formatted executive report.

---

## 3. MATLAB & Simulink Execution

### Generate 100,000 Sample Dataset in MATLAB:
```matlab
cd 'd:\MATRIX\matlab'
T = generate_landslide_dataset(100000, 'landslide_dataset_100k.csv');
```

### Run Geotechnical Simulator & Analytics:
```matlab
cd 'd:\MATRIX\matlab'
landslide_digital_twin_simulator
```

### Train and Compare ML Models:
```matlab
cd 'd:\MATRIX\matlab'
train_landslide_ml_models
```

### Launch MATLAB Desktop App Designer GUI:
```matlab
cd 'd:\MATRIX\matlab'
app = landslide_app_designer;
```

### Generate & Open Simulink Model:
```matlab
cd 'd:\MATRIX\matlab'
simulink_landslide_digital_twin
```

---

## 4. Production Deployment with Docker (Optional)

Create a `Dockerfile` in the root:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir fastapi uvicorn scikit-learn pandas scipy
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
Build and run:
```bash
docker build -t geotwin-ai .
docker run -p 8000:8000 geotwin-ai
```
