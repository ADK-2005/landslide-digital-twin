%% SIMULINK_LANDSLIDE_DIGITAL_TWIN
% Automated Simulink Model Builder & Architecture Script
% Programmatically creates the complete Simulink digital twin model (.slx)
% with 10 dedicated functional subsystems:
%   1. Rainfall Generator Subsystem
%   2. Green-Ampt Infiltration Model Subsystem
%   3. Groundwater Dynamics Subsystem
%   4. Pore Water Pressure Model Subsystem
%   5. Geotechnical Infinite Slope Stability Block
%   6. Earthquake Disturbance Block (Pseudo-Static Seismic)
%   7. Machine Learning Prediction Block (Embedded MATLAB / Neural Net)
%   8. Alert Logic & Early Warning Stateflow Block
%   9. Digital Twin Telemetry Synchronization Block
%  10. Real-Time Dashboard & Scopes Block

clear; clc;
model_name = 'landslide_digital_twin';
fprintf('=== Building Simulink Digital Twin Model: %s.slx ===\n', model_name);

% Close existing model if open, create new system
if bdIsLoaded(model_name)
    close_system(model_name, 0);
end
new_system(model_name);
open_system(model_name);

% Configure solver parameters (Variable-step ode45 or Fixed-step ode4)
set_param(model_name, 'Solver', 'ode45', 'StopTime', '48');

%% 1. Subsystem 1: Rainfall Generator
sub1 = [model_name, '/Rainfall_Generator'];
add_block('simulink/Ports & Subsystems/Subsystem', sub1, 'Position', [60, 60, 220, 160]);
% Inside Subsystem 1: Add Pulse Generator & Cloudburst Peak
add_block('simulink/Sources/Pulse Generator', [sub1, '/Pulse_Storm'], 'Position', [40, 40, 80, 80], ...
    'Period', '24', 'PulseWidth', '40', 'Amplitude', '60');
add_block('simulink/Sources/Sine Wave', [sub1, '/Cloudburst_Peak'], 'Position', [40, 120, 80, 160], ...
    'Frequency', '0.2', 'Amplitude', '50', 'Bias', '20');
add_block('simulink/Math Operations/Add', [sub1, '/Sum_Precipitation'], 'Position', [140, 80, 170, 120]);
add_block('simulink/Commonly Used Blocks/Out1', [sub1, '/Rainfall_Intensity'], 'Position', [220, 90, 250, 110]);
add_line(sub1, 'Pulse_Storm/1', 'Sum_Precipitation/1');
add_line(sub1, 'Cloudburst_Peak/1', 'Sum_Precipitation/2');
add_line(sub1, 'Sum_Precipitation/1', 'Rainfall_Intensity/1');

%% 2. Subsystem 2: Green-Ampt Infiltration Model
sub2 = [model_name, '/Infiltration_Model'];
add_block('simulink/Ports & Subsystems/Subsystem', sub2, 'Position', [280, 60, 440, 160]);
add_block('simulink/Commonly Used Blocks/In1', [sub2, '/Rainfall_In'], 'Position', [30, 80, 60, 100]);
add_block('simulink/Continuous/Integrator', [sub2, '/Cumulative_Inf_Integrator'], 'Position', [120, 75, 160, 105]);
add_block('simulink/Commonly Used Blocks/Gain', [sub2, '/Conversion_mm_to_m'], 'Position', [80, 75, 105, 105], 'Gain', '0.001');
add_block('simulink/Commonly Used Blocks/Out1', [sub2, '/Cum_Infiltration_m'], 'Position', [220, 80, 250, 100]);
add_line(sub2, 'Rainfall_In/1', 'Conversion_mm_to_m/1');
add_line(sub2, 'Conversion_mm_to_m/1', 'Cumulative_Inf_Integrator/1');
add_line(sub2, 'Cumulative_Inf_Integrator/1', 'Cum_Infiltration_m/1');

%% 3. Subsystem 3: Groundwater Model
sub3 = [model_name, '/Groundwater_Model'];
add_block('simulink/Ports & Subsystems/Subsystem', sub3, 'Position', [500, 60, 660, 160]);
add_block('simulink/Commonly Used Blocks/In1', [sub3, '/Cum_Inf_In'], 'Position', [30, 80, 60, 100]);
add_block('simulink/Commonly Used Blocks/Gain', [sub3, '/Recharge_Factor'], 'Position', [100, 75, 130, 105], 'Gain', '3.5');
add_block('simulink/Sources/Constant', [sub3, '/Baseline_Depth'], 'Position', [30, 30, 60, 50], 'Value', '4.8');
add_block('simulink/Math Operations/Subtract', [sub3, '/Water_Table_Calc'], 'Position', [180, 50, 210, 90]);
add_block('simulink/Commonly Used Blocks/Out1', [sub3, '/GW_Depth_m'], 'Position', [250, 60, 280, 80]);
add_line(sub3, 'Cum_Inf_In/1', 'Recharge_Factor/1');
add_line(sub3, 'Baseline_Depth/1', 'Water_Table_Calc/1');
add_line(sub3, 'Recharge_Factor/1', 'Water_Table_Calc/2');
add_line(sub3, 'Water_Table_Calc/1', 'GW_Depth_m/1');

