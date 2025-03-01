use std::fmt;
use std::fmt::{Debug, Formatter};
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};
use tokio::time::{Duration, sleep};
use tracing::error;

/// A debounced saver that saves content after a delay.
/// This is useful for saving content that is frequently updated.
#[derive(Clone)]
pub struct DebouncedSaver {
    /// The delay before saving the content.
    delay: Duration,
    /// The pending content to save.
    pending_content: Arc<Mutex<Option<String>>>,
    /// A notification to trigger the debounced task.
    notify: Arc<Notify>,
    save_fn: Arc<
        Mutex<
            Option<Box<dyn FnOnce(String) -> tauri::async_runtime::JoinHandle<()> + Send + Sync>>,
        >,
    >,
}

impl Debug for DebouncedSaver {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("DebouncedSaver")
            .field("delay", &self.delay)
            .field("pending_content", &self.pending_content)
            .finish()
    }
}

impl Default for DebouncedSaver {
    fn default() -> Self {
        Self::new(100)
    }
}

impl DebouncedSaver {
    /// Create a new debounced saver.
    ///
    /// # Arguments
    ///
    /// * `delay_ms` - The delay before saving the content in milliseconds.
    ///
    /// # Returns
    ///
    /// The debounced saver.
    pub fn new(delay_ms: u64) -> Self {
        let saver = Self {
            delay: Duration::from_millis(delay_ms),
            pending_content: Arc::new(Mutex::new(None)),
            notify: Arc::new(Notify::new()),
            save_fn: Arc::new(Mutex::new(None)),
        };

        saver.start_background_task();

        saver
    }

    /// Save the content after the delay has passed.
    /// If the content is saved before the delay has passed, the timer is reset.
    ///
    /// # Arguments
    ///
    /// * `content` - The content to save.
    /// * `save_fn` - The function to save the content.
    ///
    /// # Returns
    ///
    /// Nothing.
    pub async fn save<F, Fut>(&self, content: String, save_fn: F)
    where
        F: FnOnce(String) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<(), String>> + Send + 'static,
    {
        let mut pending = self.pending_content.lock().await;
        *pending = Some(content);

        let mut fn_lock = self.save_fn.lock().await;
        *fn_lock = Some(Box::new(move |content| {
            let fut = save_fn(content);
            tauri::async_runtime::spawn(async move {
                if let Err(e) = fut.await {
                    error!("Error saving content: {}", e);
                }
            })
        }));

        self.notify.notify_one();
    }

    fn start_background_task(&self) {
        let pending_content = Arc::clone(&self.pending_content);
        let notify = Arc::clone(&self.notify);
        let delay = self.delay;
        let save_fn = Arc::clone(&self.save_fn);

        tauri::async_runtime::spawn(async move {
            loop {
                notify.notified().await; // Wait for notification
                sleep(delay).await; // Debounce timer

                let mut pending = pending_content.lock().await;
                let mut fn_lock = save_fn.lock().await;

                if let Some(content) = pending.take() {
                    if let Some(save_fn) = fn_lock.take() {
                        save_fn(content);
                    }
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;
    use tokio::time::timeout;

    #[tokio::test]
    async fn test_debounced_saver_new() {
        let saver = DebouncedSaver::new(100);
        assert_eq!(saver.delay, Duration::from_millis(100));
    }

    #[tokio::test]
    async fn test_debounced_saver_default() {
        let saver = DebouncedSaver::default();
        assert_eq!(saver.delay, Duration::from_millis(100));
    }

    #[tokio::test]
    async fn test_debounced_saver_save() {
        let saver = DebouncedSaver::new(100);
        let (tx, mut rx) = mpsc::channel(1);

        saver
            .save("test content".to_string(), move |content| {
                let tx = tx.clone();
                async move {
                    tx.send(content).await.unwrap();
                    Ok(())
                }
            })
            .await;

        let result = timeout(Duration::from_secs(1), rx.recv()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().unwrap(), "test content");
    }

    #[tokio::test]
    async fn test_debounced_saver_save_error() {
        let saver = DebouncedSaver::new(100);
        let (tx, mut rx) = mpsc::channel(1);

        saver
            .save("test content".to_string(), move |_content| {
                let tx = tx.clone();
                async move {
                    tx.send("error".to_string()).await.unwrap();
                    Err("save error".to_string())
                }
            })
            .await;

        let result = timeout(Duration::from_secs(1), rx.recv()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().unwrap(), "error");
    }
}
