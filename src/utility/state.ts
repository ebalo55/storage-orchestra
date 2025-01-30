import { invoke } from "@tauri-apps/api/core";

type JSONValue = string | number | boolean | null | object | any[];

const VAULT_NAME = "state.json";

class StateMarker {
    private constructor() {}

    /**
     * Create a string that when passed to the stronghold will be hashed
     * @param {string} value The value to hash
     * @returns {string}
     */
    public static asHash(value: string): string {
        return `hash:${value}`;
    }

    /**
     * Create a string that when passed to the stronghold will be encrypted
     * @param {string} value The value to encrypt
     * @returns {string}
     */
    public static asSecret(value: string): string {
        return `secret:${value}`;
    }

    /**
     * Create a string that when passed to the stronghold will be encoded as Base64
     * @param {string} value The value to encode
     * @returns {string}
     */
    public static asEncoded(value: string): string {
        return `encode:${value}`;
    }
}

class State {
    private static _instance: State | undefined;
    private constructor() {}

    /**
     * Get state instance
     * @param {string} password - The password to use for the state decryption
     * @returns {Promise<State>}
     */
    public static async init(password: string) {
        // Check if stronghold is already initialized
        if (State._instance) {
            return State._instance;
        }

        // Initialize state with password
        await invoke("init_state", { password });

        State._instance = new State();
        return State._instance;
    }

    /**
     * Insert a record into store
     * @param key The key of the record
     * @param data The value of the record
     * @returns Promise<void>
     */
    public async insert(key: string, data: JSONValue) {
        await invoke("insert_in_state", { key, data });
    }

    /**
     * Get a record from store
     * @param key - The key of the record to get
     * @returns Promise<string>
     */
    public async get<V = JSONValue>(key: string): Promise<V> {
        return await invoke("get_from_state", { key });
    }

    /**
     * Remove a record from store
     * @param key - The key of the record to remove
     * @returns Promise<void>
     */
    public async remove(key: string) {
        await invoke("remove_from_state", { key });
    }
}

export {
    StateMarker,
    State,
    VAULT_NAME
};