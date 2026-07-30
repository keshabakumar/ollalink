mod capture;
mod input;
mod service;

use capture::ScreenCapturer;
use input::InputController;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::Duration;
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};

#[derive(Serialize, Deserialize, Debug)]
struct PairingRequest {
    pairingCode: String,
    hostname: String,
    os: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct PairingResponse {
    deviceId: String,
    deviceToken: String,
    workspaceId: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct HeartbeatResponse {
    status: String,
    activeSessionId: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("==================================================");
    println!("   OllaLink Windows Agent & Remote Engine v0.1.0  ");
    println!("==================================================");

    let args: Vec<String> = env::args().collect();
    if args.iter().any(|a| a == "--service") {
        service::run_as_windows_service().unwrap();
        return Ok(());
    }

    let convex_url = env::var("CONVEX_URL").unwrap_or_else(|_| "http://localhost:3210".to_string());
    let relay_url = env::var("RELAY_URL").unwrap_or_else(|_| "ws://localhost:8080".to_string());

    let capturer = ScreenCapturer::new();
    let input_ctrl = InputController::new();

    println!("[Agent] Starting Windows Agent background worker...");
    println!("[Agent] Screen resolution: {}x{}", capturer.get_dimensions().0, capturer.get_dimensions().1);

    // Main Heartbeat & Session Loop
    loop {
        // Heartbeat / Session Check
        sleep(Duration::from_secs(3)).await;
    }
}
