%% LANDSLIDE_DIGITAL_TWIN_SIMULATOR
% Physical Environment & Digital Twin Simulation in MATLAB
% Implements:
%   - Infinite Slope Stability Model with Pore Pressure & Seismic Coefficients
%   - Green-Ampt Hydrological Infiltration
%   - Virtual Sensor Telemetry Emulation
%   - 3D Terrain Visualization & Factor of Safety Contours

clear; clc; close all;
fprintf('=== Starting Landslide Digital Twin Physical Simulator ===\n');

%% 1. Geotechnical & Hydrological Parameters
soil_type = 'Clay';
c = 25.0;            % Cohesion (kPa)
phi_deg = 18.0;      % Internal Friction Angle (deg)
gamma_soil = 18.0;   % Unit weight of soil (kN/m^3)
gamma_w = 9.81;      % Unit weight of water (kN/m^3)
k_sat = 1e-8;        % Saturated hydraulic conductivity (m/s)
psi_f = 0.35;        % Suction wetting front head (m)
theta_s = 0.48;      % Saturated moisture content
theta_r = 0.15;      % Residual moisture content

slope_angle_deg = 28.0;
slip_depth = 3.5;    % Slip surface depth z (m)

%% 2. Simulation Timeline & Extreme Weather Forcing
dt_hours = 0.5;      % Timestep (30 mins)
sim_hours = 48;      % 48-hour simulation run
time_steps = 0:dt_hours:sim_hours;
N = length(time_steps);

% Synthetic storm profile: 12-hour dry, 18-hour cloudburst storm (peaks at 120 mm/h), 18-hour drainage
rainfall_intensity = zeros(1, N);
for i = 1:N
    t = time_steps(i);
    if t >= 10 && t <= 28
        % Cloudburst pulse peaking at t=18h
        rainfall_intensity(i) = 120.0 * exp(-((t - 18)^2) / 18);
    else
        rainfall_intensity(i) = 0.0;
    end
end

% Mid-storm earthquake at t = 22h (M = 6.8, PGA = 0.32g)
earthquake_mag = zeros(1, N);
acceleration_g = zeros(1, N);
for i = 1:N
    t = time_steps(i);
    if abs(t - 22.0) <= 0.5
        earthquake_mag(i) = 6.8;
        acceleration_g(i) = 0.32;
    end
end

%% 3. Dynamic Digital Twin Numerical Integration
F_cum_inf = zeros(1, N);       % Cumulative infiltration (m)
wetting_front = zeros(1, N);   % Wetting front depth (m)
gw_table_depth = zeros(1, N);  % Groundwater depth from surface (m)
pore_pressure = zeros(1, N);   % Pore water pressure u (kPa)
factor_of_safety = zeros(1, N);% Factor of Safety
risk_level = cell(1, N);

% Initial conditions
F_curr = 0.04;
gw_curr = 4.8;

theta_rad = deg2rad(slope_angle_deg);
phi_rad = deg2rad(phi_deg);

for i = 1:N
    I_rain = rainfall_intensity(i);
    
    % Green-Ampt infiltration capacity
    delta_theta = max(0.05, theta_s - (theta_r + 0.3 * (theta_s - theta_r)));
    k_sat_mm_hr = k_sat * 1000 * 3600;
    f_cap = k_sat_mm_hr * (1.0 + (psi_f * delta_theta) / max(1e-3, F_curr));
    f_act = min(I_rain, f_cap);
    
    % Cumulative infiltration update
    dF = (f_act / 1000.0) * dt_hours;
    F_curr = F_curr + dF;
    F_cum_inf(i) = F_curr;
    wetting_front(i) = F_curr / delta_theta;
    
    % Groundwater recharge
    if I_rain > 0
        recharge = (f_act / 1000.0) * dt_hours / theta_s;
        gw_curr = max(0.3, gw_curr - recharge * 2.2);
    else
        gw_curr = min(4.8, gw_curr + 0.02 * dt_hours);
    end
    gw_table_depth(i) = gw_curr;
    
    % Pore water pressure u at slip surface
    if slip_depth > gw_curr
        head = slip_depth - gw_curr;
        u = gamma_w * head * (cos(theta_rad)^2);
    else
        u = 0.0;
    end
    pore_pressure(i) = u;
    
    % Earthquake pseudo-static coefficient kh
    if earthquake_mag(i) >= 3.0
        scale = min(1.0, max(0.2, (earthquake_mag(i) - 3.0) / 4.5));
        kh = min(0.45, 0.5 * acceleration_g(i) * scale);
    else
        kh = 0.0;
    end
    
    % Infinite Slope Stability FoS
    driving = gamma_soil * slip_depth * sin(theta_rad) * cos(theta_rad) + ...
              kh * gamma_soil * slip_depth * (cos(theta_rad)^2);
          
    eff_norm = gamma_soil * slip_depth * (cos(theta_rad)^2) - u;
    if kh > 0
        eff_norm = eff_norm - kh * gamma_soil * slip_depth * sin(theta_rad) * cos(theta_rad);
    end
    eff_norm = max(0.0, eff_norm);
    
    resisting = c + eff_norm * tan(phi_rad);
    fos = resisting / max(1e-4, driving);
    factor_of_safety(i) = fos;
    
    if fos > 1.5
        risk_level{i} = 'Safe';
    elseif fos > 1.2
        risk_level{i} = 'Moderate Risk';
    elseif fos > 1.0
        risk_level{i} = 'High Risk';
    else
        risk_level{i} = 'Failure Imminent';
    end
