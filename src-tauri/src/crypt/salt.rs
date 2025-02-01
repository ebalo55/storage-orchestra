use rand::RngCore;
use tracing::debug;

/// Makes a salt if missing. The salt will be a random 32-byte salt.
///
/// # Arguments
///
/// * `salt` - The salt to use. If `None`, a random salt will be generated.
///
/// # Returns
///
/// The salt to use.
pub fn make_salt_if_missing(salt: Option<&[u8]>) -> Vec<u8> {
    debug!("Salt required, checking if it is missing");
    if salt.is_some() {
        debug!("Salt found, using it");
        return salt.unwrap().to_vec();
    }

    debug!("Salt missing, generating a 32 bytes random salt");
    let mut salt = vec![0u8; 32];
    rand::rng().fill_bytes(&mut salt);

    salt
}

/// Makes a salt with a specific length if missing.
///
/// # Arguments
///
/// * `salt` - The salt to use. If `None`, a random salt will be generated.
/// * `length` - The length of the salt.
///
/// # Returns
///
/// The salt to use.
pub fn make_salt_with_length_if_missing(salt: Option<&[u8]>, length: usize) -> Vec<u8> {
    debug!("Salt required, checking if it is missing");
    // If the salt is some and the length is the same as the length, return the salt.
    if salt.is_some() && salt.unwrap().len() == length {
        debug!("Salt found, using it");
        return salt.unwrap().to_vec();
    }

    debug!(
        "Salt missing or with wrong length, generating a {} bytes random salt",
        length
    );
    // Otherwise, return a random salt of the specified length.
    let mut salt = vec![0u8; length];
    rand::rng().fill_bytes(&mut salt);

    salt
}
