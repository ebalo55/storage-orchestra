import { modals } from "@mantine/modals";
import * as path from "@tauri-apps/api/path";
import { BaseDirectory, FileHandle, open, size } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { download } from "@tauri-apps/plugin-upload";
import querystring from "query-string";
import { OpenWithNativeAppModal } from "../components/open-with-native-app-modal.tsx";
import { FILE_UPLOAD_CHUNK_SIZE } from "../constants.ts";
import { DriveFile } from "../interfaces/drive-file.ts";
import { TrackableModalInfo } from "../interfaces/trackable-modal-info.ts";
import { ProviderData } from "../tauri-bindings.ts";
import { State } from "../utility/state.ts";
import { GoogleOAuth } from "./oauth/google.ts";

export interface GoogleFileListing {
    nextPageToken?: string;
    incompleteSearch: boolean;
    files: GoogleFile[];
}

export interface GoogleFile extends DriveFile {}

export interface ExtendedGoogleFile extends GoogleFile {
    size: number,
}

interface GoogleDriveDownloadResponse {
    name: string;
    metadata: {
        "@type": string;
    };
    done: boolean;
    response?: {
        "@type": string;
        downloadUri: string;
        partialDownloadAllowed: boolean;
    };
    error?: {
        code: number;
        message: string;
    };
}

const ERROR_LISTING: GoogleFileListing = {
    nextPageToken:    "",
    incompleteSearch: false,
    files:            [],
};

class GoogleProvider extends GoogleOAuth {
    protected constructor(providers: ProviderData[] = []) {
        super(providers);
    }

    public static async init(): Promise<GoogleProvider> {
        // Check if GoogleOAuth is already initialized
        if (GoogleProvider._instance) {
            return GoogleProvider._instance as GoogleProvider;
        }

        console.log("Initializing GoogleProvider...");

        // Load GoogleOAuthData records from stronghold
        const storage = await State.init("");

        let records = await storage.get("providers");
        if ("providers" in records) {
            // Create instance and return it
            GoogleProvider._instance = new GoogleProvider(
                records.providers.filter((provider) => provider.provider === "google"),
            );
            return GoogleProvider._instance as GoogleProvider;
        }

        throw new Error("No providers found in state");
    }

    public async listFiles(owner: string, folder: string = "root", page?: string): Promise<GoogleFileListing> {
        let provider = this._providers.find((provider) => provider.owner === owner);
        if (!provider) {
            return ERROR_LISTING;
        }

        provider = await this.refreshProviderIfStale(provider);
        if (!provider) {
            return ERROR_LISTING;
        }

        const access_token = await this.unpackAccessToken(provider);
        if (!access_token) {
            return ERROR_LISTING;
        }

        const url = "https://www.googleapis.com/drive/v3/files?";
        const response = await fetch(url + querystring.stringify({
            includeItemsFromAllDrives: true,
            supportsAllDrives:         true,
            orderBy:                   "folder,name_natural",
            pageSize:                  50,
            pageToken:                 page,
            corpora:                   "user",
            q:                         `trashed = false and '${ folder }' in parents`,
        }), {
            headers: {
                "Authorization": `Bearer ${ access_token }`,
            },
        });

        if (response.ok) {
            const result = await response.json();
            return result as GoogleFileListing;
        }
        else {
            console.error("Error fetching Google Drive files:", response.statusText);
            return ERROR_LISTING;
        }
    }

    public async getFile(owner: string, file: DriveFile): Promise<ExtendedGoogleFile | undefined> {
        let provider = this._providers.find((provider) => provider.owner === owner);
        if (!provider) {
            return;
        }

        provider = await this.refreshProviderIfStale(provider);
        if (!provider) {
            return;
        }

        const access_token = await this.unpackAccessToken(provider);
        if (!access_token) {
            return;
        }

        const url = `https://www.googleapis.com/drive/v3/files/${ file.id }?`;
        const response = await fetch(url + querystring.stringify({
            fields: "id, name, size, mimeType, kind",
        }), {
            headers: {
                "Authorization": `Bearer ${ access_token }`,
            },
        });

        if (response.ok) {
            return await response.json() as ExtendedGoogleFile;
        }
        else {
            console.error("Error fetching Google Drive file:", response.statusText);
        }
    }

