import { cancel, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import { fetch } from "@tauri-apps/plugin-http";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import querystring from "query-string";
import { dayjs } from "./dayjs.ts";
import { IProviderData } from "./provider-data.interface.ts";
import { State } from "./state.ts";

let instance: GoogleOAuth | undefined;

class GoogleOAuth {
    private _port: number = 0;

    private constructor(private _providers: IProviderData[]) {}

    /**
     * Get GoogleOAuth providers
     * @returns {IProviderData[]}
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
        let records = await storage.get("google_drive");
        if (records.length === 0) {
            records = "[]";
        }
        const providers: IProviderData[] = JSON.parse(records);

        // Create GoogleOAuth instance and return it
        instance = new GoogleOAuth(providers);
        return instance;
    }

    /**
     * Start the GoogleOAuth server
     * @returns {Promise<void>}
     */
    public async start() {
        try {
            this._port = await start();
            console.log(`GoogleOAuth server started on port ${ this._port }`);

            // Set up listeners for OAuth results
            await onUrl((url) => this.receive(url));

            const url = "https://accounts.google.com/o/oauth2/v2/auth?";

            await openUrl(url + querystring.stringify({
                scope:         "https://www.googleapis.com/auth/drive email",
                response_type: "code",
                redirect_uri:  `http://127.0.0.1:${ this._port }`,
                client_id:     "243418232258-pi0e0sa9g3ol72c212hg7k496g51k765.apps.googleusercontent.com",
            }));
        }
        catch (error) {
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
        }
        catch (error) {
            console.error("Error stopping GoogleOAuth server:", error);
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
            body:  error_description,
        });
    }

    /**
     * Refresh OAuth token
     * @param {IProviderData} data - The provider data to refresh
     * @returns {Promise<void>}
     */
    public async refresh(data: IProviderData) {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method:  "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body:    querystring.stringify({
                refresh_token: data.refresh_token,
                client_id:     "243418232258-pi0e0sa9g3ol72c212hg7k496g51k765.apps.googleusercontent.com",
                client_secret: "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",
                grant_type:    "refresh_token",
            }),
        });

        if (response.ok) {
            const json = await response.json();

            const now = dayjs.utc().unix();
            const expiry = now + json.expires_in;
            const owner = data.owner;
            const new_data = {
                access_token:  json.access_token,
                refresh_token: data.refresh_token,
                expiry,
                owner,
                provider: "google",
            } as IProviderData;

            // Update record
            const index = this._providers.findIndex((provider) => provider.owner === owner);
            this._providers[index] = new_data;

            const storage = await State.init("");
            await storage.insert("google_drive", JSON.stringify(this._providers));
        }
        else {
            console.error("Error refreshing OAuth token:", response.statusText);
        }
    }

    /**
     * Handle OAuth success
     * @param {string} code
     * @returns {Promise<void>}
     * @private
     */
    private async handleOAuthSuccess(code: string) {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method:  "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body:    querystring.stringify({
                code,
                client_id:     "243418232258-pi0e0sa9g3ol72c212hg7k496g51k765.apps.googleusercontent.com",
                client_secret: "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",
                redirect_uri:  `http://127.0.0.1:${ this._port }`,
                grant_type:    "authorization_code",
            }),
        });

        if (response.ok) {
            const json = await response.json();

            const now = dayjs.utc().unix();
            const expiry = now + json.expires_in;
            const owner = JSON.parse(atob(json.id_token.split(".")[1])).email as string;
            const data = {
                access_token:  json.access_token,
                refresh_token: json.refresh_token,
                expiry,
                owner,
                provider: "google",
            } as IProviderData;

            // Add new record
            this._providers.push(data);

            const storage = await State.init("");
            await storage.insert("google_drive", JSON.stringify(this._providers));
        }
        else {
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

export { GoogleOAuth };
