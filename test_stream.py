import torch
import numpy as np
from main import load_config
from ensemble import EnsembleManager
from data_loader import prepare_data

def test_stream():
    print("Testing stream generator...")
    config = load_config()
    
    # Use a dummy ticker or the first one
    ticker = "GOOGL" # Assuming this exists or use one from config
    # Or just mock data
    
    # Mock data
    input_dim = 10
    hidden_dim = 16
    output_dim = 1
    size = 2
    config['ensemble']['size'] = size
    
    ensemble = EnsembleManager("KAN", input_dim, hidden_dim, output_dim, config)
    
    # Create dummy data
    X_test = np.random.rand(5, input_dim) # 5 steps
    y_test = np.random.rand(5)
    
    # Mock scaler
    class MockScaler:
        def inverse_transform(self, x):
            return x
            
    scaler = MockScaler()
    
    # Run generator
    generator = ensemble.predict_stream_generator(X_test, y_test, scaler)
    
    for i, step_data in enumerate(generator):
        print(f"Step {i}: Adaptive={step_data['adaptive']:.4f}, Actual={step_data['actual']:.4f}")
        if i >= 2:
            break
            
    print("Stream generator test passed!")

if __name__ == "__main__":
    test_stream()
