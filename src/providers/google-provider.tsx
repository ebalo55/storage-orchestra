import { FileWithPath } from "@mantine/dropzone";
import * as path from "@tauri-apps/api/path";
import { BaseDirectory, FileHandle, open, size } from "@tauri-apps/plugin-fs";
import { download } from "@tauri-apps/plugin-upload";
import { Dispatch, SetStateAction } from "react";
import { FILE_UPLOAD_CHUNK_SIZE } from "../constants.ts";
import { DriveFile } from "../interfaces/drive-file.ts";
import { TrackableModalInfo } from "../interfaces/trackable-modal-info.ts";
import { ProviderData } from "../tauri-bindings.ts";
import { DualSidedCache } from "../utility/cache.ts";
import { State } from "../utility/state.ts";
import { GoogleOAuth } from "./oauth/google.ts";

export interface GoogleFileListing {
    nextPageToken?: string;
    incompleteSearch: boolean;
    files: GoogleFile[];
}

export interface GoogleFile extends DriveFile {}

// parents, thumbnailLink, shared, lastModifyingUser, owners, sharingUser, createdTime, modifiedTime
export interface ExtendedGoogleFile extends GoogleFile {
    size?: number,
    parents: string[],
    thumbnailLink: string,
    shared: boolean,
    lastModifyingUser: {
        displayName: string,
        photoLink: string,
        emailAddress: string,
        me: boolean,
    },
    owners: {
        displayName: string,
        photoLink: string,
        emailAddress: string,
        me: boolean,
    }[],
    sharingUser: {
        displayName: string,
        photoLink: string,
        emailAddress: string,
        me: boolean,
    },
    createdTime: string,
    modifiedTime: string,
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
    private _cached_folders = new DualSidedCache<string>();

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
        const valid = await this.getValidProvider(owner);
        if (!valid) {
            return ERROR_LISTING;
        }
        const {accessToken} = valid;

        const url = `https://www.googleapis.com/drive/v3/files?${ new URLSearchParams({
            includeItemsFromAllDrives: "true",
            supportsAllDrives:         "true",
            orderBy:                   "folder,name_natural",
            pageSize:                  "50",
            pageToken:                 page ?? "",
            corpora:                   "user",
            q:                         `trashed = false and '${ folder }' in parents`,
        }) }`;
        const response = await this.authorizedFetch(url, accessToken);

