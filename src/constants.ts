import {
    IconBinary,
    IconFileText,
    IconFileTypeCsv,
    IconFileTypePdf,
    IconFileTypeTxt,
    IconFileZip,
    IconFolder,
    IconLink,
    IconLockPassword,
    IconMusic,
    IconPhotoScan,
    IconPresentation,
    IconProps,
    IconTableFilled,
} from "@tabler/icons-react";
import { ExoticComponent } from "react";

/**
 * The file upload chunk size
 * @type {number}
 */
export const FILE_UPLOAD_CHUNK_SIZE = 1024 ** 2; // 1 MiB

/**
 * The MIME types that represent a folder-like object
 */
export const FOLDER_LIKE_MIMES = [
    "application/vnd.google-apps.folder",
    "application/vnd.google-apps.shortcut",
];

/**
 * The MIME types that represent a document-like object
 */
export const DOCUMENT_LIKE_MIMES = [
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Mime types mapped to their respective icons, duplicate icons are allowed
 */
export const MAPPED_MIMES: {
    [key: string]: ExoticComponent<IconProps>
} = {
    "application/vnd.google-apps.folder":                                      IconFolder,
    "application/vnd.google-apps.shortcut":                                    IconLink,
    "application/vnd.google-apps.spreadsheet":                                 IconTableFilled,
    "application/vnd.google-apps.document":                                    IconFileText,
    "application/vnd.google-apps.presentation":                                IconPresentation,
    "audio/mpeg":                                                              IconMusic,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": IconFileText,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": IconTableFilled,
    "application/vnd.ms-excel.addin.macroenabled.12":                    IconTableFilled,
    "application/pdf":                                                         IconFileTypePdf,
    "application/x-zip-compressed":                                            IconFileZip,
    "application/zip":                                                         IconFileZip,
    "application/octet-stream":                                                IconBinary,
    "multipart/mixed":                                                   IconBinary,
    "text/csv":                                                          IconFileTypeCsv,
    "text/plain":                                                        IconFileTypeTxt,
    "image/png":                                                         IconPhotoScan,
    "image/jpeg":                                                        IconPhotoScan,
    "image/svg+xml":                                                     IconPhotoScan,
    "application/x-x509-ca-cert":                                        IconLockPassword,
};