    public async downloadFile(owner: string, file: DriveFile, modal: TrackableModalInfo): Promise<string | undefined> {
        let provider = this._providers.find((provider) => provider.owner === owner);
        if (!provider) {
            return;
        }

        provider = await this.refreshProviderIfStale(provider);
        if (!provider) {
            return;
        }

        const access_token = await this.unpackAccessToken(provider);
        if (!access_token) {
            return;
        }

        const url = `https://www.googleapis.com/drive/v3/files/${ file.id }/download`;
        const response = await fetch(url, {
            method:  "POST",
            headers: {
                "Authorization": `Bearer ${ access_token }`,
            },
        });

        if (response.ok) {
            let operation: GoogleDriveDownloadResponse = await response.json();
            const operation_url = `https://www.googleapis.com/drive/v3/operations/${ operation.name }`;
            const backoff = 1.5;
            const max_backoff = 60;
            const base_delay = 2;
            let calls = 0;

            while (!operation.done) {
                calls++;
                const delay = Math.min(base_delay * 1000 * calls * backoff, max_backoff * 1000);
                console.log(`Waiting ${ delay }ms before checking Google Drive operation status...`);

                // Wait before checking again
                await new Promise((resolve) => setTimeout(resolve, delay));
                console.log("Checking Google Drive operation status...");

                const op_refresh_response = await fetch(operation_url, {
                    headers: {
                        "Authorization": `Bearer ${ access_token }`,
                    },
                });

                if (op_refresh_response.ok) {
                    operation = await op_refresh_response.json();
                }
                else {
                    console.error("Error fetching Google Drive operation:", op_refresh_response.statusText);
                }
            }

            if (operation.error) {
                console.error("Error downloading Google Drive file:", operation.error.message);
                return;
            }

            let extension = "";
            switch (file.mimeType) {
                case "application/vnd.google-apps.document":
                    extension = ".docx";
                    break;
                case "application/vnd.google-apps.spreadsheet":
                    extension = ".xlsx";
                    break;
                case "application/vnd.google-apps.presentation":
                    extension = ".pptx";
                    break;
                case "application/vnd.google-apps.drawing":
                    extension = ".png";
                    break;
                default:
                    extension = "";
            }
            const download_path = await path.join(await path.tempDir(), file.name.concat(extension));

            const headers = new Map<string, string>();
            headers.set("Authorization", `Bearer ${ access_token }`);
            await download(
                operation.response!.downloadUri,
                download_path,
                ({progressTotal}) => {
                    modal.manual_override.path = download_path;
                    modals.updateModal({
                        modalId:  modal.id,
                        children: <OpenWithNativeAppModal { ...modal } progress={ {
                            total:   modal.progress.total,
                            current: progressTotal,
                        } }/>,
                    });
                },
                headers,
            );

            return download_path;
        }
        else {
            console.error("Error fetching Google Drive file:", response.statusText);
        }
    }

