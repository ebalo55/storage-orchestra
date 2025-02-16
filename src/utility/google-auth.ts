import {cancel, onUrl, start} from "@fabianlars/tauri-plugin-oauth";
import {fetch} from "@tauri-apps/plugin-http";
import {sendNotification} from "@tauri-apps/plugin-notification";
import {openUrl} from "@tauri-apps/plugin-opener";
import querystring from "query-string";
import {commands, ProviderData} from "../tauri-bindings.ts";
import {dayjs} from "./dayjs.ts";
import {State, StateMarker} from "./state.ts";
import {download} from "@tauri-apps/plugin-upload";
import {BaseDirectory} from "@tauri-apps/plugin-fs";
import * as path from '@tauri-apps/api/path';
import {formatByteSize} from "./format-bytesize.ts";


export interface GoogleFileListing {
    nextPageToken?: string;
    incompleteSearch: boolean;
    files: GoogleFile[];
}

export interface GoogleFile {
    id: string;
    name: string;
    mimeType: string;
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
    nextPageToken: "",
    incompleteSearch: false,
    files: [],
};

let instance: GoogleOAuth | undefined;

class GoogleOAuth {
    private _port: number = 0;

    private constructor(private _providers: ProviderData[]) {
    }

    /**
     * Get GoogleOAuth providers
     * @returns {ProviderData[]}
     */
    public get providers() {
        return this._providers;
    }

    public get is_authenticating() {
        return this._port !== 0;
    }

    /**
     * Initialize GoogleOAuth
     * @returns {Promise<GoogleOAuth>}
     */
    public static async init() {
        // Check if GoogleOAuth is already initialized
        if (instance) {
            return instance;
        }

        // Load GoogleOAuthData records from stronghold
        const storage = await State.init("");

        let records = await storage.get("providers");
        if ("providers" in records) {
            // Create GoogleOAuth instance and return it
            instance = new GoogleOAuth(records.providers.filter((provider) => provider.provider === "google"));
            return instance;
        }

        throw new Error("No providers found in stronghold");
    }

