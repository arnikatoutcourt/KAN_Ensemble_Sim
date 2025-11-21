import asyncio
import json
import yaml
import torch
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from main import load_config, check_volatility
from data_loader import prepare_data, get_tickers_by_domain
from ensemble import EnsembleManager

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_PATH = "config.yaml"

class ConfigUpdate(BaseModel):
    domain: str
    count: int
    lookback: int
    start_date: str
    end_date: str
    epochs: int
    learning_rate: float
    sleep: float
    volatility_threshold: float

@app.get("/config")
async def get_config():
    return load_config(CONFIG_PATH)

@app.post("/config")
async def update_config(new_config: ConfigUpdate):
    # Load existing to preserve structure
    current = load_config(CONFIG_PATH)
    
    # Update values
    current['data']['domain'] = new_config.domain
    current['data']['count'] = new_config.count
    current['data']['lookback'] = new_config.lookback
    current['data']['start_date'] = new_config.start_date
    current['data']['end_date'] = new_config.end_date
    current['training']['epochs'] = new_config.epochs
    current['training']['learning_rate'] = new_config.learning_rate
    current['training']['sleep'] = new_config.sleep
    current['volatility']['threshold'] = new_config.volatility_threshold
    
    with open(CONFIG_PATH, "w") as f:
        yaml.dump(current, f)
        
    return {"status": "updated", "config": current}

@app.get("/tickers")
async def get_tickers():
    config = load_config(CONFIG_PATH)
    tickers = get_tickers_by_domain(config['data']['domain'], config['data']['count'])
    return {"tickers": tickers}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_json(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

manager = ConnectionManager()

async def run_simulation_for_ticker(ticker: str, config: dict, websocket: WebSocket):
    try:
        await manager.send_json({"type": "status", "ticker": ticker, "message": "Checking Volatility..."}, websocket)
        
        # 0. Volatility Check
        vol = check_volatility(ticker, config['data']['start_date'], config['data']['end_date'])
        VOL_THRESHOLD = config['volatility']['threshold']
        
        model_type = "KAN"
        if vol > VOL_THRESHOLD:
            model_type = "BiLSTM-Attn"
            await manager.send_json({"type": "log", "ticker": ticker, "message": f"⚠️ High Volatility ({vol:.2%}). Using {model_type}."}, websocket)
        else:
            await manager.send_json({"type": "log", "ticker": ticker, "message": f"✅ Stable Volatility ({vol:.2%}). Using {model_type}."}, websocket)
            
        # 1. Data Preparation
        await manager.send_json({"type": "status", "ticker": ticker, "message": "Preparing Data..."}, websocket)
        
        try:
            X_train, X_test, y_train, y_test, dates_test, feature_cols, scaler_y = prepare_data(
                ticker=ticker, 
                start_date=config['data']['start_date'],
                end_date=config['data']['end_date'],
                lookback=config['data']['lookback'],
                split_percent=config['training']['percentage']
            )
        except Exception as e:
            await manager.send_json({"type": "error", "ticker": ticker, "message": str(e)}, websocket)
            return

        # 2. Train
        await manager.send_json({"type": "status", "ticker": ticker, "message": f"Training {config['ensemble']['size']} Models..."}, websocket)
        
        input_dim_kan = X_train.shape[1] * X_train.shape[2]
        input_dim_lstm = X_train.shape[2]
        hidden_dim = config['model']['hidden_dim']
        output_dim = config['model']['output_dim']
        
        if model_type == "KAN":
            ensemble = EnsembleManager("KAN", input_dim_kan, hidden_dim, output_dim, config)
            X_train_ens = X_train.reshape(X_train.shape[0], -1)
            X_test_ens = X_test.reshape(X_test.shape[0], -1)
        else:
            ensemble = EnsembleManager("BiLSTM-Attn", input_dim_lstm, hidden_dim, output_dim, config)
            X_train_ens = X_train
            X_test_ens = X_test
            
        ensemble.train_models(
            X_train_ens, y_train, 
            epochs=config['training']['epochs'], 
            lr=config['training']['learning_rate']
        )
        
        await manager.send_json({"type": "status", "ticker": ticker, "message": "Streaming Predictions..."}, websocket)
        
        # 3. Stream
        generator = ensemble.predict_stream_generator(X_test_ens, y_test, scaler_y)
        
        for step_data in generator:
            # Convert numpy types to native python for JSON serialization
            payload = {
                "type": "data",
                "ticker": ticker,
                "step": int(step_data['step']),
                "date": str(dates_test[step_data['step']]),
                "adaptive": float(step_data['adaptive']),
                "ensemble_mean": float(step_data['ensemble_mean']),
                "best_expert": float(step_data['best_expert']),
                "actual": float(step_data['actual']),
                "weights": step_data['weights'].tolist(),
                "model_preds": step_data['model_preds'].tolist()
            }
            await manager.send_json(payload, websocket)
            await asyncio.sleep(config['training'].get('sleep', 0.1))
            
        await manager.send_json({"type": "status", "ticker": ticker, "message": "Simulation Complete"}, websocket)
        
    except Exception as e:
        print(f"Error in simulation for {ticker}: {e}")
        await manager.send_json({"type": "error", "ticker": ticker, "message": str(e)}, websocket)


@app.websocket("/ws/simulate")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            command = json.loads(data)
            
            if command['action'] == 'start':
                config = load_config(CONFIG_PATH)
                tickers = command.get('tickers', [])
                if not tickers:
                    tickers = get_tickers_by_domain(config['data']['domain'], config['data']['count'])
                
                # Run simulations concurrently
                tasks = [run_simulation_for_ticker(ticker, config, websocket) for ticker in tickers]
                await asyncio.gather(*tasks)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
