# Changelog

All notable changes to the **Digital Twin Landslide Early Warning System** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-baseline] - 2026-09-05

### Added
- **Geotechnical Physics Engine (`backend/physics_engine.py`):**
  - Infinite Slope Stability Model with pore water pressure ($u$) and pseudo-static seismic coefficient ($k_h$).
  - Green-Ampt 1D infiltration mechanics and groundwater table coupling.
  - Comprehensive standard geotechnical soil property catalog (Clay, Sandy Soil, Silty Soil, Gravel, Laterite, Weathered Rock).
  - Slope terrain classifications (Gentle, Moderate, Steep, Mountainous from $5^\circ$ to $60^\circ$).
- **Synthetic Dataset Generator (`backend/dataset_generator.py`, `matlab/generate_landslide_dataset.m`):**
  - Generates 100,000+ realistic observations with all 16 standardized features.
  - Export support to CSV (`landslide_synthetic_100k.csv`) and MATLAB MAT format.
- **Machine Learning Engine (`backend/ml_engine.py`, `matlab/train_landslide_ml_models.m`):**
  - 4 candidate ML models: Random Forest, XGBoost (GBDT), LightGBM (HistGB), Deep Sequence Neural Net.
  - Automated evaluation pipeline: Accuracy, Precision, Recall, F1 Score, ROC-AUC, and Confusion Matrix.
  - Automatic best model selection and real-time inference API.
- **Cyber-Physical Digital Twin Engine (`backend/digital_twin.py`):**
  - Real-time hillslope state manager with Green-Ampt hydrological time-stepping.
  - Virtual sensor array emulation across 8 physical channels.
  - Multi-criteria early warning alert synthesis (Green, Yellow, Orange, Red).
  - Natural Disaster Simulation Studio with 7 parameterized disturbance scenarios.
  - Monte Carlo probabilistic uncertainty engine (2,000 stochastic draws).
- **FastAPI Backend & WebSocket Streaming (`backend/main.py`):**
  - 12 REST API endpoints for telemetry, dataset generation, ML training, prediction, alert query, and reporting.
  - WebSocket real-time telemetry broadcast channel (`ws://127.0.0.1:8000/ws/telemetry`).
- **Interactive 3D Web Dashboard (`frontend/`):**
  - Three.js WebGL 3D Hillslope viewer with interactive rotation, pan, zoom, dynamic slope mesh deformation, and real-time FoS vertex color mapping.
  - 10 dedicated monitoring panels matching all project requirements.
  - Chart.js dynamic real-time telemetry curves for rainfall, pore pressure, groundwater, seismic PGA, and safety factor.
  - Interactive Disaster Injection Studio and Monte Carlo visualization modal.
- **MATLAB & Simulink Platform (`matlab/`):**
  - Programmatic Simulink digital twin model builder with 10 dedicated functional subsystems (`simulink_landslide_digital_twin.m`).
  - Standalone MATLAB App Designer desktop GUI (`landslide_app_designer.m`).
  - MATLAB 48-hour physical simulation and multi-panel plotting suite (`landslide_digital_twin_simulator.m`).
- **Automated Verification Suite (`test_system.py`):**
  - 6 unit tests covering physics formulas, Green-Ampt infiltration, dataset generator, ML pipeline, disaster injection, and report generation.
- **Comprehensive Documentation (`docs/`, `BASELINE.md`):**
  - `BASELINE.md`: Comprehensive system baseline specification.
  - `docs/api_documentation.md`: Full REST and WebSocket API specification.
  - `docs/deployment_guide.md`: Quickstart and execution guide.
  - `docs/research_paper_documentation.md`: Geotechnical theory and research paper style reference.
  - `docs/simulink_architecture.md`: Simulink 10-subsystem structural blueprint.
- **Repository Setup:**
  - Standard `.gitignore` for Python, MATLAB, Simulink, Node.js, Vite, and OS files.
