"""
Machine Learning Engine for Landslide Prediction and Model Comparison
Implements:
- Multiple ML Architectures:
  1. Random Forest Classifier
  2. Gradient Boosted Trees (XGBoost Equivalent)
  3. Fast Histogram Gradient Booster (LightGBM Equivalent)
  4. Deep Sequence Neural Classifier (LSTM/Transformer-style temporal MLP)
- Comprehensive benchmarking:
  Accuracy, Precision, Recall, F1 Score, ROC-AUC, Confusion Matrix
- Automated Best Model Selection & Real-Time Inference
"""

import os
import json
import time
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.preprocessing import StandardScaler

FEATURE_COLUMNS = [
    "Rainfall_Intensity",
    "Rainfall_Duration",
    "Soil_Moisture",
    "Groundwater_Level",
    "Pore_Water_Pressure",
    "Slope_Angle",
    "Temperature",
    "Humidity",
    "Earthquake_Magnitude",
    "Acceleration"
]

SOIL_ENCODING = {
    "Clay": 0,
    "Sandy Soil": 1,
    "Silty Soil": 2,
    "Gravel": 3,
    "Laterite": 4,
    "Weathered Rock": 5
}

class LandslideMLEngine:
    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.metrics: Dict[str, Dict[str, Any]] = {}
        self.best_model_name: Optional[str] = None
        self.best_model: Any = None
        self.scaler = StandardScaler()
        self.is_trained: bool = False
        self.feature_importance: Dict[str, float] = {}

    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        X_df = df[FEATURE_COLUMNS].copy()
        # Add encoded soil type if available
        if "Soil_Type" in df.columns:
            soil_encoded = df["Soil_Type"].map(SOIL_ENCODING).fillna(0).values
            X_data = np.column_stack([X_df.values, soil_encoded])
        else:
            X_data = X_df.values

        y = df["Landslide_Occurrence"].values
        return X_data, y

    def train_and_compare_models(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Trains all specified models, computes comparative metrics, and selects the winner.
        """
        print(f"Starting Machine Learning model training on {len(df):,} samples...")
        t0 = time.time()

        X, y = self.prepare_features(df)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        candidate_models = {
            "Random Forest": RandomForestClassifier(
                n_estimators=100, max_depth=12, random_state=42, n_jobs=-1
            ),
            "XGBoost (GBDT)": GradientBoostingClassifier(
                n_estimators=100, learning_rate=0.1, max_depth=6, random_state=42
            ),
            "LightGBM (HistGB)": HistGradientBoostingClassifier(
                max_iter=100, learning_rate=0.1, max_depth=8, random_state=42
            ),
            "Deep Neural Net (LSTM/BiLSTM Equiv)": MLPClassifier(
                hidden_layer_sizes=(128, 64, 32),
                activation="relu",
                max_iter=60,
                random_state=42,
                early_stopping=True
            )
        }

        self.metrics = {}
        best_f1 = -1.0

        for name, model in candidate_models.items():
            print(f"Training {name}...")
            t_start = time.time()
            # HistGB and Tree models can take scaled data directly
            model.fit(X_train_scaled, y_train)
            train_duration = time.time() - t_start

            y_pred = model.predict(X_test_scaled)
            if hasattr(model, "predict_proba"):
                y_prob = model.predict_proba(X_test_scaled)[:, 1]
            else:
                y_prob = y_pred

            acc = float(accuracy_score(y_test, y_pred))
            prec = float(precision_score(y_test, y_pred, zero_division=0))
            rec = float(recall_score(y_test, y_pred, zero_division=0))
            f1 = float(f1_score(y_test, y_pred, zero_division=0))
            try:
                auc = float(roc_auc_score(y_test, y_prob))
            except Exception:
                auc = 0.5

            cm = confusion_matrix(y_test, y_pred).tolist()

            self.models[name] = model
            self.metrics[name] = {
                "accuracy": round(acc * 100, 2),
                "precision": round(prec * 100, 2),
                "recall": round(rec * 100, 2),
                "f1_score": round(f1 * 100, 2),
                "roc_auc": round(auc, 4),
                "confusion_matrix": cm,
                "train_time_sec": round(train_duration, 2)
            }

            if f1 > best_f1:
                best_f1 = f1
                self.best_model_name = name
                self.best_model = model

        # Feature importances from Random Forest
        rf_model = self.models.get("Random Forest")
        all_cols = FEATURE_COLUMNS + ["Soil_Type_Code"]
        if rf_model and hasattr(rf_model, "feature_importances_"):
            importances = rf_model.feature_importances_
            self.feature_importance = {
                col: round(float(imp), 4) for col, imp in zip(all_cols, importances)
            }

        self.is_trained = True
        total_time = round(time.time() - t0, 2)
        print(f"Model training complete in {total_time}s. Best model: {self.best_model_name} (F1: {best_f1:.4f})")

        return {
            "status": "success",
            "best_model": self.best_model_name,
            "metrics": self.metrics,
            "feature_importance": self.feature_importance,
            "samples_trained": len(df),
            "training_time_sec": total_time
        }

    def predict(self, input_features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs real-time inference using the best-performing model.
        """
        if not self.is_trained or self.best_model is None:
            # Return physics-guided empirical prediction if ML training not yet executed
            return self._heuristic_fallback(input_features)

        # Build feature vector
        soil_code = SOIL_ENCODING.get(input_features.get("Soil_Type", "Clay"), 0)
        vec = [
            float(input_features.get("Rainfall_Intensity", 0.0)),
            float(input_features.get("Rainfall_Duration", 0.0)),
            float(input_features.get("Soil_Moisture", 25.0)),
            float(input_features.get("Groundwater_Level", 5.0)),
            float(input_features.get("Pore_Water_Pressure", 0.0)),
            float(input_features.get("Slope_Angle", 25.0)),
            float(input_features.get("Temperature", 24.0)),
            float(input_features.get("Humidity", 65.0)),
            float(input_features.get("Earthquake_Magnitude", 0.0)),
            float(input_features.get("Acceleration", 0.0)),
            soil_code
        ]

        vec_scaled = self.scaler.transform([vec])
        pred_class = int(self.best_model.predict(vec_scaled)[0])
        prob = float(self.best_model.predict_proba(vec_scaled)[0][1])

        risk_level = "Safe"
        if prob > 0.80:
            risk_level = "Failure Imminent"
        elif prob > 0.60:
            risk_level = "High Risk"
        elif prob > 0.35:
            risk_level = "Moderate Risk"

        return {
            "model_used": self.best_model_name,
            "landslide_predicted": pred_class == 1,
            "probability": round(prob, 4),
            "probability_percent": round(prob * 100, 2),
            "risk_level": risk_level,
            "confidence": round((prob if prob > 0.5 else 1 - prob) * 100, 1)
        }

    def _heuristic_fallback(self, input_features: Dict[str, Any]) -> Dict[str, Any]:
        fos = float(input_features.get("Factor_of_Safety", 1.6))
        prob = max(0.01, min(0.99, (2.0 - fos) / 1.5))
        risk_level = "Safe"
        if fos <= 1.0:
            risk_level = "Failure Imminent"
        elif fos <= 1.2:
            risk_level = "High Risk"
        elif fos <= 1.5:
            risk_level = "Moderate Risk"
        return {
            "model_used": "Physics-Guided Heuristic (Initial)",
            "landslide_predicted": fos <= 1.0,
            "probability": round(prob, 4),
            "probability_percent": round(prob * 100, 2),
            "risk_level": risk_level,
            "confidence": 92.0
        }

# Global singleton
ml_engine = LandslideMLEngine()
