// This file was generated by [tauri-specta](https://github.com/oscartbeaumont/tauri-specta). Do not edit this file
// manually.

/** user-defined commands **/


export const commands = {
    async startServer(): Promise<Result<number, string>> {
        try {
            return {status: "ok", data: await TAURI_INVOKE("start_server")};
        }
        catch (e) {
            if (e instanceof Error) {
                throw e;
            }
            else {
                return {status: "error", error: e as any};
            }
        }
    },
    /**
     * Sets the password for the application secure storage.
     *
     * # Arguments
     *
     * * `password` - The password to set.
     *
     * # Returns
     *
     * Nothing.
     */
    async initState(password: string): Promise<Result<null, string>> {
        try {
            return {status: "ok", data: await TAURI_INVOKE("init_state", {password})};
        }
        catch (e) {
            if (e instanceof Error) {
                throw e;
            }
            else {
                return {status: "error", error: e as any};
            }
        }
    },
    /**
     * Gets data from the state.
     *
     * # Arguments
     *
     * * `state` - The state to get the data from.
     * * `key` - The key to get the data from.
     *
     * # Returns
     *
     * The data as a JSON value.
     */
    async getFromState(key: AppStateInnerKeys): Promise<Result<AppStateInnerResult, string>> {
        try {
            return {status: "ok", data: await TAURI_INVOKE("get_from_state", {key})};
        }
        catch (e) {
            if (e instanceof Error) {
                throw e;
            }
            else {
                return {status: "error", error: e as any};
            }
        }
    },
    /**
     * Removes data from the state.
     *
     * # Arguments
     *
     * * `state` - The state to remove the data from.
     * * `key` - The key to remove the data from.
     *
     * # Returns
     *
     * Nothing.
     */
    async removeFromState(key: AppStateInnerKeys): Promise<Result<null, string>> {
        try {
            return {status: "ok", data: await TAURI_INVOKE("remove_from_state", {key})};
        }
        catch (e) {
            if (e instanceof Error) {
                throw e;
            }
            else {
                return {status: "error", error: e as any};
            }
        }
    },
    /**
     * Inserts data in the state.
     *
     * # Arguments
     *
     * * `state` - The state to insert the data in.
     * * `value` - The data to insert.
     *
     * # Returns
     *
     * Nothing.
     */
    async insertInState(value: AppStateInnerResult): Promise<Result<null, string>> {
        try {
            return {status: "ok", data: await TAURI_INVOKE("insert_in_state", {value})};
        }
        catch (e) {
            if (e instanceof Error) {
                throw e;
            }
            else {
                return {status: "error", error: e as any};
            }
        }
    },
    /**
     * Get the raw data as a string
     *
     * # Arguments
     *
     * * `state` - The state to get the data from
     * * `data` - The data to get
     *
     * # Returns
     *
     * The raw data as a string
     */
    async cryptDataGetRawDataAsString(data: CryptData): Promise<Result<string, string>> {
        try {
            return {status: "ok", data: await TAURI_INVOKE("crypt_data_get_raw_data_as_string", {data})};
        }
        catch (e) {
            if (e instanceof Error) {
                throw e;
            }
            else {
                return {status: "error", error: e as any};
            }
        }
    },
    /**
     * Get the raw data
     *
     * # Arguments
     *
     * * `state` - The state to get the data from
     * * `data` - The data to get
     *
     * # Returns
     *
     * The raw data
     */
    async cryptDataGetRawData(data: CryptData): Promise<Result<number[], string>> {
        try {
            return {status: "ok", data: await TAURI_INVOKE("crypt_data_get_raw_data", {data})};
        }
        catch (e) {
            if (e instanceof Error) {
                throw e;
            }
            else {
                return {status: "error", error: e as any};
            }
        }
    },
};

/** user-defined events **/


/** user-defined constants **/

export const STATE_FILE = "state.json" as const;

/** user-defined types **/

export type AppStateInnerKeys = "debounced_saver" | "password" | "providers"
export type AppStateInnerResult =
/**
 * The password to access the secure storage
 */
    {
        password: CryptData
    } |
    /**
     * The list of providers
     */
    {
        providers: ProviderData[]
    }
/**
 * Represent some data that have been managed cryptographically
 */
export type CryptData = {
    /**
     * The cryptographically modified data
     */
    data: number[];
    /**
     * The raw data, never stored on disk (this field is never serialized)
     */
    raw_data: number[] | null;
    /**
     * The working mode of the data
     */
    mode: number
}
/**
 * The data of a storage provider
 */
export type ProviderData = {
    /**
     * The access token
     */
    access_token: CryptData;
    /**
     * The refresh token
     */
    refresh_token: CryptData;
    /**
     * The expiry date of the token (utc unix timestamp)
     */
    expiry: bigint;
    /**
     * The owner of the token (email)
     */
    owner: string;
    /**
     * The provider of the token
     */
    provider: StorageProvider;
    /**
     * The salt used to derive the encryption key
     */
    salt: CryptData
}
export type StorageProvider = "unrecognized" | "google" | "dropbox" | "onedrive" | "terabox"

/** tauri-specta globals **/

import {invoke as TAURI_INVOKE} from "@tauri-apps/api/core";
import * as TAURI_API_EVENT from "@tauri-apps/api/event";
import {type WebviewWindow as __WebviewWindow__} from "@tauri-apps/api/webviewWindow";

type __EventObj__<T> = {
    listen: (
        cb: TAURI_API_EVENT.EventCallback<T>,
    ) => ReturnType<typeof TAURI_API_EVENT.listen<T>>;
    once: (
        cb: TAURI_API_EVENT.EventCallback<T>,
    ) => ReturnType<typeof TAURI_API_EVENT.once<T>>;
    emit: null extends T
          ? (payload?: T) => ReturnType<typeof TAURI_API_EVENT.emit>
          : (payload: T) => ReturnType<typeof TAURI_API_EVENT.emit>;
};

export type Result<T, E> =
    | {
          status: "ok";
          data: T
      }
    | {
          status: "error";
          error: E
      };

function __makeEvents__<T extends Record<string, any>>(
    mappings: Record<keyof T, string>,
) {
    return new Proxy(
        {} as unknown as {
            [K in keyof T]: __EventObj__<T[K]> & {
            (handle: __WebviewWindow__): __EventObj__<T[K]>;
        };
        },
        {
            get: (_, event) => {
                const name = mappings[event as keyof T];

                return new Proxy((
                    () => {}
                ) as any, {
                    apply: (_, __, [window]: [__WebviewWindow__]) => (
                        {
                            listen: (arg: any) => window.listen(name, arg),
                            once:   (arg: any) => window.once(name, arg),
                            emit:   (arg: any) => window.emit(name, arg),
                        }
                    ),
                    get:   (_, command: keyof __EventObj__<any>) => {
                        switch (command) {
                            case "listen":
                                return (arg: any) => TAURI_API_EVENT.listen(name, arg);
                            case "once":
                                return (arg: any) => TAURI_API_EVENT.once(name, arg);
                            case "emit":
                                return (arg: any) => TAURI_API_EVENT.emit(name, arg);
                        }
                    },
                });
            },
        },
    );
}
