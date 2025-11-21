import matplotlib.pyplot as plt
import numpy as np
import time
import torch
import sys
from main import load_config, check_volatility
from data_loader import prepare_data, get_tickers_by_domain
from ensemble import EnsembleManager

def run_visualization():
    # Load Configuration
    config = load_config()
    print(f"Loaded Config: Domain={config['data']['domain']}, Count={config['data']['count']}")
    
    # Fetch Tickers dynamically
    TICKERS = get_tickers_by_domain(config['data']['domain'], config['data']['count'])
    
    if not TICKERS:
        print("No tickers found. Exiting.")
        return

    # Setup Plot
    plt.ion() # Interactive mode
    fig = plt.figure(figsize=(16, 8))
    
    # We will reuse the same figure for each ticker, clearing it.
    
    for ticker_idx, ticker in enumerate(TICKERS):
        print(f"\n{'='*50}")
        print(f"Processing {ticker} ({ticker_idx+1}/{len(TICKERS)})...")
        
        # 0. Volatility Check
        vol = check_volatility(ticker, config['data']['start_date'], config['data']['end_date'])
        VOL_THRESHOLD = config['volatility']['threshold']
        
        model_type = "KAN"
        if vol > VOL_THRESHOLD:
            model_type = "BiLSTM-Attn"
            print(f"⚠️ High Volatility Detected ({vol:.2%}). Switching to {model_type}.")
        else:
            print(f"✅ Stable Volatility ({vol:.2%}). Using {model_type}.")
            
        # 1. Data Preparation
        LOOKBACK = config['data']['lookback']
        TRAINING_PERCENTAGE = config['training']['percentage']
        
        try:
            X_train, X_test, y_train, y_test, dates_test, feature_cols, scaler_y = prepare_data(
                ticker=ticker, 
                start_date=config['data']['start_date'],
                end_date=config['data']['end_date'],
                lookback=LOOKBACK,
                split_percent=TRAINING_PERCENTAGE
            )
        except Exception as e:
            print(f"Error fetching data for {ticker}: {e}")
            continue

        # 2. Model/Ensemble Initialization & Training
        input_dim_kan = X_train.shape[1] * X_train.shape[2] # Flattened
        input_dim_lstm = X_train.shape[2] # Features
        
        hidden_dim = config['model']['hidden_dim']
        output_dim = config['model']['output_dim']
        
        # Check if Ensemble is enabled
        if not config.get('ensemble', {}).get('enabled', False):
            print("Ensemble not enabled in config. Please enable it to use this visualization.")
            return

        print(f"🚀 Training Ensemble ({config['ensemble']['size']} models)...")
        
        # Initialize Ensemble Manager
        if model_type == "KAN":
            ensemble = EnsembleManager("KAN", input_dim_kan, hidden_dim, output_dim, config)
            X_train_ens = X_train.reshape(X_train.shape[0], -1)
            X_test_ens = X_test.reshape(X_test.shape[0], -1)
        else:
            ensemble = EnsembleManager("BiLSTM-Attn", input_dim_lstm, hidden_dim, output_dim, config)
            X_train_ens = X_train
            X_test_ens = X_test
            
        # Train Ensemble
        ensemble.train_models(
            X_train_ens, y_train, 
            epochs=config['training']['epochs'], 
            lr=config['training']['learning_rate']
        )
        
        # 3. Real-time Visualization Loop
        print("Starting Real-time Visualization...")
        
        # Clear figure for new ticker
        fig.clf()
        ax_main = fig.add_subplot(2, 1, 1)
        ax_weights = fig.add_subplot(2, 1, 2)
        
        # Data buffers for plotting
        history_dates = []
        history_actuals = []
        history_preds = []
        history_weights = []
        
        generator = ensemble.predict_stream_generator(X_test_ens, y_test, scaler_y)
        
        for step_data in generator:
            step = step_data['step']
            adaptive_pred = step_data['adaptive']
            actual = step_data['actual']
            weights = step_data['weights']
            model_preds = step_data['model_preds']
            
            current_date = dates_test[step]
            history_dates.append(current_date)
            history_preds.append(adaptive_pred)
            history_weights.append(weights)
            
            # --- PHASE 1: Show Prediction (T=0) ---
            ax_main.clear()
            ax_weights.clear()
            
            # Plot History
            if len(history_actuals) > 0:
                ax_main.plot(history_dates[:len(history_actuals)], history_actuals, color='black', label='Actual', linewidth=1.5)
            
            # Plot Predictions (History + Current)
            ax_main.plot(history_dates, history_preds, color='red', label='Adaptive Prediction', linewidth=1.5)
            
            # Plot Current Individual Model Predictions (Gray dots)
            # We plot them at the current date
            ax_main.scatter([current_date] * len(model_preds), model_preds, color='gray', alpha=0.5, s=20, label='Model Preds')
            
            # Highlight the Adaptive Prediction
            ax_main.scatter([current_date], [adaptive_pred], color='red', s=50, zorder=5)
            
            ax_main.set_title(f"{ticker} - Real-time Prediction Stream\nStep: {step}")
            ax_main.legend(loc='upper left')
            ax_main.grid(True, alpha=0.3)
            
            # Plot Weights
            w_history_array = np.array(history_weights)
            for i in range(w_history_array.shape[1]):
                ax_weights.plot(history_dates, w_history_array[:, i], label=f"Model {i+1}")
            
            ax_weights.set_title("Model Weights")
            ax_weights.set_ylim(0, 1)
            ax_weights.legend(loc='upper left')
            
            plt.draw()
            plt.pause(config['training']['sleep']) # Wait 0.5s
            
            # --- PHASE 2: Show Actual & Error (T=0.5) ---
            history_actuals.append(actual)
            
            # Update Plot with Actual
            ax_main.scatter([current_date], [actual], color='black', marker='x', s=50, zorder=5, label='Actual')
            
            # Show Error Text
            error = adaptive_pred - actual
            error_pct = (error / actual) * 100
            
            # Add text annotation
            ax_main.text(1.02, 0.5, f"Step: {step}\n\nPred: {adaptive_pred:.2f}\nActual: {actual:.2f}\n\nError: {error:.4f}\nError %: {error_pct:.2f}%", 
                         transform=ax_main.transAxes, verticalalignment='center', 
                         bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
            
            plt.draw()
            plt.pause(config['training']['sleep']) # Wait another 0.5s (Total 1s per step)
            
            # Check if user closed the window (optional, hard to detect in simple script, but loop continues)
            
    plt.ioff()
    plt.show()

if __name__ == "__main__":
    run_visualization()
