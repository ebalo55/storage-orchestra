#[cfg(not(test))]
pub const TRUSTED_HASHES: &[&str] = &[];
#[cfg(test)]
pub const TRUSTED_HASHES: &[&str] = &[
    // Hash of "trusted content"
    "fb454ce23a6305f620c28d01de987af1ee63184b26e68441074b9b1ac3130da652fac37a2f5e6046e2d59239a9ab1473557dcfc405620ebc5558d109d60fece1",
];
