import {
    AppStateInnerKeys,
    AppStateInnerResult,
    commands,
    STATE_FILE,
} from "../tauri-bindings.ts";

const VAULT_NAME = STATE_FILE;

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
     * @throws {Error}
     */
    public static async init(password: string): Promise<State> {
        // Check if stronghold is already initialized
        if (State._instance) {
            return State._instance;
        }

        if (!password) {
            throw new Error("Password is required to initialize state");
        }

        // Initialize state with password
        const result = await commands.initState(password);

        // If an error occurred, throw it
        if (result.status === "error") {
            throw new Error(result.error);
        }

        State._instance = new State();
        return State._instance;
    }

    /**
     * Insert a record into store
     * @param value The value of the record
     * @returns Promise<void>
     * @throws {Error}
     */
    public async insert(value: AppStateInnerResult) {
        const result = await commands.insertInState(value);

        if (result.status === "error") {
            throw new Error(result.error);
        }
    }

    /**
     * Get a record from store
     * @param key - The key of the record to get
     * @returns Promise<string>
     */
    public async get(key: AppStateInnerKeys): Promise<AppStateInnerResult> {
        const result = await commands.getFromState(key);

        if (result.status === "error") {
            throw new Error(result.error);
        }

        return result.data;
    }

    /**
     * Remove a record from store
     * @param key - The key of the record to remove
     * @returns Promise<void>
     */
    public async remove(key: AppStateInnerKeys) {
        const result = await commands.removeFromState(key);

        if (result.status === "error") {
            throw new Error(result.error);
        }
    }
}

export {
    StateMarker,
    State,
    VAULT_NAME,
};