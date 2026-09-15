"""
Geotechnical & Hydrological Physics Engine for Landslide Early Warning
Implements:
- Infinite Slope Stability Model with Pore Water Pressure & Pseudo-static Seismic Disturbance
- Green-Ampt Infiltration Dynamics & Groundwater Table Coupling
- Standard Geotechnical Soil Database (Clay, Sandy, Silty, Gravel, Laterite, Weathered Rock)
- Natural Disaster Scenarios (Cloudburst, Cyclone, Earthquake, Flash Flood, Groundwater Surge)
"""

import math
from typing import Dict, Any, Tuple

# Soil geotechnical parameter catalog based on literature (Das, Terzaghi, Bowles)
SOIL_DATABASE: Dict[str, Dict[str, Any]] = {
    "Clay": {
        "cohesion": 25.0,            # c (kPa)
        "friction_angle": 18.0,      # phi (degrees)
        "unit_weight": 18.0,         # gamma (kN/m^3)
        "saturated_k": 1e-8,         # k_sat (m/s)
        "porosity": 0.48,            # theta_s
        "residual_moisture": 0.15,   # theta_r
        "suction_head": 0.35,        # psi_f (m)
        "description": "Fine-grained cohesive soil with low permeability and high swelling/shrinkage."
    },
    "Sandy Soil": {
        "cohesion": 2.0,             # c (kPa)
        "friction_angle": 34.0,      # phi (degrees)
        "unit_weight": 19.0,         # gamma (kN/m^3)
        "saturated_k": 1e-4,         # k_sat (m/s)
        "porosity": 0.38,            # theta_s
        "residual_moisture": 0.05,   # theta_r
        "suction_head": 0.06,        # psi_f (m)
        "description": "Coarse-grained soil with rapid drainage and negligible cohesion."
    },
    "Silty Soil": {
        "cohesion": 12.0,            # c (kPa)
        "friction_angle": 26.0,      # phi (degrees)
        "unit_weight": 18.5,         # gamma (kN/m^3)
        "saturated_k": 1e-6,         # k_sat (m/s)
        "porosity": 0.44,            # theta_s
        "residual_moisture": 0.10,   # theta_r
        "suction_head": 0.20,        # psi_f (m)
        "description": "Intermediate grain size with moderate cohesion, susceptible to rapid liquefaction."
    },
    "Gravel": {
        "cohesion": 0.5,             # c (kPa)
        "friction_angle": 38.0,      # phi (degrees)
        "unit_weight": 20.5,         # gamma (kN/m^3)
        "saturated_k": 1e-3,         # k_sat (m/s)
        "porosity": 0.34,            # theta_s
        "residual_moisture": 0.03,   # theta_r
        "suction_head": 0.02,        # psi_f (m)
        "description": "High shear friction and very rapid permeability, vulnerable on very steep angles."
    },
    "Laterite": {
        "cohesion": 30.0,            # c (kPa)
        "friction_angle": 24.0,      # phi (degrees)
        "unit_weight": 19.5,         # gamma (kN/m^3)
        "saturated_k": 1e-6,         # k_sat (m/s)
        "porosity": 0.42,            # theta_s
        "residual_moisture": 0.12,   # theta_r
        "suction_head": 0.25,        # psi_f (m)
        "description": "Tropical weathered residual soil rich in iron/aluminum, prone to rain-induced slips."
    },
    "Weathered Rock": {
        "cohesion": 45.0,            # c (kPa)
        "friction_angle": 32.0,      # phi (degrees)
        "unit_weight": 22.0,         # gamma (kN/m^3)
        "saturated_k": 1e-5,         # k_sat (m/s)
        "porosity": 0.28,            # theta_s
        "residual_moisture": 0.04,   # theta_r
        "suction_head": 0.12,        # psi_f (m)
        "description": "Fractured jointed rock mass; high initial shear strength with joint plane instability."
    }
}

TERRAIN_RANGES = {
    "Gentle Slope": {"min_angle": 5.0, "max_angle": 15.0, "default": 10.0},
    "Moderate Slope": {"min_angle": 15.0, "max_angle": 30.0, "default": 22.0},
    "Steep Slope": {"min_angle": 30.0, "max_angle": 45.0, "default": 37.0},
    "Mountainous Terrain": {"min_angle": 45.0, "max_angle": 60.0, "default": 50.0}
}


