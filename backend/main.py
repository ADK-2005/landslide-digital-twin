"""
FastAPI Application & WebSocket Telemetry Server
Exposes all REST and streaming APIs for the Landslide Early Warning Digital Twin:
- /api/generate-dataset
- /api/run-simulation
- /api/train-model
- /api/predict
- /api/get-alerts
- /api/get-risk-map
- /api/export-report
- /api/monte-carlo
- /api/inject-disaster
- /api/reset-disaster
- /ws/telemetry (WebSocket real-time streaming)
"""

import os
import asyncio
import numpy as np
from typing import Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse

from backend.physics_engine import SOIL_DATABASE, TERRAIN_RANGES, compute_factor_of_safety
from backend.dataset_generator import generate_landslide_dataset
from backend.ml_engine import ml_engine
from backend.digital_twin import digital_twin
from backend.report_generator import generate_html_report

app = FastAPI(
    title="Digital Twin Landslide Early Warning System",
    description="Intelligent Geotechnical Landslide Digital Twin Platform with Machine Learning & 3D Web Dashboard",
    version="2.0.0"
)

# Enable CORS for local cross-origin development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dataset cache in memory
dataset_cache = {"df": None, "samples": 0}

@app.on_event("startup")
async def startup_event():
    print("Digital Twin Early Warning System initializing...")
    # Generate a lightweight initial baseline dataset if needed for ML warm-up
    try:
        df_init = generate_landslide_dataset(n_samples=5000, random_seed=42)
        dataset_cache["df"] = df_init
        dataset_cache["samples"] = len(df_init)
        ml_engine.train_and_compare_models(df_init)
        print("ML Models auto-trained on initial baseline dataset successfully.")
    except Exception as e:
        print(f"Initial ML warm-up notice: {e}")

@app.get("/api/health")
def get_health():
    return {
        "status": "online",
        "digital_twin": "synchronized",
        "ml_engine_trained": ml_engine.is_trained,
        "best_model": ml_engine.best_model_name,
        "active_disaster": digital_twin.active_disaster or "None"
    }

@app.get("/api/telemetry")
def get_telemetry():
    return digital_twin.get_telemetry()

@app.post("/api/generate-dataset")
def api_generate_dataset(samples: int = Query(default=10000, ge=500, le=200000)):
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", f"landslide_synthetic_{samples}.csv")
    df = generate_landslide_dataset(n_samples=samples, output_csv_path=out_path)
    dataset_cache["df"] = df
    dataset_cache["samples"] = len(df)

    preview = df.head(10).to_dict(orient="records")
    summary = {
        "total_rows": len(df),
        "columns": list(df.columns),
        "landslide_events": int(df["Landslide_Occurrence"].sum()),
        "risk_level_counts": df["Risk_Level"].value_counts().to_dict(),
        "preview": preview,
        "saved_path": out_path
    }
    return summary

@app.post("/api/run-simulation")
def api_run_simulation(
    soil_type: str = Query(default="Clay"),
    slope_angle: float = Query(default=28.0, ge=5.0, le=60.0),
    slip_depth: float = Query(default=3.5, ge=1.0, le=8.0),
    rainfall_intensity: float = Query(default=35.0, ge=0.0, le=250.0),
    rainfall_duration: float = Query(default=6.0, ge=0.0, le=72.0),
    earthquake_mag: float = Query(default=0.0, ge=0.0, le=8.5)
):
    digital_twin.set_environment(soil_type, slope_angle, slip_depth=slip_depth)
    digital_twin.rainfall_intensity = rainfall_intensity
    digital_twin.rainfall_duration_hours = rainfall_duration
    digital_twin.earthquake_mag = earthquake_mag
    digital_twin.acceleration_g = round(10 ** (0.24 * earthquake_mag - 2.1), 3) if earthquake_mag >= 3.0 else 0.0

    # Step simulation
    for _ in range(5):
        digital_twin.step_simulation(dt_minutes=15.0)

    return digital_twin.get_telemetry()

