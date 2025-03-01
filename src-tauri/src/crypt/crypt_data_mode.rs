/// Define the working modes of the CryptData struct
#[derive(Debug, PartialEq, Eq)]
pub enum CryptDataMode {
    /// Represent the hashing of data
    Hash = 0b0001,
    /// Represent the encoding of data
    Encode = 0b0010,
    /// Represent the encryption of data
    Encrypt = 0b0100,
    /// Represent the HMAC of data
    Hmac = 0b1000,
    /// Marks the data as being a password hash, this is used to uniquely identify the password in the state
    PasswordHash = 0b0001_0001,
    /// Marks the data as being a signature hmac, this is used to uniquely identify the signature in the state
    SignatureHash = 0b0010_1000,
    /// Marks the data as having been modified during serialization
    ModifiedDuringSerialization = 0b1000_0000,
}

impl CryptDataMode {
    pub fn strip_string_mode(mode: &str) -> &str {
        if mode.starts_with("hash:") {
            return mode.strip_prefix("hash:").unwrap();
        }
        if mode.starts_with("hmac:") {
            return mode.strip_prefix("hmac:").unwrap();
        }
        if mode.starts_with("encode:") {
            return mode.strip_prefix("encode:").unwrap();
        }
        if mode.starts_with("secret:") {
            return mode.strip_prefix("secret:").unwrap();
        }

        mode
    }
    /// Convert a u8 to the working modes
    ///
    /// # Arguments
    ///
    /// * `mode` - The u8 representation of the working modes
    ///
    /// # Returns
    ///
    /// The working modes
    pub fn from_u8(mode: u8) -> Vec<Self> {
        let mut modes = Vec::new();

        if Self::should_hash(mode) {
            modes.push(CryptDataMode::Hash);
        }
        if Self::should_encode(mode) {
            modes.push(CryptDataMode::Encode);
        }
        if Self::should_encrypt(mode) {
            modes.push(CryptDataMode::Encrypt);
        }
        if Self::should_hmac(mode) {
            modes.push(CryptDataMode::Hmac);
        }
        if Self::has_been_modified_during_serialization(mode) {
            modes.push(CryptDataMode::ModifiedDuringSerialization);
        }
        if Self::is_password_hash(mode) {
            modes.push(CryptDataMode::PasswordHash);
        }
        if Self::is_signature_hash(mode) {
            modes.push(CryptDataMode::SignatureHash);
        }

        modes
    }

    /// Convert the working modes to a u8
    ///
    /// # Arguments
    ///
    /// * `modes` - The working modes
    ///
    /// # Returns
    ///
    /// The u8 representation of the working modes
    pub fn to_u8(modes: Vec<Self>) -> u8 {
        let mut mode = 0;

        for m in modes {
            mode |= m as u8;
        }

        mode
    }

    /// Check if the data should be hashed
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data should be hashed
    pub fn should_hash(mode: u8) -> bool {
        mode & CryptDataMode::Hash as u8 == CryptDataMode::Hash as u8
    }

    /// Check if the data should be encoded
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data should be encoded
    pub fn should_encode(mode: u8) -> bool {
        mode & CryptDataMode::Encode as u8 == CryptDataMode::Encode as u8
    }

    /// Check if the data should be encrypted
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data should be encrypted
    pub fn should_encrypt(mode: u8) -> bool {
        mode & CryptDataMode::Encrypt as u8 == CryptDataMode::Encrypt as u8
    }

    /// Check if the data should be HMACed
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data should be HMACed
    pub fn should_hmac(mode: u8) -> bool {
        mode & CryptDataMode::Hmac as u8 == CryptDataMode::Hmac as u8
    }

    /// Convert a string to the working modes
    ///
    /// # Arguments
    ///
    /// * `mode` - A string containing a prefixed working mode
    pub fn from_string(mode: &str) -> Vec<Self> {
        let mut modes = Vec::new();

        if mode.starts_with("hash:") {
            modes.push(CryptDataMode::Hash);
        }
        if mode.starts_with("hmac:") {
            modes.push(CryptDataMode::Hmac);
        }
        if mode.starts_with("encode:") {
            modes.push(CryptDataMode::Encode);
        }
        if mode.starts_with("secret:") {
            modes.push(CryptDataMode::Encrypt);
            modes.push(CryptDataMode::Encode);
        }

        modes
    }