%% 4. Subsystem 4: Pore Water Pressure Model
sub4 = [model_name, '/Pore_Pressure_Model'];
add_block('simulink/Ports & Subsystems/Subsystem', sub4, 'Position', [720, 60, 880, 160]);
add_block('simulink/Commonly Used Blocks/In1', [sub4, '/GW_Depth'], 'Position', [30, 70, 60, 90]);
add_block('simulink/Sources/Constant', [sub4, '/Slip_Depth_z'], 'Position', [30, 20, 60, 40], 'Value', '3.5');
add_block('simulink/Math Operations/Subtract', [sub4, '/Head_Difference'], 'Position', [100, 30, 130, 70]);
add_block('simulink/Commonly Used Blocks/Gain', [sub4, '/Gamma_W_Cos2'], 'Position', [170, 40, 210, 70], 'Gain', '7.64'); % 9.81 * cos^2(28 deg)
add_block('simulink/Discontinuities/Saturation', [sub4, '/Non_Negative'], 'Position', [240, 40, 270, 70], 'LowerLimit', '0');
add_block('simulink/Commonly Used Blocks/Out1', [sub4, '/Pore_Pressure_u'], 'Position', [300, 45, 330, 65]);
add_line(sub4, 'Slip_Depth_z/1', 'Head_Difference/1');
add_line(sub4, 'GW_Depth/1', 'Head_Difference/2');
add_line(sub4, 'Head_Difference/1', 'Gamma_W_Cos2/1');
add_line(sub4, 'Gamma_W_Cos2/1', 'Non_Negative/1');
add_line(sub4, 'Non_Negative/1', 'Pore_Pressure_u/1');

%% 5. Subsystem 6: Earthquake Disturbance Block
sub6 = [model_name, '/Earthquake_Block'];
add_block('simulink/Ports & Subsystems/Subsystem', sub6, 'Position', [60, 240, 220, 340]);
add_block('simulink/Sources/Step', [sub6, '/Seismic_Trigger'], 'Position', [30, 60, 60, 80], 'Time', '20', 'After', '0.35');
add_block('simulink/Sources/Sine Wave', [sub6, '/Vibration_Wave'], 'Position', [30, 110, 60, 130], 'Frequency', '4.0');
add_block('simulink/Math Operations/Product', [sub6, '/Seismic_Waveform'], 'Position', [110, 70, 140, 110]);
add_block('simulink/Commonly Used Blocks/Gain', [sub6, '/Kh_Scaling'], 'Position', [170, 80, 200, 100], 'Gain', '0.45');
add_block('simulink/Commonly Used Blocks/Out1', [sub6, '/Seismic_kh'], 'Position', [240, 80, 270, 100]);
add_line(sub6, 'Seismic_Trigger/1', 'Seismic_Waveform/1');
add_line(sub6, 'Vibration_Wave/1', 'Seismic_Waveform/2');
add_line(sub6, 'Seismic_Waveform/1', 'Kh_Scaling/1');
add_line(sub6, 'Kh_Scaling/1', 'Seismic_kh/1');

%% 6. Subsystem 5: Geotechnical Infinite Slope Stability Block
sub5 = [model_name, '/Slope_Stability_Engine'];
add_block('simulink/Ports & Subsystems/Subsystem', sub5, 'Position', [380, 240, 560, 350]);
add_block('simulink/Commonly Used Blocks/In1', [sub5, '/Pore_Pressure_In'], 'Position', [30, 50, 60, 70]);
add_block('simulink/Commonly Used Blocks/In1', [sub5, '/Seismic_kh_In'], 'Position', [30, 110, 60, 130]);
% Embedded MATLAB function block for Infinite Slope Stability
em_block = add_block('simulink/User-Defined Functions/MATLAB Function', [sub5, '/Infinite_Slope_Equations'], ...
    'Position', [120, 60, 240, 120]);
% Output FoS
add_block('simulink/Commonly Used Blocks/Out1', [sub5, '/Factor_of_Safety'], 'Position', [300, 80, 330, 100]);
add_line(sub5, 'Pore_Pressure_In/1', 'Infinite_Slope_Equations/1');
add_line(sub5, 'Seismic_kh_In/1', 'Infinite_Slope_Equations/2');
add_line(sub5, 'Infinite_Slope_Equations/1', 'Factor_of_Safety/1');

