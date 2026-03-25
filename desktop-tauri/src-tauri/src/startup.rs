use std::{
    net::TcpStream,
    thread,
    time::{Duration, Instant},
};

use crate::{paths::app_url_for_port, runtime::StartupPhase, AppState};

pub(crate) fn wait_for_server_ready(state: &AppState, timeout: Duration) -> Result<(), String> {
    let server_port = state.server_port();
    let app_url = app_url_for_port(server_port);
    let started = Instant::now();
    while started.elapsed() <= timeout {
        if TcpStream::connect(("127.0.0.1", server_port)).is_ok() {
            state.set_startup_phase(
                StartupPhase::Ready,
                Some(format!("PrismAI is ready at {app_url}.")),
            );
            return Ok(());
        }

        if let Some(error) = state.detect_startup_failure() {
            return Err(error);
        }

        thread::sleep(Duration::from_millis(300));
    }

    let recent_summary = state.recent_runtime_summary();
    if recent_summary.is_empty() {
        return Err(format!(
            "PrismAI was not reachable at {} within {} seconds.",
            app_url,
            timeout.as_secs()
        ));
    }

    Err(format!(
        "PrismAI was not reachable at {} within {} seconds.\n\n{}",
        app_url,
        timeout.as_secs(),
        recent_summary
    ))
}
