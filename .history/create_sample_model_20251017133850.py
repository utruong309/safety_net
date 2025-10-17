#!/usr/bin/env python3
"""
Create a sample LightGBM model for flood risk prediction.
This script creates a dummy model for testing the flood consumer.
"""

import numpy as np
import lightgbm as lgb
import os

def create_sample_model():
    """Create a sample LightGBM model for flood risk prediction."""
    
    # Create dummy training data
    np.random.seed(42)
    n_samples = 1000
    
    # Features: temperature, humidity, rain_1h
    X = np.random.rand(n_samples, 3)
    X[:, 0] = X[:, 0] * 40 + 10  # temp: 10-50°C
    X[:, 1] = X[:, 1] * 100     # humidity: 0-100%
    X[:, 2] = X[:, 2] * 50      # rain_1h: 0-50mm
    
    # Create realistic flood risk targets
    # Higher risk with more rain, higher humidity, extreme temps
    y = (
        0.3 * (X[:, 2] / 50) +  # rain contribution
        0.2 * (X[:, 1] / 100) +  # humidity contribution
        0.1 * np.abs(X[:, 0] - 25) / 25 +  # temperature deviation
        np.random.normal(0, 0.1, n_samples)  # noise
    )
    y = np.clip(y, 0, 1)  # ensure 0-1 range
    
    # Train LightGBM model
    train_data = lgb.Dataset(X, label=y)
    
    params = {
        'objective': 'regression',
        'metric': 'rmse',
        'boosting_type': 'gbdt',
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.9,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbose': -1,
        'random_state': 42
    }
    
    model = lgb.train(
        params,
        train_data,
        num_boost_round=100,
        valid_sets=[train_data],
        callbacks=[lgb.early_stopping(10), lgb.log_evaluation(0)]
    )
    
    # Save model
    model_path = "backend/models/flood_model.txt"
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    model.save_model(model_path)
    
    print(f"✅ Sample LightGBM model created and saved to: {model_path}")
    print(f"Model features: ['temp', 'humidity', 'rain1h']")
    print(f"Target: flood_risk (0-1)")
    
    # Test the model
    test_data = np.array([[25.0, 60.0, 10.0]])  # moderate conditions
    prediction = model.predict(test_data)[0]
    print(f"Test prediction for [temp=25°C, humidity=60%, rain=10mm]: {prediction:.3f}")

if __name__ == "__main__":
    create_sample_model()
