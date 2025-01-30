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