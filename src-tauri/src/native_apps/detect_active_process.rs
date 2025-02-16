use tauri::AppHandle;
use tauri::test::MockRuntime;
use tauri_plugin_shell::ShellExt;

/// Detect which process opened the file (Windows: uses handle-x86_64-pc-windows-msvc.exe, Mac/Linux: uses lsof)
///
/// # Arguments
///
/// * `app` - The Tauri app handle.
/// * `file_path` - The path to the file to check.
///
/// # Returns
///
/// A `Result` containing the process ID of the process that opened the file, or `None` if the process could not be detected.
async fn get_process_using_file(
    app: AppHandle<MockRuntime>,
    file_path: &str,
) -> Result<Option<u32>, String> {
    #[cfg(target_os = "windows")]
    {
        let handle_cmd = app.shell().sidecar("handle").map_err(|e| e.to_string())?;
        let output = handle_cmd
            .args(&["-accepteula", "-nobanner", file_path])
            .output()
            .await
            .ok()
            .unwrap();

        let stdout = String::from_utf8_lossy(&output.stdout);

        for line in stdout.lines() {
            if let Some(pid_str) = line.split_whitespace().nth(1) {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    return Ok(Some(pid));
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .arg("-t")
            .arg(file_path)
            .output()
            .ok()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        return stdout.lines().next()?.parse::<u32>().ok();
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("lsof")
            .arg("-t")
            .arg(file_path)
            .output()
            .ok()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        return stdout.lines().next()?.parse::<u32>().ok();
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::mock_app;

    #[tokio::test]
    async fn test_get_process_using_file() {
        let app = mock_app();
        let handle = app.handle();
        let file_path = "C:\\Users\\ebalo\\AppData\\Local\\Temp\\Sample.docx";

        let result = get_process_using_file(handle.clone(), file_path).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_some());
    }
}
