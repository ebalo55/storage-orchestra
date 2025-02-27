import { FileWithPath } from "@mantine/dropzone";
import { modals } from "@mantine/modals";
import { fetch } from "@tauri-apps/plugin-http";
import { Dispatch, SetStateAction } from "react";
import { ModalOpenWithNativeApp } from "../components/modal-open-with-native-app.tsx";
import { ExtendedGoogleFile } from "../providers/google-provider.tsx";
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
     * Upload a list of files to a drive
     * @param {string} owner - The owner of the provider to use
     * @param {FileWithPath} file - The file to upload
     * @param setUploadedFiles - The state setter for the number of uploaded files (used for progress tracking)
     * @param folder - The folder to upload the file to
     * @returns {Promise<void>}
     */
    public abstract uploadFiles(
        owner: string,
        file: FileWithPath,
        setUploadedFiles: Dispatch<SetStateAction<number>>,
        folder: string,
    ): Promise<void>;

    /**
     * Download a file from a drive and returns its storage path on disk
     * @param {string} owner - The owner of the provider to use
     * @param {DriveFile} file - The file to download
     * @param {TrackableModalInfo} modal - The modal id to use for progress tracking
     * @param {string} save_path - The path to save the file to, if not provided, a temporary path is used
     * @returns {Promise<string | undefined>}
     */
    public abstract downloadFile(
        owner: string,
        file: DriveFile,
        modal: TrackableModalInfo,
        save_path?: string,
    ): Promise<string | undefined>;

    /**
     * Get extended file information
     * @param {string} owner
     * @param {DriveFile} file
     * @returns {Promise<ExtendedGoogleFile | undefined>}
     */
    public abstract getFile(owner: string, file: DriveFile): Promise<DriveFile | undefined>;

    /**
     * Creates a folder in the remote drive.
     * @param {string} owner - The owner of the provider.
     * @param {string} parent - The parent folder to create the new folder in, or the root folder if not provided.
     * @param {string} folder_name - The name of the new folder.
     * @returns {Promise<DriveFile | undefined>}
     */
    public abstract createFolder(owner: string, parent: string, folder_name: string): Promise<DriveFile | undefined>;

    /**
     * Uploads a file to the remote drive upon native app closing.
     * @param {string} owner - The owner of the provider.
     * @param {string} file_path - The path to the file to upload.
     * @param {TrackableModalInfo | undefined} modal - The modal to update with progress.
     * @param {DriveFile | undefined} file - If provided, the file to update.
     * @returns {Promise<void>}
     */
    public abstract updateFile(
        owner: string,
        file_path: string,
        modal?: TrackableModalInfo,
        file?: DriveFile,
    ): Promise<void>;

    /**
     * List files in a drive folder
     * @param owner - The owner of the provider to use
     * @param folder - The folder to list files from
     * @param page - The page token to use
     */
    public abstract listFiles(owner: string, folder: string, page?: string): Promise<unknown>;

    /**
     * Get the instance of the provider and access token, refreshing if necessary
     * @param {string} owner - The owner of the provider to get
     * @protected
     */
    protected async getValidProvider(
        owner: string,
    ): Promise<
        {
            provider: ProviderData;
            accessToken: string
        } | null
    > {
        let provider = this._providers.find((p) => p.owner === owner);
        if (!provider) {
            return null;
        }

        provider = await this.refreshProviderIfStale(provider);
        if (!provider) {
            return null;
        }

        const accessToken = await this.unpackAccessToken(provider);

        return accessToken ? {provider, accessToken} : null;
    }

    /**
     * Reads a file in chunks and calls a callback for each chunk.
     * @param {File} file - The file to read.
     * @param {number} chunkSize - The size of each chunk.
     * @param {(chunk: ArrayBuffer, offset: number) => Promise<void>} onChunkRead - The callback to call for each chunk.
     */
    protected async readFileInChunks(
        file: File,
        chunkSize: number,
        onChunkRead: (chunk: ArrayBuffer, offset: number) => Promise<void>,
    ) {
        let offset = 0;

        while (offset < file.size) {
            const chunk = file.slice(offset, offset + chunkSize);
            const arrayBuffer = await chunk.arrayBuffer();
            await onChunkRead(arrayBuffer, offset);
            offset += chunkSize;
        }
    }

    /**
     * Get the path fragments of a given path
     * @param {string} path - The path to split
     * @protected
     */
    protected makePathFragments(path: string): {
        folders: string[],
        file: string
    } {
        const folders = path.split("/").filter((f) => f.length > 0);
        const file = folders.pop() || "";
        return {folders, file};
    }

    /**
     * Creates a fetch request with the given access token, forwarding all other options
     * @param {string} url - The URL to fetch
     * @param {string} accessToken - The access token to use
     * @param {RequestInit} options - The fetch options
     * @returns {Promise<Response>}
     * @protected
     */
    protected async authorizedFetch(
        url: string,
        accessToken: string,
        options?: RequestInit,
    ): Promise<Response> {
        const headers = new Headers(options?.headers || {});
        headers.set("Authorization", `Bearer ${ accessToken }`);

        return await fetch(url, {...options, headers});
    }

    /**
     * Update the progress of a modal if it exists
     * @param {number} total - The total number of items
     * @param {number} current - The current item
     * @param {TrackableModalInfo} modal - The modal to update
     * @protected
     */
    protected updateModalProgress(
        total: number,
        current: number,
        modal?: TrackableModalInfo,
    ): void {
        if (!modal) {
            return;
        }

        const Component = modal.element ?? ModalOpenWithNativeApp;

        modals.updateModal({
            modalId: modal.id,
            children: <Component { ...modal } progress={ {total, current} }/>,
        });
    }

    /**
     * Wait for a given number of milliseconds
     * @param {number} ms - The number of milliseconds to wait
     * @protected
     */
    protected async wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

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