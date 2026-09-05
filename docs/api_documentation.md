# REST & WebSocket API Specification

The GeoTwin AI backend provides a full suite of RESTful endpoints and real-time WebSocket channels for external sensor integration, simulation control, and early warning queries.

**Base URL:** `http://127.0.0.1:8000`

---

## 1. REST Endpoints

### 1.1 System Health
* **Method:** `GET`
* **Path:** `/api/health`
* **Description:** Returns server status, ML model training state, and active disaster flags.
* **Example Response:**
  ```json
  {
    "status": "online",
    "digital_twin": "synchronized",
    "ml_engine_trained": true,
    "best_model": "Random Forest",
    "active_disaster": "None"
  }
  ```

### 1.2 Live Telemetry
* **Method:** `GET`
* **Path:** `/api/telemetry`
* **Description:** Retrieves the latest snapshot of virtual sensors, stability metrics, and environmental parameters.

### 1.3 Synthetic Dataset Generation
* **Method:** `POST`
* **Path:** `/api/generate-dataset?samples=100000`
* **Parameters:** `samples` (integer, 500 to 200,000).
* **Description:** Generates a synthetic dataset following geotechnical physics and exports to CSV.
* **cURL:**
  ```bash
  curl -X POST "http://127.0.0.1:8000/api/generate-dataset?samples=10000"
  ```

### 1.4 Train & Compare ML Models
* **Method:** `POST`
* **Path:** `/api/train-model`
* **Description:** Fits Random Forest, Gradient Boosted Trees, LightGBM, and Deep Sequence models on the dataset, returning full metrics and leaderboard rankings.

### 1.5 Real-Time Inference
* **Method:** `POST`
* **Path:** `/api/predict`
* **Payload:**
  ```json
  {
    "Soil_Type": "Clay",
    "Slope_Angle": 32.0,
    "Rainfall_Intensity": 65.0,
    "Rainfall_Duration": 8.0,
    "Soil_Moisture": 42.0,
    "Groundwater_Level": 2.1,
    "Pore_Water_Pressure": 18.5,
    "Temperature": 24.0,
    "Humidity": 85.0,
    "Earthquake_Magnitude": 0.0,
    "Acceleration": 0.0
  }
  ```
* **Example Response:**
  ```json
  {
    "model_used": "Random Forest",
    "landslide_predicted": false,
    "probability": 0.28,
    "probability_percent": 28.0,
    "risk_level": "Moderate Risk",
    "confidence": 72.0
  }
  ```

### 1.6 Early Warning Alerts
* **Method:** `GET`
* **Path:** `/api/get-alerts`
* **Description:** Returns active alert level (`Green`, `Yellow`, `Orange`, `Red`), FoS, and recommended response protocol.

### 1.7 2D Geospatial Risk Heatmap
* **Method:** `GET`
* **Path:** `/api/get-risk-map`
* **Description:** Returns a 2D matrix of localized safety factors across the slope distance and depth profile.

### 1.8 Inject Disaster Disturbance
* **Method:** `POST`
* **Path:** `/api/inject-disaster?disaster_type=Cloudburst&magnitude=6.8`
* **Supported Types:** `Cloudburst`, `Cyclone Rainfall`, `Extreme Rainfall`, `Earthquake`, `Flash Flood`, `Reservoir Overflow`, `Sudden Groundwater Surge`.

### 1.9 Reset Disaster
* **Method:** `POST`
* **Path:** `/api/reset-disaster`
* **Description:** Restores baseline dry/stable conditions in the digital twin.

### 1.10 Monte Carlo Simulation
* **Method:** `POST`
* **Path:** `/api/monte-carlo?iterations=2000`
* **Description:** Runs probabilistic uncertainty analysis across soil cohesion, friction, and pore pressure.

### 1.11 Export Geotechnical Report
* **Method:** `GET`
* **Path:** `/api/export-report`
* **Response:** Formatted HTML report printable as PDF.

---

## 2. WebSocket Telemetry Stream

* **Endpoint:** `ws://127.0.0.1:8000/ws/telemetry`
* **Protocol:** Continuous JSON broadcast every 1.2 seconds.
* **Payload Structure:**
  ```json
  {
    "status": "synchronized",
    "time_hours": 12.4,
    "environment": {
      "soil_type": "Clay",
      "slope_angle_deg": 28.0,
      "active_disaster": "None"
    },
    "stability": {
      "factor_of_safety": 1.68,
      "risk_level": "Safe",
      "alert_level": "Green",
      "landslide_probability": 0.08,
      "displacement_cm": 0.0,
      "action_recommendation": "Normal Monitoring"
    },
    "virtual_sensors": {
      "rain_gauge": { "value": 0.0, "unit": "mm/h" },
      "soil_moisture": { "value": 24.2, "unit": "%" },
      "piezometer_pressure": { "value": 0.0, "unit": "kPa" },
      "groundwater_depth": { "value": 4.8, "unit": "m" },
      "inclinometer_tilt": { "value": 0.0, "unit": "°" },
      "accelerometer_pga": { "value": 0.0, "unit": "g" }
    }
  }
  ```