    /// Convert a string to the working mode value
    ///
    /// # Arguments
    ///
    /// * `mode` - A string containing a prefixed working mode
    ///
    /// # Returns
    ///
    /// The working mode value
    pub fn from_string_to_u8(mode: &str) -> u8 {
        let modes = Self::from_string(mode);
        Self::to_u8(modes)
    }

    /// Check if the data has been modified during serialization
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data has been modified during serialization
    pub fn has_been_modified_during_serialization(mode: u8) -> bool {
        mode & CryptDataMode::ModifiedDuringSerialization as u8
            == CryptDataMode::ModifiedDuringSerialization as u8
    }

    /// Check if the data is a password hash
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data is a password hash
    pub fn is_password_hash(mode: u8) -> bool {
        mode & CryptDataMode::PasswordHash as u8 == CryptDataMode::PasswordHash as u8
    }

    /// Check if the data is a signature hash
    ///
    /// # Arguments
    ///
    /// * `mode` - The working mode of the data
    ///
    /// # Returns
    ///
    /// Whether the data is a signature hash
    pub fn is_signature_hash(mode: u8) -> bool {
        mode & CryptDataMode::SignatureHash as u8 == CryptDataMode::SignatureHash as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_string_mode() {
        assert_eq!(CryptDataMode::strip_string_mode("hash:data"), "data");
        assert_eq!(CryptDataMode::strip_string_mode("hmac:data"), "data");
        assert_eq!(CryptDataMode::strip_string_mode("encode:data"), "data");
        assert_eq!(CryptDataMode::strip_string_mode("secret:data"), "data");
        assert_eq!(CryptDataMode::strip_string_mode("data"), "data");
    }

    #[test]
    fn test_from_u8() {
        let modes = CryptDataMode::from_u8(0b111);
        assert!(modes.contains(&CryptDataMode::Hash));
        assert!(modes.contains(&CryptDataMode::Encode));
        assert!(modes.contains(&CryptDataMode::Encrypt));
    }

    #[test]
    fn test_to_u8() {
        let modes = vec![
            CryptDataMode::Hash,
            CryptDataMode::Encode,
            CryptDataMode::Encrypt,
        ];
        let mode_u8 = CryptDataMode::to_u8(modes);
        assert_eq!(mode_u8, 0b111);
    }

    #[test]
    fn test_should_hash() {
        assert!(CryptDataMode::should_hash(0b001));
        assert!(!CryptDataMode::should_hash(0b010));
    }

    #[test]
    fn test_should_encode() {
        assert!(CryptDataMode::should_encode(0b010));
        assert!(!CryptDataMode::should_encode(0b001));
    }

    #[test]
    fn test_should_encrypt() {
        assert!(CryptDataMode::should_encrypt(0b100));
        assert!(!CryptDataMode::should_encrypt(0b001));
    }

    #[test]
    fn test_should_hmac() {
        assert!(CryptDataMode::should_hmac(0b1000));
        assert!(!CryptDataMode::should_hmac(0b0001));
    }

    #[test]
    fn test_from_string() {
        let modes = CryptDataMode::from_string("secret:data");
        assert!(modes.contains(&CryptDataMode::Encrypt));
        assert!(modes.contains(&CryptDataMode::Encode));
    }

    #[test]
    fn test_from_string_to_u8() {
        let mode_u8 = CryptDataMode::from_string_to_u8("secret:data");
        assert_eq!(mode_u8, 0b110);
    }

    #[test]
    fn test_has_been_modified_during_serialization() {
        assert!(CryptDataMode::has_been_modified_during_serialization(
            0b1000_0000
        ));
        assert!(!CryptDataMode::has_been_modified_during_serialization(
            0b0000_0001
        ));
    }

    #[test]
    fn test_is_password_hash() {
        assert!(CryptDataMode::is_password_hash(0b0001_0001));
        assert!(!CryptDataMode::is_password_hash(0b0000_0001));
    }

    #[test]
    fn test_is_signature_hash() {
        assert!(CryptDataMode::is_signature_hash(0b0010_1000));
        assert!(!CryptDataMode::is_signature_hash(0b0000_1000));
    }
}
