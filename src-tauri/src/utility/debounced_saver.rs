use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use std::sync::Arc;

/// A debounced saver that saves content after a delay.
/// This is useful for saving content that is frequently updated.
#[derive(Clone, Debug)]
pub struct DebouncedSaver {
    /// The delay before saving the content.
    delay: Duration,
    /// The pending content to save.
    pending_content: Arc<Mutex<Option<String>>>,
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
        Self {
            delay: Duration::from_millis(delay_ms),
            pending_content: Arc::new(Mutex::new(None)),
        }
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
            F: Fn(String) -> Fut + Send + Sync + 'static,
            Fut: Future<Output = Result<(), String>> + Send + 'static,
    {
        let mut pending = self.pending_content.lock().await;
        *pending = Some(content);

        // Clone references for the async task
        let pending_content = Arc::clone(&self.pending_content);
        let delay = self.delay;
        let save_fn = Arc::new(save_fn);

        tokio::spawn(async move {
            sleep(delay).await;

            let mut pending = pending_content.lock().await;
            if let Some(content) = pending.take() {
                if let Err(e) = save_fn(content).await {
                    eprintln!("Error saving content: {}", e);
                }
            }
        });
    }
}