    /**
     * Uploads a file to Google Drive.
     * @param {string} owner - The owner of the provider.
     * @param {string} file_path - The path to the file to upload.
     * @param modal - The modal to update with progress.
     * @param {DriveFile} file -If provided, the file to update.
     * @returns {Promise<void>}
     */
    public async uploadFile(
        owner: string,
        file_path: string,
        modal: TrackableModalInfo,
        file?: DriveFile,
    ): Promise<void> {
        console.log({file_path, file});

        const provider = this._providers.find((provider) => provider.owner === owner);
        if (!provider) {
            return;
        }

        const access_token = await this.unpackAccessToken(provider);
        if (!access_token) {
            return;
        }

        const file_size = await size(file_path);

        modals.updateModal({
            modalId:  modal.id,
            children: <OpenWithNativeAppModal { ...modal } progress={ {
                total:   file_size,
                current: 0,
            } }/>,
        });

        // get the filename from the filepath in order to include the default extension
        const filename = file_path.replace(/\\/g, "/").split("/").pop()!;

        let url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
        let method = "POST";

        // if the file already exists, we will update it
        if (file) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${ file.id }?uploadType=resumable`;
            method = "PATCH";
        }

        // mime types are not always accurate (especially with derived types such as docx (aka zip with specialized
        // structure inside)), so we will use the file extension to determine the mime type
        const initial_request = await fetch(url, {
            method,
            headers: {
                "Authorization": `Bearer ${ access_token }`,
                "X-Upload-Content-Length": `${ file_size }`,
            },
            body:    file?.id ? undefined : JSON.stringify({
                name: filename,
            }),
        });

        if (!initial_request.ok) {
            console.error("Error initializing Google Drive upload:", initial_request.statusText);
            return;
        }

        // Get the location header
        const location = initial_request.headers.get("Location");
        if (!location) {
            console.error("Error fetching Google Drive upload location");
            return;
        }

        const file_handle = await open(filename, {read: true, baseDir: BaseDirectory.Temp});

        const full_chunks = Math.floor(file_size / FILE_UPLOAD_CHUNK_SIZE);
        const last_chunk = file_size % FILE_UPLOAD_CHUNK_SIZE;

        for (let i = 0; i < full_chunks; i++) {
            const range_upload_lower = i * FILE_UPLOAD_CHUNK_SIZE;
            const range_upload_upper = (
                                           i + 1
                                       ) * FILE_UPLOAD_CHUNK_SIZE - 1;

            let {range_lower, range_upper, completed} = await this.performUpload(
                file_handle,
                range_upload_lower,
                range_upload_upper,
                location,
                access_token,
                file_size,
            );

            while (!completed && range_upper !== range_upload_upper) {
                console.warn("Error uploading Google Drive file: Range mismatch, realigning...");
                const result = await this.performUpload(
                    file_handle,
                    range_lower,
                    range_upper,
                    location,
                    access_token,
                    file_size,
                );

                range_upper = result.range_upper;
            }

            modals.updateModal({
                modalId:  modal.id,
                children: <OpenWithNativeAppModal { ...modal } progress={ {
                    total:   file_size,
                    current: range_upload_upper + 1,
                } }/>,
            });
        }

        if (last_chunk > 0) {
            const range_upload_lower = full_chunks * FILE_UPLOAD_CHUNK_SIZE;
            const range_upload_upper = file_size;

            let {range_lower, range_upper, completed} = await this.performUpload(
                file_handle,
                range_upload_lower,
                range_upload_upper,
                location,
                access_token,
                file_size,
            );

            while (!completed && range_upper !== range_upload_upper) {
                console.warn("Error uploading Google Drive file: Range mismatch, realigning...");
                const result = await this.performUpload(
                    file_handle,
                    range_lower,
                    range_upper,
                    location,
                    access_token,
                    file_size,
                );

                range_lower = result.range_lower;
                range_upper = result.range_upper;
            }

            modals.updateModal({
                modalId:  modal.id,
                children: <OpenWithNativeAppModal { ...modal } progress={ {
                    total:   file_size,
                    current: file_size,
                } }/>,
            });
        }
    }

    private async performUpload(
        file_handle: FileHandle,
        range_lower: number,
        range_upper: number,
        location: string,
        access_token: string,
        file_size: number,
    ) {
        let correctional_factor = 1;
        if (range_upper === file_size) {
            correctional_factor = 0;
        }
        const chunk_size = range_upper - range_lower + correctional_factor;
        const buffer = new Uint8Array(chunk_size);
        await file_handle.read(buffer);

        // Google Drive uses 0-based indexing
        if (correctional_factor === 0) {
            range_upper -= 1;
        }

        const response = await fetch(location, {
            method:  "PUT",
            headers: {
                "Authorization":  `Bearer ${ access_token }`,
                "Content-Length": `${ chunk_size }`,
                "Content-Range":  `bytes ${ range_lower }-${ range_upper }/${ file_size }`,
            },
            body:    buffer,
        });

        if (response.status < 200 || response.status >= 400) {
            console.error("Error uploading Google Drive file:", response.statusText);
            throw new Error("Non recoverable error while uploading Google Drive file");
        }

        const range = response.headers.get("Range");
        console.log({range});

        let completed = false;
        if (correctional_factor === 0 && !range && response.ok) {
            completed = true;
        }
        else if (!range) {
            console.error("Error uploading Google Drive file:", response.statusText);
            return {range_lower: 0, range_upper: 0};
        }

        if (range) {
            const clean_range = range.replace("bytes=", "");
            range_lower = +clean_range.split("-")[0];
            range_upper = +clean_range.split("-")[1];
        }

        return {range_lower, range_upper, completed};
    }
}

export { GoogleProvider };
