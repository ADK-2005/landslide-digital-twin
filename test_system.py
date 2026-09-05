"""
Automated Test Suite for Landslide Early Warning Digital Twin
Verifies:
1. Physics formulas (Factor of Safety, Green-Ampt, Seismic kh)
2. Synthetic dataset generator (all 16 required columns)
3. ML training & prediction engine
4. Digital Twin state transitions and disaster injection
"""

import sys
import unittest
import numpy as np
import pandas as pd

from backend.physics_engine import (
    compute_factor_of_safety,
    green_ampt_step,
    compute_pore_pressure,
    earthquake_to_kh,
    SOIL_DATABASE
)
from backend.dataset_generator import generate_landslide_dataset
from backend.ml_engine import ml_engine
from backend.digital_twin import digital_twin
from backend.report_generator import generate_html_report

class TestLandslideDigitalTwin(unittest.TestCase):

    def test_01_physics_factor_of_safety(self):
        """Test Infinite Slope Stability calculations under known conditions"""
        # Case A: Dry gentle slope with high cohesion (Clay) -> Must be Safe (FoS > 1.5)
        fos_safe, risk_safe = compute_factor_of_safety(
            cohesion=25.0,
            friction_angle_deg=18.0,
            unit_weight=18.0,
            depth=3.0,
            slope_angle_deg=12.0,
            pore_water_pressure=0.0,
            seismic_kh=0.0
        )
        self.assertGreater(fos_safe, 1.5, f"Expected FoS > 1.5 for gentle slope, got {fos_safe}")
        self.assertEqual(risk_safe, "Safe")

        # Case B: Saturated steep slope under severe seismic shock -> Must be Failure Imminent (FoS <= 1.0)
        fos_fail, risk_fail = compute_factor_of_safety(
            cohesion=2.0,
            friction_angle_deg=28.0,
            unit_weight=19.0,
            depth=4.0,
            slope_angle_deg=42.0,
            pore_water_pressure=35.0,
            seismic_kh=0.25
        )
        self.assertLessEqual(fos_fail, 1.0, f"Expected FoS <= 1.0 for unstable slope, got {fos_fail}")
        self.assertEqual(risk_fail, "Failure Imminent")

    def test_02_green_ampt_infiltration(self):
        """Test Green-Ampt hydrological infiltration mechanics"""
        soil = SOIL_DATABASE["Clay"]
        F_new, rate, wet_depth = green_ampt_step(
            rainfall_intensity_mm_hr=50.0,
            current_cumulative_inf_m=0.02,
            dt_hours=1.0,
            soil_params=soil,
            initial_moisture_ratio=0.3
        )
        self.assertGreater(F_new, 0.02)
        self.assertGreater(wet_depth, 0.0)
        self.assertGreaterEqual(rate, 0.0)

    def test_03_dataset_generator(self):
        """Test synthetic dataset generator schema and columns"""
        df = generate_landslide_dataset(n_samples=1000, random_seed=42)
        expected_cols = [
            "Timestamp", "Rainfall_Intensity", "Rainfall_Duration", "Soil_Moisture",
            "Groundwater_Level", "Pore_Water_Pressure", "Slope_Angle", "Soil_Type",
            "Temperature", "Humidity", "Earthquake_Magnitude", "Acceleration",
            "Factor_of_Safety", "Risk_Level", "Landslide_Occurrence", "Target_Label"
        ]
        self.assertEqual(len(df), 1000)
        self.assertEqual(list(df.columns), expected_cols)
        self.assertTrue((df["Factor_of_Safety"] > 0).all())
        self.assertTrue(set(df["Landslide_Occurrence"].unique()).issubset({0, 1}))

    def test_04_ml_engine_pipeline(self):
        """Test machine learning training and inference"""
        df = generate_landslide_dataset(n_samples=1200, random_seed=42)
        res = ml_engine.train_and_compare_models(df)
        self.assertEqual(res["status"], "success")
        self.assertIsNotNone(ml_engine.best_model_name)
        self.assertTrue(ml_engine.is_trained)

        # Test inference
        sample_input = {
            "Rainfall_Intensity": 85.0,
            "Rainfall_Duration": 12.0,
            "Soil_Moisture": 45.0,
            "Groundwater_Level": 1.2,
            "Pore_Water_Pressure": 28.0,
            "Slope_Angle": 38.0,
            "Soil_Type": "Clay",
            "Temperature": 24.0,
            "Humidity": 90.0,
            "Earthquake_Magnitude": 6.5,
            "Acceleration": 0.28
        }
        pred = ml_engine.predict(sample_input)
        self.assertIn("probability", pred)
        self.assertIn("risk_level", pred)
        self.assertGreaterEqual(pred["probability"], 0.0)
        self.assertLessEqual(pred["probability"], 1.0)

    def test_05_digital_twin_disaster_injection(self):
        """Test digital twin state changes under disaster simulation"""
        digital_twin.reset_disaster()
        init_fos = digital_twin.factor_of_safety

        # Inject Cloudburst
        digital_twin.inject_disaster("Cloudburst", duration_ticks=10)
        self.assertEqual(digital_twin.active_disaster, "Cloudburst")
        self.assertGreater(digital_twin.rainfall_intensity, 100.0)

        # Advance 3 steps
        for _ in range(3):
            digital_twin.step_simulation(dt_minutes=15.0)

        post_disaster_fos = digital_twin.factor_of_safety
        self.assertLess(post_disaster_fos, init_fos, "FoS must decrease during severe cloudburst")

        # Reset
        digital_twin.reset_disaster()
        self.assertIsNone(digital_twin.active_disaster)

    def test_06_report_generation(self):
        """Test HTML/PDF report synthesis"""
        telem = digital_twin.get_telemetry()
        ml_summary = {"best_model": "Random Forest", "metrics": {}}
        mc_summary = {"mean_fos": 1.65, "probability_of_failure_pct": 2.5}
        html = generate_html_report(telem, ml_summary, mc_summary)
        self.assertIn("Geotechnical Digital Twin Early Warning Report", html)
        self.assertIn("Factor of Safety", html)
        self.assertIn("RG-01 Optical Rain Gauge", html)

if __name__ == "__main__":
    unittest.main()
