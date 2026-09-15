"""
Digital Twin Core Engine & Virtual Sensor Synchronizer
Maintains live hillslope geotechnical state, integrates virtual sensors,
evaluates multi-criteria early warning thresholds, and supports disaster injection.
"""

import time
import math
import random
import numpy as np
from typing import Dict, Any, List, Optional
from backend.physics_engine import (
    SOIL_DATABASE,
    TERRAIN_RANGES,
    compute_factor_of_safety,
    green_ampt_step,
    compute_pore_pressure,
    earthquake_to_kh
)
from backend.ml_engine import ml_engine

class HillslopeDigitalTwin:
    def __init__(self):
        # Configuration
        self.soil_type: str = "Clay"
        self.terrain_type: str = "Moderate Slope"
        self.slope_angle: float = 28.0      # degrees
        self.slip_surface_depth: float = 3.5 # meters
        self.slope_height: float = 45.0     # meters
        self.slope_length: float = 120.0    # meters

        # Dynamic State Variables
        self.simulation_time_hours: float = 0.0
        self.rainfall_intensity: float = 0.0      # mm/h
        self.rainfall_duration_hours: float = 0.0  # continuous rain duration
        self.cumulative_infiltration: float = 0.05 # meters
        self.groundwater_depth: float = 4.8        # meters below surface (initially dry/deep)
        self.wetting_front_depth: float = 0.4      # meters
        self.pore_water_pressure: float = 0.0      # kPa
        self.soil_moisture_pct: float = 24.0       # %
        self.temperature: float = 26.5             # °C
        self.humidity: float = 62.0                # %
        self.tilt_angle_deviation: float = 0.0     # degrees tilt from baseline
        self.acceleration_g: float = 0.0           # PGA in g
        self.earthquake_mag: float = 0.0
        self.factor_of_safety: float = 1.68        # Initial FoS
        self.risk_level: str = "Safe"
        self.alert_level: str = "Green"            # Green, Yellow, Orange, Red
        self.landslide_prob: float = 0.08
        self.ml_risk_level: str = "Safe"
        self.displacement_cm: float = 0.0          # Cumulative creep/displacement

        # Disaster injection active status
        self.active_disaster: Optional[str] = None
        self.disaster_remaining_ticks: int = 0

        # Telemetry history buffer for charts
        self.history_limit: int = 100
        self.history: List[Dict[str, Any]] = []

        # Virtual Sensor Array Positions (for 3D visual mapping)
        self.sensors_layout = [
            {"id": "RG-01", "name": "Rain Gauge", "type": "rain_gauge", "x": 0.0, "y": 45.0, "z": 10.0, "status": "active"},
            {"id": "SM-01", "name": "Soil Moisture Array", "type": "moisture", "x": 20.0, "y": 35.0, "z": 30.0, "status": "active"},
            {"id": "TL-01", "name": "Biaxial Inclinometer / Tilt", "type": "tilt", "x": 30.0, "y": 28.0, "z": 45.0, "status": "active"},
            {"id": "AC-01", "name": "Triaxial Accelerometer", "type": "accelerometer", "x": 35.0, "y": 25.0, "z": 55.0, "status": "active"},
            {"id": "PZ-01", "name": "Vibrating Wire Piezometer", "type": "piezometer", "x": 40.0, "y": 20.0, "z": 65.0, "status": "active"},
            {"id": "GW-01", "name": "Groundwater Level Sensor", "type": "groundwater", "x": 50.0, "y": 12.0, "z": 80.0, "status": "active"},
            {"id": "TH-01", "name": "Meteo Temp/Humidity", "type": "weather", "x": 10.0, "y": 42.0, "z": 15.0, "status": "active"}
        ]

    def set_environment(self, soil_type: str, slope_angle: float, terrain_type: Optional[str] = None, slip_depth: Optional[float] = None):
        if soil_type in SOIL_DATABASE:
            self.soil_type = soil_type
        if 5.0 <= slope_angle <= 60.0:
            self.slope_angle = slope_angle
        if terrain_type:
            self.terrain_type = terrain_type
        if slip_depth is not None and 1.0 <= slip_depth <= 8.0:
            self.slip_surface_depth = slip_depth
        self._recompute_physics()

    def inject_disaster(self, disaster_type: str, magnitude: float = 6.5, duration_ticks: int = 30) -> Dict[str, Any]:
        """
        Injects real-time natural disaster disturbance:
        - Cloudburst (e.g. 150 mm/h deluge)
        - Extreme Rainfall / Cyclone (continuous 80 mm/h)
        - Earthquake (pseudo-static seismic force, high PGA vibration)
        - Flash Flood / Reservoir Overflow
        - Sudden Groundwater Surge
        """
        self.active_disaster = disaster_type
        self.disaster_remaining_ticks = duration_ticks

        if disaster_type == "Cloudburst":
            self.rainfall_intensity = 145.0
            self.rainfall_duration_hours = max(1.0, self.rainfall_duration_hours + 1.5)
            self.cumulative_infiltration += 0.14
            self.groundwater_depth = max(0.6, self.groundwater_depth - 2.6)
        elif disaster_type == "Cyclone Rainfall":
            self.rainfall_intensity = 85.0
            self.rainfall_duration_hours += 8.0
            self.cumulative_infiltration += 0.18
            self.groundwater_depth = max(0.4, self.groundwater_depth - 3.2)
        elif disaster_type == "Extreme Rainfall":
            self.rainfall_intensity = 60.0
            self.rainfall_duration_hours += 5.0
            self.cumulative_infiltration += 0.10
            self.groundwater_depth = max(1.0, self.groundwater_depth - 2.0)
        elif disaster_type == "Earthquake":
            self.earthquake_mag = magnitude
            self.acceleration_g = round(10 ** (0.24 * magnitude - 2.1), 3)
        elif disaster_type == "Sudden Groundwater Surge":
            self.groundwater_depth = max(0.4, self.groundwater_depth - 2.8)
        elif disaster_type in ["Flash Flood", "Reservoir Overflow"]:
            self.cumulative_infiltration += 0.15
            self.groundwater_depth = max(0.3, self.groundwater_depth - 3.2)
            self.rainfall_intensity = 40.0

        self._recompute_physics()
        return {
            "disaster": disaster_type,
            "duration_ticks": duration_ticks,
            "status": "Injected successfully into Digital Twin"
        }

    def reset_disaster(self):
        self.active_disaster = None
        self.disaster_remaining_ticks = 0
        self.earthquake_mag = 0.0
        self.acceleration_g = 0.0
        self.rainfall_intensity = 0.0
        self.rainfall_duration_hours = 0.0
        self.tilt_angle_deviation = 0.0
        self.displacement_cm = 0.0
        self.groundwater_depth = 4.8
        self.cumulative_infiltration = 0.05
        self.wetting_front_depth = 0.4
        self.soil_moisture_pct = 24.0
        self.pore_water_pressure = 0.0
        self._recompute_physics()

    def step_simulation(self, dt_minutes: float = 5.0) -> Dict[str, Any]:
        """
        Advances the digital twin state by dt_minutes.
        """
        dt_hours = dt_minutes / 60.0
        self.simulation_time_hours += dt_hours

        # Handle active disaster expiration
        if self.disaster_remaining_ticks > 0:
            self.disaster_remaining_ticks -= 1
            if self.disaster_remaining_ticks <= 0:
                self.active_disaster = None
                self.earthquake_mag = max(0.0, self.earthquake_mag * 0.2)
                self.acceleration_g = max(0.0, self.acceleration_g * 0.2)

        # Natural decay or random weather fluctuations when no disaster active
        if self.active_disaster is None:
            # Gentle background weather drift
            if self.rainfall_intensity > 0:
                self.rainfall_intensity = max(0.0, self.rainfall_intensity - 1.5 * dt_hours)
                self.rainfall_duration_hours += dt_hours
            else:
                self.rainfall_duration_hours = max(0.0, self.rainfall_duration_hours - 0.2 * dt_hours)

            self.acceleration_g = max(0.0, self.acceleration_g - 0.05)
            self.earthquake_mag = max(0.0, self.earthquake_mag - 0.5)

            # Drainage drops groundwater level slowly toward baseline (4.8m)
            if self.groundwater_depth < 4.8 and self.rainfall_intensity == 0:
                self.groundwater_depth = min(4.8, self.groundwater_depth + 0.05 * dt_hours)

        # Advance Green-Ampt hydrological infiltration
        soil = SOIL_DATABASE[self.soil_type]
        new_cum_inf, act_rate, wet_depth = green_ampt_step(
            rainfall_intensity_mm_hr=self.rainfall_intensity,
            current_cumulative_inf_m=self.cumulative_infiltration,
            dt_hours=dt_hours,
            soil_params=soil,
            initial_moisture_ratio=self.soil_moisture_pct / 100.0
        )
        self.cumulative_infiltration = new_cum_inf
        self.wetting_front_depth = wet_depth

        # Groundwater recharge from infiltration
        if self.rainfall_intensity > 0:
            recharge = (act_rate / 1000.0) * dt_hours / soil["porosity"]
            self.groundwater_depth = max(0.2, self.groundwater_depth - recharge * 1.5)

        # Update moisture percentage
        sat_fraction = max(0.2, min(1.0, 0.25 + (self.cumulative_infiltration * 2.2)))
        self.soil_moisture_pct = round(
            (soil["residual_moisture"] + sat_fraction * (soil["porosity"] - soil["residual_moisture"])) * 100.0,
            2
        )

        # Compute pore water pressure u
        self.pore_water_pressure = compute_pore_pressure(
            depth_m=self.slip_surface_depth,
            groundwater_table_depth_m=self.groundwater_depth,
            slope_angle_deg=self.slope_angle,
            wetting_front_depth_m=self.wetting_front_depth
        )

        # Compute FoS and stability
        self._recompute_physics()

        # Displacement creep when FoS drops
        if self.factor_of_safety < 1.2:
            creep_rate = (1.25 - self.factor_of_safety) * 1.8 * dt_hours
            if self.factor_of_safety <= 1.0:
                creep_rate += 12.0 * dt_hours  # rapid sliding
            self.displacement_cm += creep_rate
            self.tilt_angle_deviation = min(15.0, self.tilt_angle_deviation + creep_rate * 0.15)
        else:
            self.tilt_angle_deviation = max(0.0, self.tilt_angle_deviation - 0.01)

        telemetry = self.get_telemetry()

        # Store in history
        self.history.append({
            "timestamp": time.strftime("%H:%M:%S"),
            "time_hours": round(self.simulation_time_hours, 2),
            "fos": self.factor_of_safety,
            "rainfall": round(self.rainfall_intensity, 1),
            "groundwater": round(self.groundwater_depth, 2),
            "pore_pressure": round(self.pore_water_pressure, 1),
            "moisture": round(self.soil_moisture_pct, 1),
            "acceleration": round(self.acceleration_g, 3),
            "risk_level": self.risk_level,
            "alert_level": self.alert_level,
            "displacement": round(self.displacement_cm, 2)
        })
        if len(self.history) > self.history_limit:
            self.history.pop(0)

        return telemetry

    def _recompute_physics(self):
        # Dynamically recalculate pore water pressure u from current hillslope state
        self.pore_water_pressure = compute_pore_pressure(
            depth_m=self.slip_surface_depth,
            groundwater_table_depth_m=self.groundwater_depth,
            slope_angle_deg=self.slope_angle,
            wetting_front_depth_m=self.wetting_front_depth
        )

        soil = SOIL_DATABASE[self.soil_type]
        kh = earthquake_to_kh(self.earthquake_mag, self.acceleration_g)

        fos, risk = compute_factor_of_safety(
            cohesion=soil["cohesion"],
            friction_angle_deg=soil["friction_angle"],
            unit_weight=soil["unit_weight"],
            depth=self.slip_surface_depth,
            slope_angle_deg=self.slope_angle,
            pore_water_pressure=self.pore_water_pressure,
            seismic_kh=kh
        )
        self.factor_of_safety = fos
        self.risk_level = risk

        # Evaluate ML Prediction
        ml_res = ml_engine.predict({
            "Rainfall_Intensity": self.rainfall_intensity,
            "Rainfall_Duration": self.rainfall_duration_hours,
            "Soil_Moisture": self.soil_moisture_pct,
            "Groundwater_Level": self.groundwater_depth,
            "Pore_Water_Pressure": self.pore_water_pressure,
            "Slope_Angle": self.slope_angle,
            "Soil_Type": self.soil_type,
            "Temperature": self.temperature,
            "Humidity": self.humidity,
            "Earthquake_Magnitude": self.earthquake_mag,
            "Acceleration": self.acceleration_g,
            "Factor_of_Safety": self.factor_of_safety
        })
        self.landslide_prob = ml_res["probability"]
        self.ml_risk_level = ml_res.get("risk_level", "Safe")

        # Multi-criteria alert fusion: FoS + Rain intensity + Water table + ML Probability
        if self.factor_of_safety <= 1.0 or self.landslide_prob > 0.85:
            self.alert_level = "Red"
        elif self.factor_of_safety <= 1.20 or self.landslide_prob > 0.60 or self.rainfall_intensity > 80.0:
            self.alert_level = "Orange"
        elif self.factor_of_safety <= 1.50 or self.landslide_prob > 0.35 or self.rainfall_intensity > 35.0:
            self.alert_level = "Yellow"
        else:
            self.alert_level = "Green"

    def get_telemetry(self) -> Dict[str, Any]:
        """
        Returns full telemetry packet matching 10 dashboard panels and 3D twin.
        """
        # Formulate alert actions
        action_map = {
            "Green": "Normal Monitoring. All slope stability metrics within scientific safety thresholds.",
            "Yellow": "Watch: Increase sensor sampling frequency. Geotechnical team on standby.",
            "Orange": "Warning: High pore pressure / intense rainfall detected. Prep evacuation routes.",
            "Red": "EVACUATE IMMEDIATELY: Failure imminent! Sirens triggered. Clear downslope perimeter."
        }

        # Virtual sensor readings with realistic sensor noise
        noise_rain = max(0.0, self.rainfall_intensity + random.uniform(-0.4, 0.4) if self.rainfall_intensity > 0 else 0.0)
        noise_sm = max(10.0, min(95.0, self.soil_moisture_pct + random.uniform(-0.3, 0.3)))
        noise_pga = max(0.0, self.acceleration_g + (random.uniform(-0.005, 0.005) if self.acceleration_g > 0 else 0.0))
        noise_u = max(0.0, self.pore_water_pressure + random.uniform(-0.2, 0.2))

        return {
            "status": "synchronized",
            "time_hours": round(self.simulation_time_hours, 2),
            "environment": {
                "soil_type": self.soil_type,
                "terrain_type": self.terrain_type,
                "slope_angle_deg": round(self.slope_angle, 1),
                "slip_surface_depth_m": round(self.slip_surface_depth, 2),
                "active_disaster": self.active_disaster or "None"
            },
            "stability": {
                "factor_of_safety": round(self.factor_of_safety, 3),
                "risk_level": self.risk_level,
                "alert_level": self.alert_level,
                "landslide_probability": round(self.landslide_prob, 4),
                "ml_risk_level": self.ml_risk_level,
                "displacement_cm": round(self.displacement_cm, 2),
                "action_recommendation": action_map[self.alert_level]
            },
            "virtual_sensors": {
                "rain_gauge": {"value": round(noise_rain, 1), "unit": "mm/h", "status": "nominal"},
                "soil_moisture": {"value": round(noise_sm, 1), "unit": "%", "status": "nominal"},
                "inclinometer_tilt": {"value": round(self.tilt_angle_deviation + random.uniform(-0.02, 0.02), 2), "unit": "°", "status": "nominal"},
                "accelerometer_pga": {"value": round(noise_pga, 3), "unit": "g", "status": "nominal"},
                "piezometer_pressure": {"value": round(noise_u, 1), "unit": "kPa", "status": "nominal"},
                "groundwater_depth": {"value": round(self.groundwater_depth, 2), "unit": "m", "status": "nominal"},
                "temperature": {"value": round(self.temperature + random.uniform(-0.2, 0.2), 1), "unit": "°C", "status": "nominal"},
                "humidity": {"value": round(min(100.0, self.humidity + random.uniform(-0.5, 0.5)), 1), "unit": "%", "status": "nominal"}
            },
            "sensor_nodes": self.sensors_layout,
            "soil_properties": SOIL_DATABASE[self.soil_type],
            "history": self.history[-30:] # recent 30 samples for sparklines
        }

    def run_monte_carlo(self, n_iterations: int = 2000) -> Dict[str, Any]:
        """
        Executes Monte Carlo uncertainty analysis varying cohesion, friction angle, and pore pressure.
        """
        soil = SOIL_DATABASE[self.soil_type]
        mean_c = soil["cohesion"]
        mean_phi = soil["friction_angle"]
        mean_gamma = soil["unit_weight"]

        # Sample Gaussian distributions
        c_samples = np.random.normal(loc=mean_c, scale=mean_c * 0.18, size=n_iterations)
        phi_samples = np.random.normal(loc=mean_phi, scale=mean_phi * 0.12, size=n_iterations)
        u_samples = np.random.normal(loc=self.pore_water_pressure, scale=max(1.0, self.pore_water_pressure * 0.25), size=n_iterations)

        c_samples = np.clip(c_samples, 0.5, 90.0)
        phi_samples = np.clip(phi_samples, 10.0, 48.0)
        u_samples = np.clip(u_samples, 0.0, 150.0)

        kh = earthquake_to_kh(self.earthquake_mag, self.acceleration_g)
        fos_results = []
        failures = 0

        for i in range(n_iterations):
            fos, _ = compute_factor_of_safety(
                cohesion=c_samples[i],
                friction_angle_deg=phi_samples[i],
                unit_weight=mean_gamma,
                depth=self.slip_surface_depth,
                slope_angle_deg=self.slope_angle,
                pore_water_pressure=u_samples[i],
                seismic_kh=kh
            )
            fos_results.append(fos)
            if fos <= 1.0:
                failures += 1

        fos_arr = np.array(fos_results)
        pof = (failures / n_iterations) * 100.0

        return {
            "iterations": n_iterations,
            "probability_of_failure_pct": round(pof, 2),
            "mean_fos": round(float(np.mean(fos_arr)), 3),
            "std_fos": round(float(np.std(fos_arr)), 3),
            "min_fos": round(float(np.min(fos_arr)), 3),
            "max_fos": round(float(np.max(fos_arr)), 3),
            "percentile_5": round(float(np.percentile(fos_arr, 5)), 3),
            "percentile_50": round(float(np.median(fos_arr)), 3),
            "percentile_95": round(float(np.percentile(fos_arr, 95)), 3),
            "histogram_bins": [round(float(b), 2) for b in np.histogram(fos_arr, bins=12)[1]],
            "histogram_counts": [int(c) for c in np.histogram(fos_arr, bins=12)[0]]
        }

# Global singleton
digital_twin = HillslopeDigitalTwin()
