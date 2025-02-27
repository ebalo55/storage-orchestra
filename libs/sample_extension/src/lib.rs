use extensions_loader::Extension;

struct SampleExtension;

impl Extension for SampleExtension {
    fn name(&self) -> String {
        "Sample Extension".to_string()
    }

    fn version(&self) -> String {
        "0.1.0".to_string()
    }

    fn author(&self) -> String {
        "Ebalo".to_string()
    }

    fn description(&self) -> String {
        "A sample extension for the extensions loader.".to_string()
    }

    fn run(&self) {
        println!("Sample Extension Loaded Successfully!");
    }
}

/// Factory function required by the loader.
#[unsafe(no_mangle)]
pub extern "C" fn create_extension() -> *mut Box<dyn Extension> {
    // Create your concrete extension as a Box<dyn Extension>
    let ext: Box<dyn Extension> = Box::new(SampleExtension {});
    // Wrap it in a Box, then convert that Box into a thin pointer.
    Box::into_raw(Box::new(ext))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_extension() {
        let extension = create_extension();

        assert_eq!(extension.name(), "Sample Extension");
        assert_eq!(extension.version(), "0.1.0");
        assert_eq!(extension.author(), "Ebalo");
        assert_eq!(
            extension.description(),
            "A sample extension for the extensions loader."
        );
        extension.run();
    }
}
