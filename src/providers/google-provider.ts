import * as path from "@tauri-apps/api/path";
import { fetch } from "@tauri-apps/plugin-http";
import { download } from "@tauri-apps/plugin-upload";
import querystring from "query-string";
import { DriveFile } from "../interfaces/drive-file.ts";
import { ProviderData } from "../tauri-bindings.ts";
import { formatByteSize } from "../utility/format-bytesize.ts";
import { State } from "../utility/state.ts";
import { GoogleOAuth } from "./oauth/google.ts";


export interface GoogleFileListing {
    nextPageToken?: string;
    incompleteSearch: boolean;
    files: GoogleFile[];
}

export interface GoogleFile extends DriveFile {}

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
    private constructor(providers: ProviderData[] = []) {
        super(providers);
    }

    public static async init(): Promise<GoogleProvider> {
        // Check if GoogleOAuth is already initialized
        if (super._instance) {
            return super._instance as GoogleProvider;
        }

        // Load GoogleOAuthData records from stronghold
        const storage = await State.init("");

        let records = await storage.get("providers");
        if ("providers" in records) {
            // Create instance and return it
            super._instance = new GoogleProvider(records.providers.filter((provider) => provider.provider ===
                                                                                        "google"));
            return super._instance as GoogleProvider;
        }

        throw new Error("No providers found in stronghold");
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

    public async downloadFile(owner: string, file: DriveFile): Promise<string | undefined> {
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
                ({total, progressTotal}) =>
                    console.log(
                        `Downloaded ${ formatByteSize(BigInt(progressTotal)) } of ${ total === 0
                                                                                     ? "Unknown"
                                                                                     : total } bytes`,
                    ),
                headers,
            );

            return download_path;
        }
        else {
            console.error("Error fetching Google Drive file:", response.statusText);
        }
    }
}

export { GoogleProvider };
