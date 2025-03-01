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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_get_json_value_object() {
        let json = json!({
            "a": {
                "b": {
                    "c": "value"
                }
            }
        });

        assert_eq!(get_json_value(&json, "a.b.c"), Some(&json!("value")));
        assert_eq!(get_json_value(&json, "a.b"), Some(&json!({"c": "value"})));
        assert_eq!(
            get_json_value(&json, "a"),
            Some(&json!({"b": {"c": "value"}}))
        );
        assert_eq!(get_json_value(&json, "a.b.d"), None);
        assert_eq!(get_json_value(&json, "a.x"), None);
    }

    #[test]
    fn test_get_json_value_array() {
        let json = json!({
            "a": [
                {"b": "value1"},
                {"b": "value2"}
            ]
        });

        assert_eq!(get_json_value(&json, "a.0.b"), Some(&json!("value1")));
        assert_eq!(get_json_value(&json, "a.1.b"), Some(&json!("value2")));
        assert_eq!(get_json_value(&json, "a.2.b"), None);
        assert_eq!(get_json_value(&json, "a.b"), None);
    }

    #[test]
    fn test_get_json_value_invalid_path() {
        let json = json!({
            "a": {
                "b": "value"
            }
        });

        assert_eq!(get_json_value(&json, "a.b.c"), None);
        assert_eq!(get_json_value(&json, "a.b.0"), None);
        assert_eq!(get_json_value(&json, "a.b.x"), None);
    }

    #[test]
    fn test_get_json_value_non_object_array() {
        let json = json!("value");

        assert_eq!(get_json_value(&json, "a"), None);
        assert_eq!(get_json_value(&json, "0"), None);
    }
}
