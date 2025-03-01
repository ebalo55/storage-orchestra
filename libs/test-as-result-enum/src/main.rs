// test-as-result-enum/src/main.rs
#[cfg(test)]
mod tests {
    use as_result_enum::AsResultEnum;
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize, AsResultEnum)]
    struct TestStruct {
        field1: String,
        field2: i32,
        #[serde(skip)]
        skipped_field: Option<String>,
    }

    #[test]
    fn test_as_result_enum_basic() {
        let instance = TestStruct {
            field1: String::from("value1"),
            field2: 42,
            skipped_field: Some(String::from("skipped")),
        };

        let result_enum = TestStructResult::field1(instance.field1.clone());
        assert_eq!(result_enum.to_string(), "field1");

        let result_enum = TestStructResult::field2(instance.field2);
        assert_eq!(result_enum.to_string(), "field2");
    }

    #[test]
    fn test_serialization_deserialization() {
        let instance = TestStruct {
            field1: String::from("value1"),
            field2: 42,
            skipped_field: Some(String::from("skipped")),
        };

        let json = serde_json::to_string(&instance).unwrap();
        let deserialized: TestStruct = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.field1, "value1");
        assert_eq!(deserialized.field2, 42);
        assert_eq!(deserialized.skipped_field, None);
    }
}

fn main() {}