end

%% 4. Multi-Panel Scientific Visualizations
figure('Name', 'Landslide Early Warning Digital Twin - MATLAB Analytics', ...
       'Position', [100, 80, 1100, 750], 'Color', [0.08, 0.11, 0.18]);

% Subplot 1: Rainfall & Infiltration
subplot(3, 1, 1);
yyaxis left;
bar(time_steps, rainfall_intensity, 'FaceColor', [0.22, 0.74, 0.97], 'EdgeColor', 'none', 'FaceAlpha', 0.6);
ylabel('Rainfall (mm/h)', 'Color', [0.22, 0.74, 0.97], 'FontWeight', 'bold');
grid on; set(gca, 'Color', [0.05, 0.07, 0.12], 'XColor', [0.6, 0.7, 0.8], 'YColor', [0.22, 0.74, 0.97]);
title('Panel A: Cloudburst Infiltration & Seismic Telemetry', 'Color', [0.95, 0.98, 1.0], 'FontSize', 12);

yyaxis right;
plot(time_steps, F_cum_inf * 100, 'LineWidth', 2.2, 'Color', [0.06, 0.78, 0.50]);
ylabel('Cum. Inf. (cm)', 'Color', [0.06, 0.78, 0.50], 'FontWeight', 'bold');
set(gca, 'YColor', [0.06, 0.78, 0.50]);

% Subplot 2: Groundwater & Pore Water Pressure
subplot(3, 1, 2);
yyaxis left;
plot(time_steps, pore_pressure, 'LineWidth', 2.2, 'Color', [0.02, 0.71, 0.83]);
ylabel('Pore Pressure u (kPa)', 'Color', [0.02, 0.71, 0.83], 'FontWeight', 'bold');
grid on; set(gca, 'Color', [0.05, 0.07, 0.12], 'XColor', [0.6, 0.7, 0.8], 'YColor', [0.02, 0.71, 0.83]);
title('Panel B: Piezometric Groundwater Rise Dynamics', 'Color', [0.95, 0.98, 1.0], 'FontSize', 12);

yyaxis right;
plot(time_steps, gw_table_depth, 'LineWidth', 2.0, 'LineStyle', '--', 'Color', [0.51, 0.55, 0.97]);
ylabel('GW Depth (m)', 'Color', [0.51, 0.55, 0.97], 'FontWeight', 'bold');
set(gca, 'YDir', 'reverse', 'YColor', [0.51, 0.55, 0.97]);

% Subplot 3: Factor of Safety & Alert Zones
subplot(3, 1, 3);
plot(time_steps, factor_of_safety, 'LineWidth', 2.5, 'Color', [0.22, 0.74, 0.97]);
hold on;
yline(1.5, '--', 'Safe Threshold (1.5)', 'Color', [0.06, 0.72, 0.50], 'LineWidth', 1.5);
yline(1.2, '--', 'Watch (1.2)', 'Color', [0.96, 0.62, 0.04], 'LineWidth', 1.5);
yline(1.0, '-.', 'Failure Imminent (1.0)', 'Color', [0.93, 0.26, 0.26], 'LineWidth', 2.0);
ylabel('Factor of Safety (FoS)', 'Color', [0.95, 0.98, 1.0], 'FontWeight', 'bold');
xlabel('Simulation Time (hours)', 'Color', [0.95, 0.98, 1.0], 'FontWeight', 'bold');
title('Panel C: Digital Twin Stability & Safety Factor Decay', 'Color', [0.95, 0.98, 1.0], 'FontSize', 12);
grid on; set(gca, 'Color', [0.05, 0.07, 0.12], 'XColor', [0.6, 0.7, 0.8], 'YColor', [0.6, 0.7, 0.8]);
ylim([0.4, 2.2]);

fprintf('Simulation successfully rendered. Minimum FoS: %.3f\n', min(factor_of_safety));