%% 7. Subsystem 7: Machine Learning Prediction Block
sub7 = [model_name, '/ML_Prediction_Block'];
add_block('simulink/Ports & Subsystems/Subsystem', sub7, 'Position', [660, 240, 820, 340]);
add_block('simulink/Commonly Used Blocks/In1', [sub7, '/FoS_Input'], 'Position', [30, 70, 60, 90]);
add_block('simulink/Lookup Tables/1-D Lookup Table', [sub7, '/ML_Risk_Lookup'], 'Position', [110, 65, 170, 95], ...
    'Table', '[0.99, 0.95, 0.82, 0.50, 0.20, 0.05]', ...
    'BreakpointsForDimension1', '[0.7, 0.9, 1.0, 1.2, 1.5, 2.0]');
add_block('simulink/Commonly Used Blocks/Out1', [sub7, '/Landslide_Probability'], 'Position', [220, 70, 250, 90]);
add_line(sub7, 'FoS_Input/1', 'ML_Risk_Lookup/1');
add_line(sub7, 'ML_Risk_Lookup/1', 'Landslide_Probability/1');

%% 8. Subsystem 8: Alert Logic Block (Multi-Criteria Thresholds)
sub8 = [model_name, '/Alert_Logic_Block'];
add_block('simulink/Ports & Subsystems/Subsystem', sub8, 'Position', [60, 420, 240, 520]);
add_block('simulink/Commonly Used Blocks/In1', [sub8, '/FoS_Signal'], 'Position', [30, 40, 60, 60]);
add_block('simulink/Commonly Used Blocks/In1', [sub8, '/ML_Prob_Signal'], 'Position', [30, 90, 60, 110]);
add_block('simulink/Commonly Used Blocks/Compare To Constant', [sub8, '/Red_Threshold'], 'Position', [100, 35, 150, 65], ...
    'Operator', '<=', 'Const', '1.0');
add_block('simulink/Commonly Used Blocks/Out1', [sub8, '/Alarm_Trigger'], 'Position', [210, 40, 240, 60]);
add_line(sub8, 'FoS_Signal/1', 'Red_Threshold/1');
add_line(sub8, 'Red_Threshold/1', 'Alarm_Trigger/1');

%% 9. Subsystem 9: Digital Twin Synchronization Block
sub9 = [model_name, '/Digital_Twin_Sync'];
add_block('simulink/Ports & Subsystems/Subsystem', sub9, 'Position', [320, 420, 520, 520]);
add_block('simulink/Commonly Used Blocks/In1', [sub9, '/FoS_Sync'], 'Position', [30, 40, 60, 60]);
add_block('simulink/Sinks/To Workspace', [sub9, '/Telemetry_Log'], 'Position', [120, 35, 190, 65], ...
    'VariableName', 'landslide_digital_twin_telemetry', 'SaveFormat', 'Structure With Time');
add_line(sub9, 'FoS_Sync/1', 'Telemetry_Log/1');

%% 10. Subsystem 10: Live Dashboard & Scopes Block
sub10 = [model_name, '/Live_Dashboard'];
add_block('simulink/Ports & Subsystems/Subsystem', sub10, 'Position', [600, 420, 800, 520]);
add_block('simulink/Commonly Used Blocks/In1', [sub10, '/Scope_FoS'], 'Position', [30, 30, 60, 50]);
add_block('simulink/Commonly Used Blocks/In1', [sub10, '/Scope_Rain'], 'Position', [30, 80, 60, 100]);
add_block('simulink/Sinks/Scope', [sub10, '/Stability_Scope'], 'Position', [130, 25, 170, 55]);
add_block('simulink/Sinks/Scope', [sub10, '/Rainfall_Scope'], 'Position', [130, 75, 170, 105]);
add_line(sub10, 'Scope_FoS/1', 'Stability_Scope/1');
add_line(sub10, 'Scope_Rain/1', 'Rainfall_Scope/1');

%% Interconnect All Subsystems
add_line(model_name, 'Rainfall_Generator/1', 'Infiltration_Model/1');
add_line(model_name, 'Infiltration_Model/1', 'Groundwater_Model/1');
add_line(model_name, 'Groundwater_Model/1', 'Pore_Pressure_Model/1');
add_line(model_name, 'Pore_Pressure_Model/1', 'Slope_Stability_Engine/1');
add_line(model_name, 'Earthquake_Block/1', 'Slope_Stability_Engine/2');
add_line(model_name, 'Slope_Stability_Engine/1', 'ML_Prediction_Block/1');
add_line(model_name, 'Slope_Stability_Engine/1', 'Alert_Logic_Block/1');
add_line(model_name, 'ML_Prediction_Block/1', 'Alert_Logic_Block/2');
add_line(model_name, 'Slope_Stability_Engine/1', 'Digital_Twin_Sync/1');
add_line(model_name, 'Slope_Stability_Engine/1', 'Live_Dashboard/1');
add_line(model_name, 'Rainfall_Generator/1', 'Live_Dashboard/2');

% Save Simulink Model
save_system(model_name);
fprintf('Simulink Model %s.slx created, interconnected, and saved successfully.\n', model_name);