@app.post("/api/train-model")
def api_train_model():
    if dataset_cache["df"] is None:
        df = generate_landslide_dataset(n_samples=8000)
        dataset_cache["df"] = df
        dataset_cache["samples"] = len(df)
    else:
        df = dataset_cache["df"]

    results = ml_engine.train_and_compare_models(df)
    return results

@app.post("/api/predict")
def api_predict(data: Dict[str, Any]):
    return ml_engine.predict(data)

@app.get("/api/get-alerts")
def api_get_alerts():
    telem = digital_twin.get_telemetry()
    stability = telem["stability"]
    return {
        "alert_level": stability["alert_level"],
        "risk_level": stability["risk_level"],
        "factor_of_safety": stability["factor_of_safety"],
        "probability": stability["landslide_probability"],
        "action_recommendation": stability["action_recommendation"],
        "sensors": telem["virtual_sensors"]
    }

@app.get("/api/get-risk-map")
def api_get_risk_map():
    """
    Returns 2D grid slice of slope safety factors across slope cross-section.
    """
    soil = SOIL_DATABASE[digital_twin.soil_type]
    base_angle = digital_twin.slope_angle

    # Generate 15x15 spatial stability grid
    grid = []
    x_coords = np.linspace(0, 100, 15)
    y_depths = np.linspace(0.5, 8.0, 12)

    for depth in y_depths:
        row = []
        for x in x_coords:
            # Vary local slope curvature and pore pressure with depth
            local_angle = max(5.0, min(58.0, base_angle + 6.0 * np.sin(x / 18.0)))
            local_u = digital_twin.pore_water_pressure * (depth / max(0.1, digital_twin.slip_surface_depth))
            fos, rk = compute_factor_of_safety(
                cohesion=soil["cohesion"],
                friction_angle_deg=soil["friction_angle"],
                unit_weight=soil["unit_weight"],
                depth=depth,
                slope_angle_deg=local_angle,
                pore_water_pressure=local_u,
                seismic_kh=round(digital_twin.acceleration_g * 0.4, 3)
            )
            row.append({"x": round(x, 1), "depth": round(depth, 1), "fos": fos, "risk": rk})
        grid.append(row)

    return {
        "soil_type": digital_twin.soil_type,
        "base_slope_angle": base_angle,
        "grid": grid
    }

@app.post("/api/inject-disaster")
def api_inject_disaster(
    disaster_type: str = Query(..., description="Cloudburst, Cyclone Rainfall, Extreme Rainfall, Earthquake, Flash Flood, Reservoir Overflow, Sudden Groundwater Surge"),
    magnitude: float = Query(default=6.5, ge=3.0, le=8.5)
):
    res = digital_twin.inject_disaster(disaster_type, magnitude=magnitude, duration_ticks=40)
    return res

@app.post("/api/reset-disaster")
def api_reset_disaster():
    digital_twin.reset_disaster()
    return {"status": "Disaster cleared, baseline restored"}

@app.post("/api/monte-carlo")
def api_monte_carlo(iterations: int = Query(default=2000, ge=100, le=10000)):
    return digital_twin.run_monte_carlo(n_iterations=iterations)

@app.get("/api/export-report", response_class=HTMLResponse)
def api_export_report():
    telem = digital_twin.get_telemetry()
    ml_info = {
        "best_model": ml_engine.best_model_name,
        "metrics": ml_engine.metrics
    }
    mc_info = digital_twin.run_monte_carlo(n_iterations=500)
    html_content = generate_html_report(telem, ml_info, mc_info)
    return HTMLResponse(content=html_content)

# WebSocket connection manager for live dashboard streaming
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Initial burst
        await websocket.send_json(digital_twin.get_telemetry())
        while True:
            # Advance twin state dynamically every tick
            telem = digital_twin.step_simulation(dt_minutes=2.0)
            await websocket.send_json(telem)
            await asyncio.sleep(1.2)  # Stream update every 1.2 seconds
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# Mount frontend static directory
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
