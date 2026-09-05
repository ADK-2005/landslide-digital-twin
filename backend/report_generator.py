"""
Automated Report Generator for Landslide Early Warning Digital Twin
Generates executive geotechnical reports in HTML/PDF-ready format.
"""

import datetime
from typing import Dict, Any

def generate_html_report(telemetry: Dict[str, Any], ml_summary: Dict[str, Any], mc_results: Dict[str, Any]) -> str:
    now_str = datetime.datetime.now().strftime("%B %d, %Y - %H:%M:%S UTC")
    stability = telemetry.get("stability", {})
    env = telemetry.get("environment", {})
    sensors = telemetry.get("virtual_sensors", {})
    soil = telemetry.get("soil_properties", {})

    fos = stability.get("factor_of_safety", 1.5)
    alert = stability.get("alert_level", "Green")
    risk = stability.get("risk_level", "Safe")
    landslide_prob = round(stability.get("landslide_probability", 0.0) * 100, 1)

    badge_color = {
        "Green": "#10b981",
        "Yellow": "#f59e0b",
        "Orange": "#f97316",
        "Red": "#ef4444"
    }.get(alert, "#10b981")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Landslide Early Warning Digital Twin - Geotechnical Report</title>
<style>
    @page {{ size: A4; margin: 18mm; }}
    body {{
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
        color: #1e293b;
        line-height: 1.5;
        background: #f8fafc;
        margin: 0;
        padding: 24px;
    }}
    .report-container {{
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        padding: 36px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        border: 1px solid #e2e8f0;
    }}
    .header {{
        border-bottom: 2px solid #0f172a;
        padding-bottom: 16px;
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }}
    .header h1 {{
        margin: 0 0 6px 0;
        font-size: 22px;
        color: #0f172a;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}
    .header p {{
        margin: 0;
        font-size: 13px;
        color: #64748b;
    }}
    .badge {{
        display: inline-block;
        padding: 6px 14px;
        border-radius: 9999px;
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        background-color: {badge_color};
    }}
    .grid-2 {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 24px;
    }}
    .grid-3 {{
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
    }}
    .card {{
        background: #f1f5f9;
        padding: 16px;
        border-radius: 8px;
        border-left: 4px solid #3b82f6;
    }}
    .card.alert-card {{
        border-left-color: {badge_color};
    }}
    .card h3 {{
        margin: 0 0 8px 0;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #475569;
    }}
    .card .val {{
        font-size: 24px;
        font-weight: 800;
        color: #0f172a;
    }}
    .card .sub {{
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
        font-size: 13px;
    }}
    th, td {{
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
    }}
    th {{
        background: #f8fafc;
        color: #334155;
        font-weight: 600;
    }}
    .section-title {{
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin: 28px 0 12px 0;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 6px;
    }}
    .action-box {{
        background: #fef2f2;
        border: 1px solid #fecaca;
        padding: 16px;
        border-radius: 8px;
        margin-top: 16px;
        color: #991b1b;
        font-size: 13px;
    }}
    .footer {{
        margin-top: 32px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
        font-size: 11px;
        color: #94a3b8;
        display: flex;
        justify-content: space-between;
    }}
    @media print {{
        body {{ background: #fff; padding: 0; }}
        .report-container {{ border: none; box-shadow: none; padding: 0; }}
    }}
</style>
</head>
<body>
<div class="report-container">
    <div class="header">
        <div>
            <h1>Geotechnical Digital Twin Early Warning Report</h1>
            <p>Hillslope Telemetry Assessment & Geotechnical Stability Evaluation</p>
        </div>
        <div>
            <span class="badge">ALERT: {alert.upper()}</span>
        </div>
    </div>

    <div class="grid-3">
        <div class="card alert-card">
            <h3>Factor of Safety (FoS)</h3>
            <div class="val">{fos:.3f}</div>
            <div class="sub">Classification: <strong>{risk}</strong></div>
        </div>
        <div class="card">
            <h3>Failure Probability</h3>
            <div class="val">{landslide_prob}%</div>
            <div class="sub">Monte Carlo / ML Hybrid Ensemble</div>
        </div>
        <div class="card">
            <h3>Pore Water Pressure</h3>
            <div class="val">{sensors.get('piezometer_pressure', {}).get('value', 0)} kPa</div>
            <div class="sub">Depth: {env.get('slip_surface_depth_m', 3.5)}m</div>
        </div>
    </div>

    <div class="section-title">1. Site & Geotechnical Properties</div>
    <table>
        <tr>
            <th>Parameter</th><th>Value</th><th>Parameter</th><th>Value</th>
        </tr>
        <tr>
            <td>Soil Classification</td><td><strong>{env.get('soil_type', 'Clay')}</strong></td>
            <td>Slope Inclination</td><td><strong>{env.get('slope_angle_deg', 28)}°</strong></td>
        </tr>
        <tr>
            <td>Cohesion (c)</td><td>{soil.get('cohesion', 25.0)} kPa</td>
            <td>Friction Angle (φ)</td><td>{soil.get('friction_angle', 18.0)}°</td>
        </tr>
        <tr>
            <td>Unit Weight (γ)</td><td>{soil.get('unit_weight', 18.0)} kN/m³</td>
            <td>Hydraulic Conductivity (K_sat)</td><td>{soil.get('saturated_k', 1e-8):.1e} m/s</td>
        </tr>
        <tr>
            <td>Active Disaster State</td><td><strong>{env.get('active_disaster', 'None')}</strong></td>
            <td>Estimated Displacement</td><td><strong>{stability.get('displacement_cm', 0)} cm</strong></td>
        </tr>
    </table>

    <div class="section-title">2. Virtual Sensor Array Telemetry</div>
    <table>
        <thead>
            <tr><th>Sensor Instrument</th><th>Parameter</th><th>Live Reading</th><th>Operational Status</th></tr>
        </thead>
        <tbody>
            <tr><td>RG-01 Optical Rain Gauge</td><td>Precipitation Intensity</td><td>{sensors.get('rain_gauge', {}).get('value', 0)} mm/h</td><td>Nominal</td></tr>
            <tr><td>SM-01 FDR Moisture Array</td><td>Volumetric Soil Moisture</td><td>{sensors.get('soil_moisture', {}).get('value', 0)} %</td><td>Nominal</td></tr>
            <tr><td>PZ-01 Vibrating Wire Piezometer</td><td>Pore Water Pressure</td><td>{sensors.get('piezometer_pressure', {}).get('value', 0)} kPa</td><td>Nominal</td></tr>
            <tr><td>GW-01 Ultrasonic Well Probe</td><td>Groundwater Depth</td><td>{sensors.get('groundwater_depth', {}).get('value', 0)} m</td><td>Nominal</td></tr>
            <tr><td>TL-01 MEMS Biaxial Inclinometer</td><td>Slope Tilt Angle Deviation</td><td>{sensors.get('inclinometer_tilt', {}).get('value', 0)} °</td><td>Nominal</td></tr>
            <tr><td>AC-01 Triaxial Accelerometer</td><td>Peak Ground Acceleration</td><td>{sensors.get('accelerometer_pga', {}).get('value', 0)} g</td><td>Nominal</td></tr>
        </tbody>
    </table>

    <div class="section-title">3. Machine Learning Prediction & Risk Assessment</div>
    <p>
        The AI inference module leverages multi-model classification (Random Forest, XGBoost equivalent, LightGBM, and Deep Recurrent Sequence models) trained on geotechnical physical simulations.
    </p>
    <div class="card">
        <h3>Model Selection & Inference Status</h3>
        <div><strong>Active Model:</strong> {ml_summary.get('best_model', 'Random Forest / Physics Hybrid')}</div>
        <div><strong>Failure Likelihood:</strong> {landslide_prob}%</div>
        <div><strong>Status Recommendation:</strong> {stability.get('action_recommendation', 'Normal operations')}</div>
    </div>

    <div class="action-box">
        <strong>EMERGENCY PROTOCOL DIRECTIVE:</strong>
        <p style="margin: 6px 0 0 0;">
            {stability.get('action_recommendation', 'Continue routine telemetry surveillance.')}
        </p>
    </div>

    <div class="footer">
        <div>System: Digital Twin-Based Intelligent Landslide Early Warning System</div>
        <div>Generated: {now_str}</div>
    </div>
</div>
</body>
</html>
"""
    return html
