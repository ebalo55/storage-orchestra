use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Type)]
pub struct Mime {
    /// The MIME type of the file
    pub mime: String,
    /// The file extension associated with the MIME type
    pub extension: String,
}

impl From<infer::Type> for Mime {
    fn from(mime: infer::Type) -> Self {
        Mime {
            mime: mime.mime_type().to_string(),
            extension: mime.extension().to_string(),
        }
    }
}

impl From<FileMimes> for Mime {
    fn from(v: FileMimes) -> Self {
        match v {
            FileMimes::WASM => Self {
                mime: "application/wasm".to_owned(),
                extension: "wasm".to_owned(),
            },
            FileMimes::ELF => Self {
                mime: "application/x-executable".to_owned(),
                extension: "elf".to_owned(),
            },
            FileMimes::EXE => Self {
                mime: "application/vnd.microsoft.portable-executable".to_owned(),
                extension: "exe".to_owned(),
            },
            FileMimes::DLL => Self {
                mime: "application/vnd.microsoft.portable-executable".to_owned(),
                extension: "dll".to_owned(),
            },
            FileMimes::CLASS => Self {
                mime: "application/java".to_owned(),
                extension: "class".to_owned(),
            },
            FileMimes::BC => Self {
                mime: "application/x-llvm".to_owned(),
                extension: "bc".to_owned(),
            },
            FileMimes::MACH => Self {
                mime: "application/x-mach-binary".to_owned(),
                extension: "mach".to_owned(),
            },
            FileMimes::DEX => Self {
                mime: "application/vnd.android.dex".to_owned(),
                extension: "dex".to_owned(),
            },
            FileMimes::DEY => Self {
                mime: "application/vnd.android.dey".to_owned(),
                extension: "dey".to_owned(),
            },
            FileMimes::DER => Self {
                mime: "application/x-x509-ca-cert".to_owned(),
                extension: "der".to_owned(),
            },
            FileMimes::OBJ => Self {
                mime: "application/x-executable".to_owned(),
                extension: "obj".to_owned(),
            },
            FileMimes::PEM => Self {
                mime: "application/x-x509-ca-cert".to_owned(),
                extension: "pem".to_owned(),
            },
            FileMimes::EPUB => Self {
                mime: "application/epub+zip".to_owned(),
                extension: "epub".to_owned(),
            },
            FileMimes::MOBI => Self {
                mime: "application/x-mobipocket-ebook".to_owned(),
                extension: "mobi".to_owned(),
            },
            FileMimes::JPG => Self {
                mime: "image/jpeg".to_owned(),
                extension: "jpg".to_owned(),
            },
            FileMimes::JP2 => Self {
                mime: "image/jp2".to_owned(),
                extension: "jp2".to_owned(),
            },
            FileMimes::PNG => Self {
                mime: "image/png".to_owned(),
                extension: "png".to_owned(),
            },
            FileMimes::GIF => Self {
                mime: "image/gif".to_owned(),
                extension: "gif".to_owned(),
            },
            FileMimes::WEBP => Self {
                mime: "image/webp".to_owned(),
                extension: "webp".to_owned(),
            },
            FileMimes::CR2 => Self {
                mime: "image/x-canon-cr2".to_owned(),
                extension: "cr2".to_owned(),
            },
            FileMimes::TIF => Self {
                mime: "image/tiff".to_owned(),
                extension: "tif".to_owned(),
            },
            FileMimes::BMP => Self {
                mime: "image/bmp".to_owned(),
                extension: "bmp".to_owned(),
            },
            FileMimes::JXR => Self {
                mime: "image/vnd.ms-photo".to_owned(),
                extension: "jxr".to_owned(),
            },
            FileMimes::PSD => Self {
                mime: "image/vnd.adobe.photoshop".to_owned(),
                extension: "psd".to_owned(),
            },
            FileMimes::ICO => Self {
                mime: "image/vnd.microsoft.icon".to_owned(),
                extension: "ico".to_owned(),
            },
            FileMimes::HEIF => Self {
                mime: "image/heif".to_owned(),
                extension: "heif".to_owned(),
            },
            FileMimes::AVIF => Self {
                mime: "image/avif".to_owned(),
                extension: "avif".to_owned(),
            },
            FileMimes::JXL => Self {
                mime: "image/jxl".to_owned(),
                extension: "jxl".to_owned(),
            },
            FileMimes::ORA => Self {
                mime: "image/openraster".to_owned(),
                extension: "ora".to_owned(),
            },
            FileMimes::DJVU => Self {
                mime: "image/vnd.djvu".to_owned(),
                extension: "djvu".to_owned(),
            },
            FileMimes::MP4 => Self {
                mime: "video/mp4".to_owned(),
                extension: "mp4".to_owned(),
            },
            FileMimes::M4V => Self {
                mime: "video/x-m4v".to_owned(),
                extension: "m4v".to_owned(),
            },
            FileMimes::MKV => Self {
                mime: "video/x-matroska".to_owned(),
                extension: "mkv".to_owned(),
            },
            FileMimes::WEBM => Self {
                mime: "video/webm".to_owned(),
                extension: "webm".to_owned(),
            },
            FileMimes::MOV => Self {
                mime: "video/quicktime".to_owned(),
                extension: "mov".to_owned(),
            },
            FileMimes::AVI => Self {
                mime: "video/x-msvideo".to_owned(),
                extension: "avi".to_owned(),
            },
            FileMimes::WMV => Self {
                mime: "video/x-ms-wmv".to_owned(),
                extension: "wmv".to_owned(),
            },
            FileMimes::MPG => Self {
                mime: "video/mpeg".to_owned(),
                extension: "mpg".to_owned(),
            },
            FileMimes::FLV => Self {
                mime: "video/x-flv".to_owned(),
                extension: "flv".to_owned(),
            },
            FileMimes::MIDI => Self {
                mime: "audio/midi".to_owned(),
                extension: "midi".to_owned(),
            },
            FileMimes::MP3 => Self {
                mime: "audio/mpeg".to_owned(),
                extension: "mp3".to_owned(),
            },
            FileMimes::M4A => Self {
                mime: "audio/m4a".to_owned(),
                extension: "m4a".to_owned(),
            },
            FileMimes::OPUS => Self {
                mime: "audio/opus".to_owned(),
                extension: "opus".to_owned(),
            },
            FileMimes::OGG => Self {
                mime: "audio/ogg".to_owned(),
                extension: "ogg".to_owned(),
            },
            FileMimes::FLAC => Self {
                mime: "audio/x-flac".to_owned(),
                extension: "flac".to_owned(),
            },
            FileMimes::WAV => Self {
                mime: "audio/x-wav".to_owned(),
                extension: "wav".to_owned(),
            },
            FileMimes::AMR => Self {
                mime: "audio/amr".to_owned(),
                extension: "amr".to_owned(),
            },
            FileMimes::AAC => Self {
                mime: "audio/aac".to_owned(),
                extension: "aac".to_owned(),
            },
            FileMimes::AIFF => Self {
                mime: "audio/x-aiff".to_owned(),
                extension: "aiff".to_owned(),
            },
            FileMimes::DSF => Self {
                mime: "audio/x-dsf".to_owned(),
                extension: "dsf".to_owned(),
            },
            FileMimes::APE => Self {
                mime: "audio/x-ape".to_owned(),
                extension: "ape".to_owned(),
            },
            FileMimes::WOFF => Self {
                mime: "application/font-woff".to_owned(),
                extension: "woff".to_owned(),
            },
            FileMimes::WOFF2 => Self {
                mime: "application/font-woff".to_owned(),
                extension: "woff2".to_owned(),
            },
            FileMimes::TTF => Self {
                mime: "application/font-sfnt".to_owned(),
                extension: "ttf".to_owned(),
            },
            FileMimes::OTF => Self {
                mime: "application/font-sfnt".to_owned(),
                extension: "otf".to_owned(),
            },
            FileMimes::DOC => Self {
                mime: "application/msword".to_owned(),
                extension: "doc".to_owned(),
            },
            FileMimes::DOCX => Self {
                mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    .to_owned(),
                extension: "docx".to_owned(),
            },
            FileMimes::XLS => Self {
                mime: "application/vnd.ms-excel".to_owned(),
                extension: "xls".to_owned(),
            },
            FileMimes::XLSX => Self {
                mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    .to_owned(),
                extension: "xlsx".to_owned(),
            },
            FileMimes::PPT => Self {
                mime: "application/vnd.ms-powerpoint".to_owned(),
                extension: "ppt".to_owned(),
            },
            FileMimes::PPTX => Self {
                mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    .to_owned(),
                extension: "pptx".to_owned(),
            },
            FileMimes::ODT => Self {
                mime: "application/vnd.oasis.opendocument.text".to_owned(),
                extension: "odt".to_owned(),
            },
            FileMimes::ODS => Self {
                mime: "application/vnd.oasis.opendocument.spreadsheet".to_owned(),
                extension: "ods".to_owned(),
            },
            FileMimes::ODP => Self {
                mime: "application/vnd.oasis.opendocument.presentation".to_owned(),
                extension: "odp".to_owned(),
            },
            FileMimes::ZIP => Self {
                mime: "application/zip".to_owned(),
                extension: "zip".to_owned(),
            },
            FileMimes::TAR => Self {
                mime: "application/x-tar".to_owned(),
                extension: "tar".to_owned(),
            },
            FileMimes::PAR2 => Self {
                mime: "application/x-par2".to_owned(),
                extension: "par2".to_owned(),
            },
            FileMimes::RAR => Self {
                mime: "application/vnd.rar".to_owned(),
                extension: "rar".to_owned(),
            },
            FileMimes::GZ => Self {
                mime: "application/gzip".to_owned(),
                extension: "gz".to_owned(),
            },
            FileMimes::BZ2 => Self {
                mime: "application/x-bzip2".to_owned(),
                extension: "bz2".to_owned(),
            },
            FileMimes::BZ3 => Self {
                mime: "application/vnd.bzip3".to_owned(),
                extension: "bz3".to_owned(),
            },
            FileMimes::_7Z => Self {
                mime: "application/x-7z-compressed".to_owned(),
                extension: "7z".to_owned(),
            },
            FileMimes::XZ => Self {
                mime: "application/x-xz".to_owned(),
                extension: "xz".to_owned(),
            },
            FileMimes::PDF => Self {
                mime: "application/pdf".to_owned(),
                extension: "pdf".to_owned(),
            },
            FileMimes::SWF => Self {
                mime: "application/x-shockwave-flash".to_owned(),
                extension: "swf".to_owned(),
            },
            FileMimes::RTF => Self {
                mime: "application/rtf".to_owned(),
                extension: "rtf".to_owned(),
            },
            FileMimes::EOT => Self {
                mime: "application/octet-stream".to_owned(),
                extension: "eot".to_owned(),
            },
            FileMimes::PS => Self {
                mime: "application/postscript".to_owned(),
                extension: "ps".to_owned(),
            },
            FileMimes::SQLITE => Self {
                mime: "application/vnd.sqlite3".to_owned(),
                extension: "sqlite".to_owned(),
            },
            FileMimes::NES => Self {
                mime: "application/x-nintendo-nes-rom".to_owned(),
                extension: "nes".to_owned(),
            },
            FileMimes::CRX => Self {
                mime: "application/x-google-chrome-extension".to_owned(),
                extension: "crx".to_owned(),
            },
            FileMimes::CAB => Self {
                mime: "application/vnd.ms-cab-compressed".to_owned(),
                extension: "cab".to_owned(),
            },
            FileMimes::DEB => Self {
                mime: "application/vnd.debian.binary-package".to_owned(),
                extension: "deb".to_owned(),
            },
            FileMimes::AR => Self {
                mime: "application/x-unix-archive".to_owned(),
                extension: "ar".to_owned(),
            },
            FileMimes::Z => Self {
                mime: "application/x-compress".to_owned(),
                extension: "Z".to_owned(),
            },
            FileMimes::LZ => Self {
                mime: "application/x-lzip".to_owned(),
                extension: "lz".to_owned(),
            },
            FileMimes::RPM => Self {
                mime: "application/x-rpm".to_owned(),
                extension: "rpm".to_owned(),
            },
            FileMimes::DCM => Self {
                mime: "application/dicom".to_owned(),
                extension: "dcm".to_owned(),
            },
            FileMimes::ZST => Self {
                mime: "application/zstd".to_owned(),
                extension: "zst".to_owned(),
            },
            FileMimes::LZ4 => Self {
                mime: "application/x-lz4".to_owned(),
                extension: "lz4".to_owned(),
            },
            FileMimes::MSI => Self {
                mime: "application/x-ole-storage".to_owned(),
                extension: "msi".to_owned(),
            },
            FileMimes::CPIO => Self {
                mime: "application/x-cpio".to_owned(),
                extension: "cpio".to_owned(),
            },
            FileMimes::HTML => Self {
                mime: "text/html".to_owned(),
                extension: "html".to_owned(),
            },
            FileMimes::XML => Self {
                mime: "text/xml".to_owned(),
                extension: "xml".to_owned(),
            },
            FileMimes::SH => Self {
                mime: "text/x-shellscript".to_owned(),
                extension: "sh".to_owned(),
            },
        }
    }
}

