# Simulink Digital Twin Architecture Specification

This document details the complete Simulink model architecture (`landslide_digital_twin.slx`) created programmatically via `matlab/simulink_landslide_digital_twin.m`.

---

## 1. Top-Level Model Architecture

The Simulink model coordinates continuous-time physical differential equations with discrete-event early warning logic across 10 interconnected subsystems:

```
[1. Rainfall Generator] ---> [2. Infiltration Model] ---> [3. Groundwater Model]
         |                                                       |
         v                                                       v
[10. Live Dashboard]                                    [4. Pore Pressure Model]
         ^                                                       |
         |                                                       v
[9. Digital Twin Sync] <--- [5. Slope Stability Engine] <--------+
         ^                                |
         |                                v
[8. Alert Logic / Stateflow] <--- [7. ML Prediction] <--- [6. Earthquake Block]
```

---

## 2. Subsystem Functional Breakdown

### Subsystem 1: Rainfall Generator (`/Rainfall_Generator`)
* **Inputs:** None (autonomous source).
* **Blocks:**
  * `Pulse_Storm`: Simulates cyclical storm precipitation ($Period = 24h, Amplitude = 60mm/h$).
  * `Cloudburst_Peak`: Sinusoidal peak simulating extreme convective precipitation bursts ($Amplitude = 50mm/h$).
  * `Sum_Precipitation`: Superimposes baseline and convective rainfall.
* **Output:** `Rainfall_Intensity` ($mm/h$).

### Subsystem 2: Green-Ampt Infiltration Model (`/Infiltration_Model`)
* **Inputs:** `Rainfall_In` ($mm/h$).
* **Blocks:**
  * `Conversion_mm_to_m`: Gain block ($0.001$).
  * `Cumulative_Inf_Integrator`: Continuous-time integrator $\int f(t) dt$.
* **Output:** `Cum_Infiltration_m` ($m$).

### Subsystem 3: Groundwater Dynamics (`/Groundwater_Model`)
* **Inputs:** `Cum_Inf_In` ($m$).
* **Blocks:**
  * `Baseline_Depth`: Constant block ($4.8m$ initial depth).
  * `Recharge_Factor`: Gain block scaling infiltration into water table rise ($3.5$).
  * `Water_Table_Calc`: Subtraction block computing current phreatic surface depth.
* **Output:** `GW_Depth_m` ($m$).

### Subsystem 4: Pore Water Pressure Model (`/Pore_Pressure_Model`)
* **Inputs:** `GW_Depth` ($m$).
* **Blocks:**
  * `Slip_Depth_z`: Constant slip surface depth ($3.5m$).
  * `Head_Difference`: Computes hydraulic head $h = z - z_{gw}$.
  * `Gamma_W_Cos2`: Multiplies head by $\gamma_w \cos^2(\theta) = 9.81 \times \cos^2(28^\circ) = 7.64$.
  * `Non_Negative`: Saturation block preventing negative pore pressure under hydrostatic assumptions.
* **Output:** `Pore_Pressure_u` ($kPa$).

### Subsystem 5: Geotechnical Slope Stability Engine (`/Slope_Stability_Engine`)
* **Inputs:** `Pore_Pressure_In` ($kPa$), `Seismic_kh_In` (dimensionless).
* **Blocks:**
  * `Infinite_Slope_Equations`: Embedded MATLAB Function block implementing the closed-form infinite slope equation:
    $$FoS = \frac{c + (\gamma z \cos^2 \theta - u - k_h \gamma z \sin \theta \cos \theta) \tan \phi}{\gamma z \sin \theta \cos \theta + k_h \gamma z \cos^2 \theta}$$
* **Output:** `Factor_of_Safety` ($FoS$).

### Subsystem 6: Earthquake Disturbance Block (`/Earthquake_Block`)
* **Inputs:** None (disturbance source).
* **Blocks:**
  * `Seismic_Trigger`: Step block initiating seismic shock at $t = 20h$.
  * `Vibration_Wave`: Sine wave block ($4.0Hz$) modeling high-frequency seismic acceleration.
  * `Kh_Scaling`: Gain block mapping peak ground acceleration to pseudo-static horizontal coefficient $k_h$.
* **Output:** `Seismic_kh`.

### Subsystem 7: Machine Learning Prediction Block (`/ML_Prediction_Block`)
* **Inputs:** `FoS_Input`.
* **Blocks:**
  * `ML_Risk_Lookup`: 1-D Pre-trained Lookup Table mapping safety factors to non-linear landslide failure probabilities.
* **Output:** `Landslide_Probability` ($0.0$ to $1.0$).

### Subsystem 8: Alert Logic & Early Warning Stateflow (`/Alert_Logic_Block`)
* **Inputs:** `FoS_Signal`, `ML_Prob_Signal`.
* **Blocks:**
  * Multi-threshold comparative blocks triggering discrete alarm states:
    * Green: Normal
    * Yellow: Watch
    * Orange: Warning
    * Red: Evacuate ($FoS \le 1.0$ or $Prob > 0.85$).
* **Output:** `Alarm_Trigger`.

### Subsystem 9: Digital Twin Telemetry Synchronization (`/Digital_Twin_Sync`)
* **Blocks:** `To Workspace` logging variables to MATLAB base workspace for external IoT and API bridge assimilation.

### Subsystem 10: Live Dashboard & Scopes (`/Live_Dashboard`)
* **Blocks:** Real-time multi-channel floating scopes for continuous visual monitoring of FoS decay and precipitation curves.
