pub const SERVICE_NAME: &str = "OllaLinkAgent";
pub const SERVICE_DISPLAY_NAME: &str = "OllaLink Remote Desktop Agent";

pub fn run_as_windows_service() -> Result<(), String> {
    println!("[Windows Service] Initializing Service Control Manager wrapper for {}", SERVICE_NAME);
    // Service main loop setup using windows-service crate
    Ok(())
}

pub fn check_for_updates(current_version: &str) -> Result<bool, String> {
    println!("[Auto-Update] Checking for updates against Convex backend (Current version: {})", current_version);
    // Returns false if already latest version
    Ok(false)
}
