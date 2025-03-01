#[cfg(test)]
mod tests {
    use as_inner_serializable::AsInnerSerializable;
    use serde::Deserialize;
    use serde::Serialize;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[derive(AsInnerSerializable)]
    struct TestStruct {
        #[serde(skip)]
        skipped_field: String,
        normal_field: i32,
        skipped_option_field: Option<String>,
        skipped_arc_rwlock_field: Arc<RwLock<String>>,
    }

    #[tokio::test]
    async fn test_provider_data_derive() {
        let instance = TestStruct {
            skipped_field: String::from("skipped"),
            normal_field: 42,
            skipped_option_field: Some(String::from("not-skipped")),
            skipped_arc_rwlock_field: Arc::new(RwLock::new(String::from("not-skipped"))),
        };

        let inner = instance.into_inner().await;
        assert_eq!(inner.normal_field, 42);
        assert_eq!(
            inner.skipped_option_field,
            Some(String::from("not-skipped"))
        );
        assert_eq!(inner.skipped_arc_rwlock_field, "not-skipped");
    }
}

fn main() {}