def compute_factor_of_safety(
    cohesion: float,           # c in kPa
    friction_angle_deg: float, # phi in degrees
    unit_weight: float,        # gamma in kN/m^3
    depth: float,              # z in meters (slip surface depth)
    slope_angle_deg: float,    # theta in degrees
    pore_water_pressure: float,# u in kPa
    seismic_kh: float = 0.0,   # pseudo-static horizontal acceleration coefficient
    root_cohesion: float = 0.0 # additional bio-cohesion in kPa
) -> Tuple[float, str]:
    """
    Computes Factor of Safety (FoS) based on the Geotechnical Infinite Slope Stability Model:
    FoS = [ c + root_c + (gamma * z * cos^2(theta) - u - kh * gamma * z * sin(theta) * cos(theta)) * tan(phi) ] /
          [ gamma * z * sin(theta) * cos(theta) + kh * gamma * z * cos^2(theta) ]
    """
    # Near-vertical slope check (instability / toppling beyond infinite slope validity range)
    if slope_angle_deg >= 75.0:
        return 0.05, "Failure Imminent"

    # Flat ground check (no driving gravitational shear stress)
    if slope_angle_deg <= 0.5:
        return 10.0, "Safe"

    theta = math.radians(slope_angle_deg)
    phi = math.radians(friction_angle_deg)

    cos_theta = math.cos(theta)
    sin_theta = math.sin(theta)
    cos2_theta = cos_theta * cos_theta
    tan_phi = math.tan(phi)

    # Total weight term per unit area: W = gamma * z
    total_stress_norm = unit_weight * depth * cos2_theta

    # Driving shear stress (gravity + seismic component)
    shear_driving = unit_weight * depth * sin_theta * cos_theta
    if seismic_kh > 0:
        shear_driving += seismic_kh * unit_weight * depth * cos2_theta

    # Prevent division by zero on flat or near-flat ground
    if shear_driving <= 1e-4:
        return 10.0, "Safe"

    # Effective normal stress (accounting for pore water pressure and vertical seismic decomposition)
    effective_normal = total_stress_norm - pore_water_pressure
    if seismic_kh > 0:
        effective_normal -= seismic_kh * unit_weight * depth * sin_theta * cos_theta

    if effective_normal < 0:
        effective_normal = 0.0

    # Resisting shear strength
    resisting_force = (cohesion + root_cohesion) + effective_normal * tan_phi

    fos = resisting_force / shear_driving
    fos = round(max(0.05, min(fos, 10.0)), 3)

    # Classify safety factor
    if fos > 1.5:
        risk_level = "Safe"
    elif fos > 1.2:
        risk_level = "Moderate Risk"
    elif fos > 1.0:
        risk_level = "High Risk"
    else:
        risk_level = "Failure Imminent"

    return fos, risk_level


def green_ampt_step(
    rainfall_intensity_mm_hr: float,
    current_cumulative_inf_m: float,
    dt_hours: float,
    soil_params: Dict[str, Any],
    initial_moisture_ratio: float
) -> Tuple[float, float, float]:
    """
    Advances the Green-Ampt infiltration calculation by dt_hours.
    Returns:
    - new_cumulative_inf_m: Cumulative infiltration (m)
    - infiltration_rate_mm_hr: Actual infiltration rate (mm/h)
    - wetting_front_depth_m: Depth of wetting front (m, bounded by regolith layer)
    """
    k_sat_m_s = soil_params["saturated_k"]
    k_sat_mm_hr = k_sat_m_s * 1000.0 * 3600.0
    psi_f = soil_params["suction_head"]
    theta_s = soil_params["porosity"]
    theta_r = soil_params["residual_moisture"]

    # Moisture deficit
    current_theta = theta_r + initial_moisture_ratio * (theta_s - theta_r)
    delta_theta = max(0.02, theta_s - current_theta)

    # Potential infiltration capacity fc = Ksat * (1 + psi_f * delta_theta / F)
    F = max(1e-4, current_cumulative_inf_m)
    potential_rate = k_sat_mm_hr * (1.0 + (psi_f * delta_theta) / F)

    actual_rate = min(rainfall_intensity_mm_hr, potential_rate)
    delta_F = (actual_rate / 1000.0) * dt_hours
    new_F = current_cumulative_inf_m + delta_F

    # Physically bounded wetting front depth (cannot exceed regolith layer depth ~8.0m)
    wetting_front_depth = min(8.0, max(0.05, new_F / delta_theta))
    return new_F, actual_rate, wetting_front_depth


def compute_pore_pressure(
    depth_m: float,
    groundwater_table_depth_m: float,
    slope_angle_deg: float,
    wetting_front_depth_m: float = 0.0
) -> float:
    """
    Computes pore water pressure u at depth z (kPa).
    u = gamma_w * head * cos^2(theta)
    Head cannot exceed the physical depth of the slip surface below the ground surface.
    """
    gamma_w = 9.81  # kN/m^3
    theta = math.radians(slope_angle_deg)
    cos2 = math.cos(theta) ** 2

    if depth_m > groundwater_table_depth_m:
        # Hydrostatic positive pressure from groundwater table (bounded by total depth)
        head = min(depth_m, depth_m - max(0.0, groundwater_table_depth_m))
        u = gamma_w * head * cos2
    elif wetting_front_depth_m >= depth_m:
        # Wetting front saturation near surface creates perched water table
        head = min(depth_m, (wetting_front_depth_m - depth_m) * 0.4)
        u = gamma_w * head * cos2
    else:
        # Unsaturated zone capillary suction bounded
        u = 0.0

    return max(0.0, round(u, 2))


def earthquake_to_kh(magnitude: float, acceleration_g: float) -> float:
    """
    Derives pseudo-static horizontal seismic coefficient kh from Magnitude and Peak Ground Acceleration (PGA).
    Standard Eurocode 8 / Kramer geotechnical relation: kh ~= 0.5 * (PGA/g) for M >= 6.5, scaled.
    """
    if magnitude < 3.0 or acceleration_g <= 0:
        return 0.0
    scale = min(1.0, max(0.2, (magnitude - 3.0) / 4.5))
    kh = 0.5 * acceleration_g * scale
    return min(0.45, round(kh, 4))
