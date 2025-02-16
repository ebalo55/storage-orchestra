import { commands, ProviderData } from "../tauri-bindings.ts";
import { dayjs } from "../utility/dayjs.ts";

export abstract class OAuthProvider {
    protected _port: number = 0;

    /**
     * Whether the provider is currently authenticating
     * @returns {boolean}
     */
    public get is_authenticating(): boolean {
        return this._port !== 0;
    }

    /**
     * Start the OAuth server
     * @returns {Promise<void>}
     */
    public abstract start(): Promise<void>;

    /**
     * Stop the OAuth server
     * @returns {Promise<void>}
     */
    public abstract stop(): Promise<void>;

    /**
     * Refresh the provider data
     * @param {ProviderData} data - The provider data to refresh
     * @returns {Promise<ProviderData | undefined>}
     */
    public abstract refresh(data: ProviderData): Promise<ProviderData | undefined>;

    /**
     * Refresh a provider if it is stale
     * @param {ProviderData} provider - The provider to refresh
     * @returns {Promise<ProviderData | undefined>}
     */
    protected async refreshProviderIfStale(provider: ProviderData): Promise<ProviderData | undefined> {
        const now = dayjs.utc().unix();

        // If the provider is expired, refresh it
        if (provider.expiry <= now) {
            const updated_provider = await this.refresh(provider);

            if (updated_provider) {
                console.log("Successfully refreshed OAuth token for provider", provider.owner);
                return updated_provider;
            }
            else {
                console.error("Failed to refresh OAuth token for provider", provider.owner);
                return;
            }
        }

        // Otherwise, return the provider as-is
        return provider;
    }

    /**
     * Unpack the access token from a provider
     * @param {ProviderData} provider
     * @returns {Promise<string | undefined>}
     */
    protected async unpackAccessToken(provider: ProviderData): Promise<string | undefined> {
        const access_token = await commands.cryptDataGetRawDataAsString(provider.access_token);
        if (access_token.status === "error") {
            console.error("Failed to decrypt OAuth access token for provider", provider.owner);
            return;
        }

        return access_token.data;
    }

    /**
     * Handle OAuth errors
     * @param {string} error - The error that occurred
     * @returns {Promise<void>}
     * @private
     */
    protected abstract handleOAuthError(error: string): Promise<void>;

    /**
     * Handle OAuth success
     * @param {string} code
     * @returns {Promise<void>}
     * @private
     */
    protected abstract handleOAuthSuccess(code: string): Promise<void>;

    /**
     * Receive OAuth URL
     * @param {string} url
     * @returns {Promise<void>}
     * @private
     */
    protected abstract receive(url: string): Promise<void>;
}