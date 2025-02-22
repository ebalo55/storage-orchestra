import { ProviderData, StorageProvider } from "../tauri-bindings.ts";
import { State } from "../utility/state.ts";
import { DriveFile } from "./drive-file.ts";
import { OAuthProvider } from "./oauth-provider.ts";
import { TrackableModalInfo } from "./trackable-modal-info.ts";

export abstract class Provider extends OAuthProvider {
    protected static _instance?: Provider;

    protected constructor(protected _provider_name: StorageProvider, protected _providers: ProviderData[] = []) {
        super();
    }

    /**
     * Get GoogleOAuth providers
     * @returns {ProviderData[]}
     */
    public get providers(): ProviderData[] {
        return this._providers;
    }

    /**
     * Initialize the storage provider
     * @returns {Promise<Provider>}
     */
    public static async init(): Promise<Provider> {
        throw new Error("Not implemented");
    }

    /**
     * Drop a provider by owner
     * @param {string} owner - The owner of the provider to drop
     */
    public dropProvider(owner: string) {
        this._providers = this._providers.filter((provider) => provider.owner !== owner);
    }

    /**
     * Download a file from a drive and returns its storage path on disk
     * @param {string} owner - The owner of the provider to use
     * @param {DriveFile} file - The file to download
     * @param {TrackableModalInfo} modal - The modal id to use for progress tracking
     * @returns {Promise<string | undefined>}
     */
    public abstract downloadFile(
        owner: string,
        file: DriveFile,
        modal: TrackableModalInfo,
    ): Promise<string | undefined>;

    /**
     * List files in a drive folder
     * @param owner - The owner of the provider to use
     * @param folder - The folder to list files from
     * @param page - The page token to use
     */
    public abstract listFiles(owner: string, folder: string, page?: string): Promise<unknown>;

    /**
     * Replace all providers with the currently loaded ones
     * @returns {Promise<void>}
     */
    protected async replaceAllProviders(): Promise<void> {
        // get all providers
        const storage = await State.init("");
        const all_providers = await storage.get("providers");

        if ("providers" in all_providers) {
            // Remove all non-internal providers and add the new providers
            const non_internal_providers = all_providers.providers.filter((provider) => provider.provider !==
                                                                                        this._provider_name);
            await storage.insert({providers: [ ...non_internal_providers, ...this._providers ]});
        }
    }
}