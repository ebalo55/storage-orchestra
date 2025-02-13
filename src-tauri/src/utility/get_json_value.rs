use serde_json::Value;

/// Retrieve a value from a `serde_json::Value` using a dot-separated JSON path.
///
/// # Arguments
///
/// * `json` - The JSON structure to search.
/// * `path` - A dot-separated string representing the JSON path.
///
/// # Returns
///
/// An `Option<&Value>` containing the value at the specified path, or `None` if not found.
pub fn get_json_value<'a>(json: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = json;

    for key in path.split('.') {
        match current {
            Value::Object(map) => {
                current = map.get(key)?;
            }
            Value::Array(arr) => {
                if let Ok(index) = key.parse::<usize>() {
                    current = arr.get(index)?;
                } else {
                    return None; // Invalid index for an array
                }
            }
            _ => return None, // Path is invalid (trying to index a non-object/array)
        }
    }

    Some(current)
}
