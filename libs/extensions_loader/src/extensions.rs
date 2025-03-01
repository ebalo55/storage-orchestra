use libloading::Library;
use std::sync::{Arc, RwLock};
use tauri::AppHandle;

pub static EXTENSIONS: RwLock<Vec<Arc<Box<dyn Extension>>>> = RwLock::new(vec![]);
pub static LIBRARIES: RwLock<Vec<Library>> = RwLock::new(vec![]);

pub type CreateExtensionFn = unsafe fn() -> *mut Box<dyn Extension>;

pub trait Extension: Send + Sync {
    /// The name of the extension.
    fn name(&self) -> String;
    /// The version of the extension.
    fn version(&self) -> String;
    /// The author of the extension.
    fn author(&self) -> String;
    /// A description of the extension.
    fn description(&self) -> String;
    /// The entry point of the extension.
    fn run(&self, app: AppHandle) -> Result<(), String>;
}

/// Loads a dynamic library and ensures it follows the `Extension` trait.
///
/// # Arguments
///
/// * `path` - The path to the dynamic library.
///
/// # Returns
///
/// A `Result` containing the extension, or an error message if the extension could not be loaded.
pub unsafe fn load_extension(path: &str) -> Result<Box<dyn Extension>, String> {
    unsafe {
        let lib = Library::new(path).map_err(|e| e.to_string())?;

        let constructor = lib
            .get::<CreateExtensionFn>(b"create_extension")
            .map_err(|e| e.to_string())?;

        // Call the constructor to obtain a pointer to Box<dyn Extension>
        let ext_box_ptr = constructor();
        if ext_box_ptr.is_null() {
            return Err("Null pointer returned from create_extension".to_owned());
        }

        // Reconstruct the Box<Box<dyn Extension>> from the raw pointer.
        let outer_box: Box<Box<dyn Extension>> = Box::from_raw(ext_box_ptr);

        // Now, the inner box is our Box<dyn Extension>
        let inner_box: Box<dyn Extension> = *outer_box;

        let mut libraries = LIBRARIES.write().unwrap();
        libraries.push(lib);
        drop(libraries);

        Ok(inner_box)
    }
}