pub enum FileMimes {
    WASM,
    ELF,
    EXE,
    DLL,
    CLASS,
    BC,
    MACH,
    DEX,
    DEY,
    DER,
    OBJ,
    PEM,
    EPUB,
    MOBI,
    JPG,
    JP2,
    PNG,
    GIF,
    WEBP,
    CR2,
    TIF,
    BMP,
    JXR,
    PSD,
    ICO,
    HEIF,
    AVIF,
    JXL,
    ORA,
    DJVU,
    MP4,
    M4V,
    MKV,
    WEBM,
    MOV,
    AVI,
    WMV,
    MPG,
    FLV,
    MIDI,
    MP3,
    M4A,
    OPUS,
    OGG,
    FLAC,
    WAV,
    AMR,
    AAC,
    AIFF,
    DSF,
    APE,
    WOFF,
    WOFF2,
    TTF,
    OTF,
    DOC,
    DOCX,
    XLS,
    XLSX,
    PPT,
    PPTX,
    ODT,
    ODS,
    ODP,
    ZIP,
    TAR,
    PAR2,
    RAR,
    GZ,
    BZ2,
    BZ3,
    _7Z,
    XZ,
    PDF,
    SWF,
    RTF,
    EOT,
    PS,
    SQLITE,
    NES,
    CRX,
    CAB,
    DEB,
    AR,
    Z,
    LZ,
    RPM,
    DCM,
    ZST,
    LZ4,
    MSI,
    CPIO,
    HTML,
    XML,
    SH,
}
