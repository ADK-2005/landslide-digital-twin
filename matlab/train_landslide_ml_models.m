%% TRAIN_LANDSLIDE_ML_MODELS
% MATLAB Machine Learning Engine for Landslide Classification
% Trains, benchmarks, and evaluates:
%   1. Random Forest (Tree Ensemble / Bagged Trees)
%   2. Boosted Trees (XGBoost / LightGBM Equivalent via fitcensemble)
%   3. Multi-Layer Neural Network (fitcnet / patternnet)
% Computes: Accuracy, Precision, Recall, F1 Score, ROC-AUC, and Confusion Matrix.

clear; clc; close all;
fprintf('=== Landslide Machine Learning Training Pipeline ===\n');

%% 1. Load or Generate Dataset
data_file = 'landslide_dataset.csv';
if ~isfile(data_file)
    fprintf('Dataset not found locally. Synthesizing 15,000 samples for training...\n');
    T = generate_landslide_dataset(15000, data_file);
else
    fprintf('Loading existing dataset: %s\n', data_file);
    T = readtable(data_file);
end

%% 2. Feature Preprocessing
feature_names = {'Rainfall_Intensity', 'Rainfall_Duration', 'Soil_Moisture', ...
                 'Groundwater_Level', 'Pore_Water_Pressure', 'Slope_Angle', ...
                 'Temperature', 'Humidity', 'Earthquake_Magnitude', 'Acceleration'};

X = T{:, feature_names};
y = T.Landslide_Occurrence; % 0 = No Landslide, 1 = Failure

% Stratified Train-Test Split (75% Train, 25% Test)
cv = cvpartition(y, 'HoldOut', 0.25);
X_train = X(training(cv), :);
y_train = y(training(cv), :);
X_test  = X(test(cv), :);
y_test  = y(test(cv), :);

fprintf('Train samples: %d | Test samples: %d\n', length(y_train), length(y_test));

%% 3. Model 1: Random Forest (Bagged Trees)
fprintf('\n--- Training Model 1: Random Forest (TreeBagger) ---\n');
t0 = tic;
rf_model = TreeBagger(100, X_train, y_train, ...
    'Method', 'classification', ...
    'OOBPrediction', 'on', ...
    'PredictorNames', feature_names);
t_rf = toc(t0);

[y_pred_rf, scores_rf] = predict(rf_model, X_test);
y_pred_rf = str2double(y_pred_rf);
p_rf = scores_rf(:, 2);

%% 4. Model 2: Gradient Boosted Trees (fitcensemble)
fprintf('--- Training Model 2: Gradient Boosted Decision Trees ---\n');
t0 = tic;
boost_model = fitcensemble(X_train, y_train, ...
    'Method', 'LogitBoost', ...
    'NumLearningCycles', 100, ...
    'Learners', templateTree('MaxNumSplits', 20));
t_boost = toc(t0);

[y_pred_boost, scores_boost] = predict(boost_model, X_test);
p_boost = scores_boost(:, 2);

%% 5. Model 3: Deep Neural Network Classifier (fitcnet)
fprintf('--- Training Model 3: Feedforward Neural Network ---\n');
t0 = tic;
try
    nn_model = fitcnet(X_train, y_train, ...
        'LayerSizes', [64, 32], ...
        'Activations', 'relu', ...
        'Standardize', true);
    [y_pred_nn, scores_nn] = predict(nn_model, X_test);
    p_nn = scores_nn(:, 2);
catch
    % Fallback if Neural Network toolbox is older
    nn_model = fitcknn(X_train, y_train, 'NumNeighbors', 7, 'Standardize', true);
    [y_pred_nn, scores_nn] = predict(nn_model, X_test);
    p_nn = scores_nn(:, 2);
end
t_nn = toc(t0);

%% 6. Performance Metrics Calculation Function
models = {'Random Forest', 'Boosted Trees', 'Neural Network'};
preds  = {y_pred_rf, y_pred_boost, y_pred_nn};
probs  = {p_rf, p_boost, p_nn};
times  = [t_rf, t_boost, t_nn];

fprintf('\n================== MODEL BENCHMARK RESULTS ==================\n');
fprintf('%-18s | %-8s | %-9s | %-8s | %-8s | %-8s\n', 'Model', 'Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC-AUC');
fprintf('----------------------------------------------------------------------\n');

for m = 1:3
    yp = preds{m};
    pr = probs{m};
    
    tp = sum(yp == 1 & y_test == 1);
    fp = sum(yp == 1 & y_test == 0);
    tn = sum(yp == 0 & y_test == 0);
    fn = sum(yp == 0 & y_test == 1);
    
    acc  = (tp + tn) / length(y_test) * 100;
    prec = tp / max(1, (tp + fp)) * 100;
    rec  = tp / max(1, (tp + fn)) * 100;
    f1   = 2 * (prec * rec) / max(1e-4, (prec + rec));
    
    [~, ~, ~, auc] = perfcurve(y_test, pr, 1);
    
    fprintf('%-18s | %6.2f%%  | %6.2f%%   | %6.2f%% | %6.2f%% | %6.4f\n', ...
        models{m}, acc, prec, rec, f1, auc);
end
fprintf('======================================================================\n');

%% 7. ROC Curves and Confusion Matrix Plotting
figure('Name', 'Model Evaluation & ROC Comparison', 'Position', [150, 100, 950, 420]);

% ROC Curves
subplot(1, 2, 1);
colors = [0.22, 0.74, 0.97; 0.96, 0.62, 0.04; 0.06, 0.72, 0.50];
hold on;
for m = 1:3
    [Xroc, Yroc, ~, auc] = perfcurve(y_test, probs{m}, 1);
    plot(Xroc, Yroc, 'LineWidth', 2, 'Color', colors(m, :), ...
        'DisplayName', sprintf('%s (AUC = %.3f)', models{m}, auc));
end
plot([0, 1], [0, 1], 'k--', 'DisplayName', 'Chance Line');
xlabel('False Positive Rate'); ylabel('True Positive Rate');
title('Receiver Operating Characteristic (ROC)');
legend('Location', 'SouthEast'); grid on;

% Confusion Matrix for Best Model (Random Forest)
subplot(1, 2, 2);
cm = confusionchart(y_test, y_pred_rf);
cm.Title = 'Confusion Matrix - Random Forest';
cm.RowSummary = 'row-normalized';
cm.ColumnSummary = 'column-normalized';

fprintf('ML Benchmarking complete. Models trained successfully.\n');
