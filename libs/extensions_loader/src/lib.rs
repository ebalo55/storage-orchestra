mod extensions;
mod hash_whitelist;

use crate::extensions::{EXTENSIONS, load_extension};
use crate::hash_whitelist::is_hash_trusted;
pub use extensions::Extension;
pub use hash_whitelist::hash_file;
use libloading::library_filename;
use std::fs::read_dir;

/// Load all extensions from the `./extensions` directory.
pub fn load_extensions() -> Result<(), String> {
    let extension_path = "./extensions";
    let items = read_dir(extension_path).map_err(|e| e.to_string())?;
    let mut available_extensions_number = 0;

    for entry in items {
        available_extensions_number += 1;
        let entry = entry.unwrap();
        let path = entry.path();

        // ensure the file is correct for the platform
        if path.file_name().unwrap() != library_filename(path.file_stem().unwrap()) {
            eprintln!(
                "Skipping invalid extension for current platform: {}",
                path.to_str().unwrap()
            );
            continue;
        }

        let path = path.to_str().unwrap();
        if !is_hash_trusted(&path) {
            eprintln!("Skipping untrusted extension: {}", path);
            continue;
        }

        let extension = unsafe { load_extension(&path) };
        if extension.is_err() {
            eprintln!(
                "Failed to load extension at '{}': {}",
                path,
                extension.err().unwrap()
            );
            continue;
        }
        let extension = extension?;
        println!(
            "Loaded extension '{} v{}' by {}",
            extension.name(),
            extension.version(),
            extension.author()
        );
        extension.run();

        let mut extensions = EXTENSIONS.write().unwrap();
        extensions.push(extension);
        drop(extensions);
    }

    if available_extensions_number == 0 {
        eprintln!("No extensions found in the `./extensions` directory.");
    }

    let extensions = EXTENSIONS.read().unwrap();
    let extensions_number = extensions.len();
    drop(extensions);

    println!(
        "Loaded {}/{} extensions.",
        extensions_number, available_extensions_number
    );

    Ok(())
}