    /**
     * List files in a Google Drive folder
     * @param owner - The owner of the provider to use
     * @param page - The page token to use
     * @param folder - The folder to list files from
     */
    public async listFiles(owner: string, page?: string, folder: string = "root"): Promise<GoogleFileListing> {
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
            supportsAllDrives: true,
            orderBy: "folder,name_natural",
            pageSize: 50,
            pageToken: page,
            corpora: "user",
            q: `trashed = false and '${folder}' in parents`,
        }), {
            headers: {
                "Authorization": `Bearer ${access_token}`,
            },
        });

        if (response.ok) {
            const result = await response.json();
            return result as GoogleFileListing;
        } else {
            console.error("Error fetching Google Drive files:", response.statusText);
            return ERROR_LISTING;
        }
    }

    public async downloadFile(owner: string, file: GoogleFile) {
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

        const url = `https://www.googleapis.com/drive/v3/files/${file.id}/download`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${access_token}`,
            },
        });

        if (response.ok) {
            let operation: GoogleDriveDownloadResponse = await response.json();
            const operation_url = `https://www.googleapis.com/drive/v3/operations/${operation.name}`;
            const backoff = 1.5;
            const max_backoff = 60;
            const base_delay = 2;
            let calls = 0;

            while (!operation.done) {
                calls++;
                const delay = Math.min(base_delay * 1000 * calls * backoff, max_backoff * 1000);
                console.log(`Waiting ${delay}ms before checking Google Drive operation status...`);

                // Wait before checking again
                await new Promise((resolve) => setTimeout(resolve, delay));
                console.log("Checking Google Drive operation status...");

                const op_refresh_response = await fetch(operation_url, {
                    headers: {
                        "Authorization": `Bearer ${access_token}`,
                    },
                });

                if (op_refresh_response.ok) {
                    operation = await op_refresh_response.json();
                } else {
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
            headers.set("Authorization", `Bearer ${access_token}`);
            await download(
                operation.response!.downloadUri,
                download_path,
                ({ total, progressTotal }) =>
                    console.log(`Downloaded ${formatByteSize(BigInt(progressTotal))} of ${total === 0 ? "Unknown" : total} bytes`), // a callback that will be called with the download progress
                headers
            );

            return download_path;
        } else {
            console.error("Error fetching Google Drive file:", response.statusText);
        }
    }

    /**
     * Drop a provider by owner
     * @param {string} owner - The owner of the provider to drop
     */
    public dropProvider(owner: string) {
        this._providers = this._providers.filter((provider) => provider.owner !== owner);
    }

    /**
     * Start the GoogleOAuth server
     * @returns {Promise<void>}
     */
    public async start() {
        try {
            this._port = await start();
            console.log(`GoogleOAuth server started on port ${this._port}`);

            // Set up listeners for OAuth results
            await onUrl((url) => this.receive(url));

            const url = "https://accounts.google.com/o/oauth2/v2/auth?";

            await openUrl(url + querystring.stringify({
                scope: "https://www.googleapis.com/auth/drive email",
                response_type: "code",
                redirect_uri: `http://127.0.0.1:${this._port}`,
                client_id: "243418232258-pi0e0sa9g3ol72c212hg7k496g51k765.apps.googleusercontent.com",
            }));
        } catch (error) {
            console.error("Error starting GoogleOAuth server:", error);
            await this.stop();
        }
    }

    /**
     * Stop the GoogleOAuth server
     * @returns {Promise<void>}
     */
    public async stop() {
        const port = this._port;
        this._port = 0;
        try {
            await cancel(port);
            console.log("GoogleOAuth server stopped");
        } catch (error) {
            console.error("Error stopping GoogleOAuth server:", error);
        }
    }

    /**
     * Refresh OAuth token
     * @param {ProviderData} data - The provider data to refresh
     * @returns {Promise<void>}
     */
    public async refresh(data: ProviderData) {
        const refresh_token = await commands.cryptDataGetRawDataAsString(data.refresh_token);

        if (refresh_token.status === "error") {
            console.error("Error fetching refresh token:", refresh_token.error);
            return;
        }

        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: querystring.stringify({
                refresh_token: refresh_token.data,
                client_id: "243418232258-pi0e0sa9g3ol72c212hg7k496g51k765.apps.googleusercontent.com",
                client_secret: "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",
                grant_type: "refresh_token",
            }),
        });

        if (response.ok) {
            const json = await response.json();

            const now = dayjs.utc().unix();
            const expiry = now + json.expires_in;
            const owner = data.owner;

            // Encrypt access token
            const access_token = await commands.makeCryptDataFromQualifiedString(StateMarker.asSecret(json.access_token as string));
            if (access_token.status === "error") {
                console.error("Error encrypting access token:", access_token.error);
                return;
            }

            const new_data = {
                access_token: access_token.data,
                refresh_token: data.refresh_token,
                expiry,
                owner,
                provider: "google",
            } as ProviderData;

            // Update record
            const index = this._providers.findIndex((provider) => provider.owner === owner);
            this._providers[index] = new_data;

            await this.replaceAllGoogleProviders();

            return new_data;
        } else {
            console.error("Error refreshing OAuth token:", response.statusText);
        }
    }

    /**
     * Refresh a provider if it is stale
     * @param {ProviderData} provider - The provider to refresh
     * @returns {Promise<ProviderData>}
     * @private
     */
    private async refreshProviderIfStale(provider: ProviderData) {
        const now = dayjs.utc().unix();

        if (provider.expiry <= now) {
            const updated_provider = await this.refresh(provider);
            if (updated_provider) {
                console.log("Successfully refreshed Google OAuth token for provider", provider.owner);
                return updated_provider;
            } else {
                console.error("Failed to refresh Google OAuth token for provider", provider.owner);
                return;
            }
        }

        return provider;
    }

    /**
     * Unpack the access token from a provider
     * @param {ProviderData} provider
     * @returns {Promise<string>}
     * @private
     */
    private async unpackAccessToken(provider: ProviderData) {
        const access_token = await commands.cryptDataGetRawDataAsString(provider.access_token);
        if (access_token.status === "error") {
            console.error("Failed to decrypt Google OAuth access token for provider", provider.owner);
            return;
        }

        return access_token.data;
    }

    /**
     * Replace all Google providers with the current providers
     * @returns {Promise<void>}
     * @private
     */
    private async replaceAllGoogleProviders() {
        // get all providers
        const storage = await State.init("");
        const all_providers = await storage.get("providers");

        if ("providers" in all_providers) {
            // Remove all non-google providers and add the new providers
            const non_google_providers = all_providers.providers.filter((provider) => provider.provider !== "google");
            await storage.insert({providers: [...non_google_providers, ...this._providers]});
        }
    }

    /**
     * Handle OAuth errors
     * @param {string} error - The error that occurred
     * @returns {Promise<void>}
     * @private
     */
    private async handleOAuthError(error: string) {
        console.error("Error during OAuth flow:", error);

        let error_description = "An error occurred during the OAuth flow";
        if (error === "access_denied") {
            error_description = "Access to the OAuth flow was denied by the user";
        }

        sendNotification({
            title: "Error during Google Drive connection",
            body: error_description,
        });
    }

    /**
     * Handle OAuth success
     * @param {string} code
     * @returns {Promise<void>}
     * @private
     */
    private async handleOAuthSuccess(code: string) {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: querystring.stringify({
                code,
                client_id: "243418232258-pi0e0sa9g3ol72c212hg7k496g51k765.apps.googleusercontent.com",
                client_secret: "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",
                redirect_uri: `http://127.0.0.1:${this._port}`,
                grant_type: "authorization_code",
            }),
        });

        if (response.ok) {
            const json = await response.json();

            const now = dayjs.utc().unix();
            const expiry = now + json.expires_in;
            const owner = JSON.parse(atob(json.id_token.split(".")[1])).email as string;

            // Encrypt access token
            const access_token = await commands.makeCryptDataFromQualifiedString(StateMarker.asSecret(json.access_token as string));
            if (access_token.status === "error") {
                console.error("Error encrypting access token:", access_token.error);
                return;
            }

            // Encrypt refresh token
            const refresh_token = await commands.makeCryptDataFromQualifiedString(StateMarker.asSecret(json.refresh_token as string));
            if (refresh_token.status === "error") {
                console.error("Error encrypting refresh token:", refresh_token.error);
                return;
            }

            const data = {
                access_token: access_token.data,
                refresh_token: refresh_token.data,
                expiry,
                owner,
                provider: "google",
            } as ProviderData;

            // Add new record
            this._providers.push(data);

            await this.replaceAllGoogleProviders();
        } else {
            console.error("Error fetching OAuth token:", response.statusText);
        }
    }

    /**
     * Receive OAuth URL
     * @param {string} url
     * @returns {Promise<void>}
     * @private
     */
    private async receive(url: string) {
        console.log("Received OAuth URL:", url);

        const parsable_url = new URL(url);
        const code = parsable_url.searchParams.get("code");
        const error = parsable_url.searchParams.get("error");

        // Check for errors
        if (error) {
            await this.handleOAuthError(error);
        }
        // Check for code
        else if (code) {
            await this.handleOAuthSuccess(code);
        }

        await this.stop();
    }
}

export {GoogleOAuth};
