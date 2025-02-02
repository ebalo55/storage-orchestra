use base64ct::Encoding;

/// Encodes data to base64.
///
/// # Arguments
///
/// * `data` - The data to encode.
///
/// # Returns
///
/// The base64-encoded data.
pub fn encode(data: impl AsRef<[u8]>) -> String {
    base64ct::Base64Unpadded::encode_string(data.as_ref())
}

/// Decodes base64-encoded data.
///
/// # Arguments
///
/// * `data` - The data to decode.
///
/// # Returns
///
/// The decoded data.
pub fn decode(data: &str) -> Result<Vec<u8>, String> {
    base64ct::Base64Unpadded::decode_vec(data).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode() {
        let data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let encoded = encode(data.as_slice());
        assert_eq!(encoded, "AAECAwQFBgcICQ");
    }

    #[test]
    fn test_decode() {
        let data = "AAECAwQFBgcICQ";
        let decoded = decode(data).unwrap();
        assert_eq!(decoded, vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
}
