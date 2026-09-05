classdef landslide_app_designer < matlab.apps.AppBase
    % LANDSLIDE_APP_DESIGNER - Standalone Desktop GUI for MATLAB
    % Interactive dashboard for Landslide Early Warning Digital Twin
    
    properties (Access = public)
        UIFigure              matlab.ui.Figure
        GridLayout            matlab.ui.container.GridLayout
        LeftPanel             matlab.ui.container.Panel
        CenterPanel           matlab.ui.container.Panel
        RightPanel            matlab.ui.container.Panel
        
        % Controls
        SoilDropDown          matlab.ui.control.DropDown
        SlopeSlider           matlab.ui.control.Slider
        RainfallSlider        matlab.ui.control.Slider
        EarthquakeSlider      matlab.ui.control.Slider
        SimulateButton        matlab.ui.control.Button
        DisasterDropDown      matlab.ui.control.DropDown
        InjectDisasterButton  matlab.ui.control.Button
        
        % Gauges & Displays
        FoSGauge              matlab.ui.control.LinearGauge
        FoSLabel              matlab.ui.control.Label
        AlertLamp             matlab.ui.control.Lamp
        AlertLabel            matlab.ui.control.Label
        
        % Axes
        FoSPlotAxes           matlab.ui.control.UIAxes
        HydrologyAxes         matlab.ui.control.UIAxes
        SensorsTable          matlab.ui.control.Table
    end
    
    methods (Access = private)
        function updateSimulation(app)
            % Read user inputs
            soil = app.SoilDropDown.Value;
            slope_ang = app.SlopeSlider.Value;
            rain_val = app.RainfallSlider.Value;
            eq_val = app.EarthquakeSlider.Value;
            
            % Physics parameter mapping
            switch soil
                case 'Clay', c = 25; phi = 18; gamma = 18;
                case 'Sandy Soil', c = 2; phi = 34; gamma = 19;
                case 'Silty Soil', c = 12; phi = 26; gamma = 18.5;
                case 'Gravel', c = 0.5; phi = 38; gamma = 20.5;
                case 'Laterite', c = 30; phi = 24; gamma = 19.5;
                otherwise, c = 45; phi = 32; gamma = 22;
            end
            
            z = 3.5;
            theta = deg2rad(slope_ang);
            phi_rad = deg2rad(phi);
            
            % Hydrology effect: high rain increases pore pressure u
            u = (rain_val / 100.0) * 35.0;
            kh = (eq_val / 8.0) * 0.35;
            
            % FoS Calculation
            driving = gamma * z * sin(theta) * cos(theta) + kh * gamma * z * (cos(theta)^2);
            resisting = c + max(0, gamma * z * (cos(theta)^2) - u) * tan(phi_rad);
            fos = resisting / max(1e-4, driving);
            fos = round(min(5.0, max(0.2, fos)), 3);
            
            % Update UI Gauge
            app.FoSGauge.Value = min(3.0, fos);
            app.FoSLabel.Text = sprintf('Factor of Safety: %.2f', fos);
            
            % Alert Level Logic
            if fos > 1.5
                app.AlertLamp.Color = [0.06 0.72 0.50]; % Green
                app.AlertLabel.Text = 'Status: SAFE';
            elseif fos > 1.2
                app.AlertLamp.Color = [0.96 0.62 0.04]; % Yellow
                app.AlertLabel.Text = 'Status: WATCH';
            elseif fos > 1.0
                app.AlertLamp.Color = [0.97 0.45 0.08]; % Orange
                app.AlertLabel.Text = 'Status: WARNING';
            else
                app.AlertLamp.Color = [0.93 0.26 0.26]; % Red
                app.AlertLabel.Text = 'Status: EVACUATE!';
            end
            
            % Update Plots
            t_pts = 0:1:24;
            fos_curve = fos + 0.15 * sin(t_pts / 3);
            plot(app.FoSPlotAxes, t_pts, fos_curve, 'LineWidth', 2, 'Color', [0.22 0.74 0.97]);
            yline(app.FoSPlotAxes, 1.0, '--r', 'Failure (1.0)');
            grid(app.FoSPlotAxes, 'on');
            
            % Hydrology Plot
            rain_curve = rain_val * exp(-((t_pts - 10).^2) / 25);
            bar(app.HydrologyAxes, t_pts, rain_curve, 'FaceColor', [0.02 0.71 0.83]);
            grid(app.HydrologyAxes, 'on');
            
            % Update Table
            app.SensorsTable.Data = {
                'RG-01 Rain Gauge', sprintf('%.1f mm/h', rain_val), 'Nominal';
                'SM-01 Soil Moisture', sprintf('%.1f %%', min(95, 20 + rain_val*0.6)), 'Nominal';
                'PZ-01 Piezometer', sprintf('%.1f kPa', u), 'Nominal';
                'AC-01 Accelerometer', sprintf('%.3f g', kh * 2.5), 'Nominal'
            };
        end
    end
    
    methods (Access = public)
        function app = landslide_app_designer()
            % Create UIFigure and components
            app.UIFigure = uifigure('Name', 'Landslide Early Warning System - MATLAB GUI', ...
                                    'Position', [100 100 1000 600]);
            app.GridLayout = uigridlayout(app.UIFigure, [1, 3]);
            app.GridLayout.ColumnWidth = {'280px', '1fr', '320px'};
            
            % Left Panel: Controls
            app.LeftPanel = uipanel(app.GridLayout, 'Title', 'Simulation Controls');
            uilabel(app.LeftPanel, 'Text', 'Soil Classification:', 'Position', [15 500 120 22]);
            app.SoilDropDown = uidropdown(app.LeftPanel, 'Items', ...
                {'Clay', 'Sandy Soil', 'Silty Soil', 'Gravel', 'Laterite', 'Weathered Rock'}, ...
                'Position', [15 475 220 25], 'ValueChangedFcn', @(~,~) app.updateSimulation());
                
            uilabel(app.LeftPanel, 'Text', 'Slope Angle (°):', 'Position', [15 435 120 22]);
            app.SlopeSlider = uislider(app.LeftPanel, 'Limits', [5 60], 'Value', 28, ...
                'Position', [25 410 200 3], 'ValueChangedFcn', @(~,~) app.updateSimulation());
                
            uilabel(app.LeftPanel, 'Text', 'Rainfall Intensity (mm/h):', 'Position', [15 365 160 22]);
            app.RainfallSlider = uislider(app.LeftPanel, 'Limits', [0 150], 'Value', 30, ...
                'Position', [25 340 200 3], 'ValueChangedFcn', @(~,~) app.updateSimulation());
                
            uilabel(app.LeftPanel, 'Text', 'Earthquake Magnitude (M):', 'Position', [15 295 160 22]);
            app.EarthquakeSlider = uislider(app.LeftPanel, 'Limits', [0 8], 'Value', 0, ...
                'Position', [25 270 200 3], 'ValueChangedFcn', @(~,~) app.updateSimulation());
                
            app.SimulateButton = uibutton(app.LeftPanel, 'Text', 'Run Digital Twin Step', ...
                'Position', [15 200 220 35], 'ButtonPushedFcn', @(~,~) app.updateSimulation());
                
            % Center Panel: Plots
            app.CenterPanel = uipanel(app.GridLayout, 'Title', 'Stability & Hydrology Analytics');
            app.FoSPlotAxes = uiaxes(app.CenterPanel, 'Position', [15 280 340 240]);
            title(app.FoSPlotAxes, 'Factor of Safety Timeline');
            
            app.HydrologyAxes = uiaxes(app.CenterPanel, 'Position', [15 20 340 230]);
            title(app.HydrologyAxes, 'Precipitation Forcing (mm/h)');
            
            % Right Panel: Gauges & Sensors
            app.RightPanel = uipanel(app.GridLayout, 'Title', 'Live Telemetry & Alerts');
            app.AlertLamp = uilamp(app.RightPanel, 'Position', [20 515 24 24], 'Color', [0.06 0.72 0.50]);
            app.AlertLabel = uilabel(app.RightPanel, 'Text', 'Status: SAFE', 'Position', [55 515 200 24], 'FontWeight', 'bold');
            
            app.FoSLabel = uilabel(app.RightPanel, 'Text', 'Factor of Safety: 1.68', 'Position', [20 465 240 22]);
            app.FoSGauge = uigauge(app.RightPanel, 'linear', 'Limits', [0 3], 'Value', 1.68, 'Position', [20 370 260 80]);
            
            app.SensorsTable = uitable(app.RightPanel, 'Position', [10 40 300 300], ...
                'ColumnName', {'Sensor', 'Value', 'Status'}, ...
                'Data', {'RG-01', '0 mm/h', 'Nominal'; 'SM-01', '24 %', 'Nominal'});
                
            app.updateSimulation();
        end
    end
end
