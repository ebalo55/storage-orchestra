import { cancel, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import { fetch } from "@tauri-apps/plugin-http";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import querystring from "query-string";
import { Provider } from "../../interfaces/storage-provider.tsx";
import { commands, ProviderData } from "../../tauri-bindings.ts";
import { dayjs } from "../../utility/dayjs.ts";
import { StateMarker } from "../../utility/state.ts";

export abstract class GoogleOAuth extends Provider {
    protected constructor(providers: ProviderData[] = []) {
        super("google", providers);
    }

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

    public async refresh(data: ProviderData) {
        const refresh_token = await commands.cryptDataGetRawDataAsString(data.refresh_token);

        if (refresh_token.status === "error") {
            console.error("Error fetching refresh token:", refresh_token.error);
            return;
        }

        const response = await fetch("https://oauth2.googleapis.com/token", {
            method:  "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body:    querystring.stringify({
                refresh_token: refresh_token.data,
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

            // Encrypt access token
            const access_token = await commands.makeCryptDataFromQualifiedString(StateMarker.asSecret(json.access_token as string));
            if (access_token.status === "error") {
                console.error("Error encrypting access token:", access_token.error);
                return;
            }

            const new_data = {
                access_token:  access_token.data,
                refresh_token: data.refresh_token,
                expiry,
                owner,
                provider:      "google",
            } as ProviderData;

            // Update record
            const index = this._providers.findIndex((provider) => provider.owner === owner);
            this._providers[index] = new_data;

            await this.replaceAllProviders();

            return new_data;
        }
        else {
            console.error("Error refreshing OAuth token:", response.statusText);
        }
    }

    protected async handleOAuthError(error: string) {
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

    protected async handleOAuthSuccess(code: string) {
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
                access_token:  access_token.data,
                refresh_token: refresh_token.data,
                expiry,
                owner,
                provider:      "google",
            } as ProviderData;

            // Add new record
            this._providers.push(data);

            await this.replaceAllProviders();
        }
        else {
            console.error("Error fetching OAuth token:", response.statusText);
        }
    }

    protected async receive(url: string) {
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