        if (response.ok) {
            return (
                await response.json()
            ) as GoogleFileListing;
        }
        else {
            console.error("Error fetching Google Drive files:", response.statusText);
            return ERROR_LISTING;
        }
    }

    public async getFile(owner: string, file: DriveFile): Promise<ExtendedGoogleFile | undefined> {
        const valid = await this.getValidProvider(owner);
        if (!valid) {
            return;
        }
        const {accessToken} = valid;

        const url = `https://www.googleapis.com/drive/v3/files/${ file.id }?${ new URLSearchParams({
            fields: "id, name, size, mimeType, kind, parents, thumbnailLink, shared, lastModifyingUser, owners, sharingUser, createdTime, modifiedTime",
        }) }`;
        const response = await this.authorizedFetch(url, accessToken);

        if (response.ok) {
            return (
                await response.json()
            ) as ExtendedGoogleFile;
        }
        else {
            console.error("Error fetching Google Drive file:", response.statusText);
        }
    }

    public async downloadFile(
        owner: string,
        file: DriveFile,
        modal: TrackableModalInfo,
        save_path?: string,
    ): Promise<string | undefined> {
        const valid = await this.getValidProvider(owner);
        if (!valid) {
            return;
        }
        const {accessToken} = valid;

        const url = `https://www.googleapis.com/drive/v3/files/${ file.id }/download`;
        const response = await this.authorizedFetch(url, accessToken, {method: "POST"});

        if (response.ok) {
            let operation: GoogleDriveDownloadResponse = await response.json();
            operation = await this.waitForOperation(operation, accessToken);

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

            if (!save_path) {
                save_path = await path.tempDir();
            }
            const download_path = await path.join(save_path, file.name.concat(extension));

            const headers = new Map<string, string>();
            headers.set("Authorization", `Bearer ${ accessToken }`);
            await download(
                operation.response!.downloadUri,
                download_path,
                ({progressTotal}) => {
                    modal.manual_override.path = download_path;
                    this.updateModalProgress(modal.progress.total, progressTotal, modal);
                },
                headers,
            );

            return download_path;
        }
        else {
            console.error("Error fetching Google Drive file:", response.statusText);
        }
    }

    public async uploadFiles(
        owner: string,
        file: FileWithPath,
        setUploadedFiles: Dispatch<SetStateAction<number>>,
        folder: string = "root",
    ): Promise<void> {
        console.log({file});

        const valid = await this.getValidProvider(owner);
        if (!valid) {
            return;
        }
        const {accessToken} = valid;

        // Extract path fragments and filename
        const {file: filename, folders: path_folders} = this.makePathFragments(file.path!);

        // Search for folders along the file path
        const folders = await this.searchFilesDeeply(accessToken, folder, path_folders);
        console.log("folders before loop", {folders});
        console.log("path_folders before loop", {path_folders});

        // if folders are empty none of the folders in the path exist, otherwise, the last folder in the path is the
        // parent folder, if it exists we will upload the file to it creating all other necessary folders
        while (folders.length < path_folders.length) {
            // create the missing folder(s)
            const index = folders.length;
            const folder_name = path_folders[index];
            const parent_folder = folders[index - 1] as GoogleFile | undefined;

            const new_folder = await this.mkdir(accessToken, parent_folder?.id ?? folder, folder_name);
            folders.push(new_folder);
        }
        console.log("folders after loop", {folders});
        console.log("path_folders after loop", {path_folders});

        const immediate_parent = folders[folders.length - 1]?.id ?? folder;

        // Check if the file already exists
        const folders_with_file = await this.searchFilesDeeply(
            accessToken,
            immediate_parent,
            [ filename ],
        );
        console.log({folders_with_file});

        let location: string | null = null;
        if (folders_with_file.length > 0) {
            // Update the file
            location = await this.makeUploadUrl(
                accessToken,
                folders_with_file.at(-1).id,
                undefined,
                undefined,
                undefined,
            );
        }
        else {
            // Create the file
            location = await this.makeUploadUrl(accessToken, undefined, undefined, filename, immediate_parent);
        }

        if (!location) {
            throw new Error("Error creating upload URL");
        }

        await this.readFileInChunks(file, FILE_UPLOAD_CHUNK_SIZE, async (chunk, offset) => {
            const range_upload_upper = offset + chunk.byteLength - 1;
            let {completed, range_upper, range_lower} = await this.uploadToGoogleDrive(
                new Uint8Array(chunk),
                offset,
                range_upload_upper,
                file.size,
                location,
                accessToken,
            );

            while (!completed && range_upper !== range_upload_upper) {
                console.warn("Error uploading Google Drive file: Range mismatch, realigning...");
                const result = await this.uploadToGoogleDrive(
                    new Uint8Array(chunk.slice(range_upper + 1 - offset)),
                    range_upper + 1,
                    range_upload_upper,
                    file.size,
                    location,
                    accessToken,
                );

                range_upper = result.range_upper;
            }

            console.log({range_lower, range_upper});
        });
        setUploadedFiles((prev) => prev + 1);
    }

    /**
     * Uploads a file to Google Drive.
     * @param {string} owner - The owner of the provider.
     * @param {string} file_path - The path to the file to upload.
     * @param modal - The modal to update with progress.
     * @param {DriveFile} file - If provided, the file to update.
     * @returns {Promise<void>}
     */
    public async updateFile(
        owner: string,
        file_path: string,
        modal?: TrackableModalInfo,
        file?: DriveFile,
    ): Promise<void> {
        console.log({file_path, file});

        const valid = await this.getValidProvider(owner);
        if (!valid) {
            return;
        }
        const {accessToken} = valid;

        const file_size = await size(file_path);
        this.updateModalProgress(0, file_size, modal);

        // get the filename from the filepath in order to include the default extension
        const filename = file_path.replace(/\\/g, "/").split("/").pop()!;


        // mime types are not always accurate (especially with derived types such as docx (aka zip with specialized
        // structure inside)), so we will use the file extension to determine the mime type
        const location = await this.makeUploadUrl(accessToken, file?.id, undefined, filename, undefined);
        if (!location) {
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
                accessToken,
                file_size,
            );

            while (!completed && range_upper !== range_upload_upper) {
                console.warn("Error uploading Google Drive file: Range mismatch, realigning...");
                const result = await this.performUpload(
                    file_handle,
                    range_lower,
                    range_upper,
                    location,
                    accessToken,
                    file_size,
                );

                range_upper = result.range_upper;
            }

            this.updateModalProgress(range_upload_upper + 1, file_size, modal);
        }

        if (last_chunk > 0) {
            const range_upload_lower = full_chunks * FILE_UPLOAD_CHUNK_SIZE;
            const range_upload_upper = file_size;

            let {range_lower, range_upper, completed} = await this.performUpload(
                file_handle,
                range_upload_lower,
                range_upload_upper,
                location,
                accessToken,
                file_size,
            );

            while (!completed && range_upper !== range_upload_upper) {
                console.warn("Error uploading Google Drive file: Range mismatch, realigning...");
                const result = await this.performUpload(
                    file_handle,
                    range_lower,
                    range_upper,
                    location,
                    accessToken,
                    file_size,
                );

                range_lower = result.range_lower;
                range_upper = result.range_upper;
            }

            this.updateModalProgress(file_size, file_size, modal);
        }
    }

    public async createFolder(owner: string, parent: string, folder_name: string): Promise<DriveFile | undefined> {
        const valid = await this.getValidProvider(owner);
        if (!valid) {
            return;
        }
        const {accessToken} = valid;

        return await this.mkdir(accessToken, parent, folder_name);
    }

    /**
     * Generates an upload URL for Google Drive. Based on the presence of the ID, the method will either create a new
     * file or update an existing one.
     * @param {string} accessToken - The access token to use for the upload.
     * @param {string} id - The ID of the file to update.
     * @param {string} mime - The MIME type of the file to upload.
     * @param {string} filename - The name of the file to upload.
     * @param {string} parent - The parent folder of the file to upload.
     * @private
     */
    private async makeUploadUrl(
        accessToken: string,
        id?: string,
        mime?: string,
        filename?: string,
        parent?: string,
    ): Promise<string | null> {
        const response = await this.authorizedFetch(
            `https://www.googleapis.com/upload/drive/v3/files${ id ? `/${ id }` : "" }?uploadType=resumable`,
            accessToken,
            {
                method: id ? "PATCH" : "POST",
                body:   JSON.stringify({
                    mimeType: mime,
                    name:     filename,
                    parents:  parent ? [ parent ] : undefined,
                }),
            },
        );

        if (!response.ok) {
            console.error("Error initializing Google Drive upload:", response.statusText);
            return null;
        }

        const location = response.headers.get("Location");
        if (!location) {
            console.error("Error fetching Google Drive upload location");
            return null;
        }

        return location;
    }

    /**
     * Helper that waits until a Google Drive operation is done.
     */
    private async waitForOperation(
        operation: GoogleDriveDownloadResponse,
        accessToken: string,
    ): Promise<GoogleDriveDownloadResponse> {
        const operationUrl = `https://www.googleapis.com/drive/v3/operations/${ operation.name }`;
        const backoff = 1.5;
        const max_backoff = 60;
        const base_delay = 2;
        let calls = 0;

        while (!operation.done) {
            calls++;

            const delay = Math.min(base_delay * 1000 * calls * backoff, max_backoff * 1000);
            console.log(`Waiting ${ delay }ms before checking operation status...`);

            await this.wait(delay);
            console.log("Checking operation status...");

            const opResponse = await this.authorizedFetch(operationUrl, accessToken);
            if (opResponse.ok) {
                operation = await opResponse.json();
            }
            else {
                console.error("Error fetching operation:", opResponse.statusText);
                break;
            }
        }

        return operation;
    }

    /**
     * Searches for files in Google Drive recursively.
     * @param {string} accessToken - The access token to use for the search.
     * @param {string} parentFolderId - The ID of the parent folder to search in.
     * @param {string[]} folders - The folders to search for.
     * @returns {Promise<any[]>}
     * @private
     */
    private async searchFilesDeeply(
        accessToken: string,
        parentFolderId: string,
        folders: string[],
    ): Promise<any[]> {
        let allFiles: any[] = [];
        const folders_clone = [ ...folders ];
        const _this = this;
        let iteration = 0;

        async function searchFolder(folderId: string) {
            iteration++;
            const query = folders_clone.shift();
            if (!query) {
                return;
            }

            const full_path = folders.slice(0, iteration).join("/");

            // Check if the folder is already cached
            const cached_value = _this._cached_folders.get(full_path);
            if (cached_value) {
                allFiles.push({id: cached_value});
                await searchFolder(cached_value);
                return;
            }

            const url = `https://www.googleapis.com/drive/v3/files?${ new URLSearchParams({
                q:                         `'${ folderId }' in parents and trashed = false and name = '${ query }'`,
                fields:                    "files(id, name, mimeType, parents)",
                pageSize:                  "10",
                supportsAllDrives:         "true",
                includeItemsFromAllDrives: "true",
            }) }`;

            const response = await _this.authorizedFetch(url, accessToken);

            if (!response.ok) {
                throw new Error(`Failed to fetch files: ${ response.statusText }`);
            }

            const data = await response.json();
            allFiles.push(...data.files);

            // Recursively search subfolders
            for (const file of data.files) {
                if (file.mimeType === "application/vnd.google-apps.folder") {
                    _this._cached_folders.set(`${ full_path }/${ file.name }`, file.id);
                    await searchFolder(file.id);
                }
            }
        }

        await searchFolder(parentFolderId);
        console.log({cache: this._cached_folders.entries()});
        return allFiles;
    }

    /**
     * Creates a folder in Google Drive.
     * @param {string} access_token - The access token to use for the upload.
     * @param {string} parent_folder - The parent folder to create the new folder in.
     * @param {string} folder_name - The name of the new folder.
     * @private
     */
    private async mkdir(
        access_token: string,
        parent_folder: string,
        folder_name: string,
    ): Promise<DriveFile | undefined> {
        const response = await this.authorizedFetch("https://www.googleapis.com/drive/v3/files", access_token, {
            method:  "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body:    JSON.stringify({
                name:     folder_name,
                mimeType: "application/vnd.google-apps.folder",
                parents:  [ parent_folder ],
            }),
        });

        if (!response.ok) {
            console.error("Error creating Google Drive folder:", response.statusText);
            return;
        }

        const result = await response.json();

        // Update the cache with the double lookup values of the just created folder
        const parent = this._cached_folders.get(parent_folder);
        let full_path = "";
        if (parent) {
            full_path = `${ parent }/${ folder_name }`;
        }
        else {
            full_path = folder_name;
        }
        this._cached_folders.set(full_path, result.id);

        console.log({cache: Array.from(this._cached_folders.entries())});

        return result as DriveFile;
    }

    /**
     * Perform the actual upload of a file to Google Drive.
     * @param {Uint8Array} data - The data to upload.
     * @param {number} range_lower - The lower range of the file to upload.
     * @param {number} range_upper - The upper range of the file to upload.
     * @param {number} file_size - The size of the file to upload.
     * @param {string} location - The location to upload the file to.
     * @param {string} access_token - The access token to use for the upload.
     * @private
     */
    private async uploadToGoogleDrive(
        data: Uint8Array,
        range_lower: number,
        range_upper: number,
        file_size: number,
        location: string,
        access_token: string,
    ) {
        const response = await this.authorizedFetch(location, access_token, {
            method:  "PUT",
            headers: {
                "Content-Length": `${ data.byteLength }`,
                "Content-Range":  `bytes ${ range_lower }-${ range_upper }/${ file_size }`,
            },
            body:    data,
        });

        if (!response.ok) {
            console.error("Error uploading Google Drive file:", response.statusText);
            throw new Error("Non recoverable error while uploading Google Drive file");
        }

        const range = response.headers.get("Range");
        console.log({range});

        let completed = response.ok;
        if (!range && !response.ok) {
            console.error("Error uploading Google Drive file, missing range: ", response.statusText);
            throw new Error("Non recoverable error while uploading Google Drive file");
        }

        if (range) {
            [ range_lower, range_upper ] = range
                .replace("bytes=", "")
                .split("-")
                .map(Number);
        }

        return {range_lower, range_upper, completed};
    }

    /**
     * Performs the upload of a file to Google Drive.
     * @param {FileHandle} file_handle - The file handle to read from.
     * @param {number} range_lower - The lower range of the file to upload.
     * @param {number} range_upper - The upper range of the file to upload.
     * @param {string} location - The location to upload the file to.
     * @param {string} access_token - The access token to use for the upload.
     * @param {number} file_size - The size of the file to upload.
     * @private
     */
    private async performUpload(
        file_handle: FileHandle,
        range_lower: number,
        range_upper: number,
        location: string,
        access_token: string,
        file_size: number,
    ) {
        // Determine if this is the final chunk (adjust the range accordingly)
        const correctional_factor = range_upper === file_size ? 0 : 1;
        const chunk_size = range_upper - range_lower + correctional_factor;
        const buffer = new Uint8Array(chunk_size);
        await file_handle.read(buffer);

        // Google Drive uses 0-based indexing
        if (correctional_factor === 0) {
            range_upper -= 1;
        }

        return await this.uploadToGoogleDrive(buffer, range_lower, range_upper, file_size, location, access_token);
    }
}

export { GoogleProvider };
