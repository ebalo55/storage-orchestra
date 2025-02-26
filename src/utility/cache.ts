export class Cache<K, V> {
    protected readonly _cache: Map<K, V> = new Map<K, V>();

    /**
     * Get a value from the cache
     * @template K - The key type
     * @template V - The value type
     * @param {K} key - The key to get
     * @returns {V | undefined}
     */
    public get(key: K): V | null {
        return this._cache.get(key) ?? null;
    }

    /**
     * Set a value in the cache. If the key already exists, this does nothing.
     * @template K - The key type
     * @template V - The value type
     * @param {K} key - The key to set
     * @param {V} value - The value to set
     */
    public set(key: K, value: V): void {
        if (!this._cache.has(key)) {
            this._cache.set(key, value);
        }
    }

    /**
     * Delete a value from the cache
     * @template K - The key type
     * @template V - The value type
     * @param {K} key - The key to delete
     */
    public delete(key: K): void {
        this._cache.delete(key);
    }

    /**
     * Clear the cache
     */
    public clear(): void {
        this._cache.clear();
    }

    /**
     * Get the size of the cache
     * @returns {number}
     */
    public size(): number {
        return this._cache.size;
    }

    /**
     * Check if the cache has a key
     * @template K - The key type
     * @template V - The value type
     * @param {K} key - The key to check
     * @returns {boolean}
     */
    public has(key: K): boolean {
        return this._cache.has(key);
    }

    /**
     * Get all keys in the cache
     * @template K - The key type
     * @returns {K[]}
     */
    public keys(): K[] {
        return Array.from(this._cache.keys());
    }

    /**
     * Get all values in the cache
     * @template V - The value type
     * @returns {V[]}
     */
    public values(): V[] {
        return Array.from(this._cache.values());
    }

    /**
     * Get all entries in the cache
     * @template K - The key type
     * @template V - The value type
     * @returns {[K, V][]}
     */
    public entries(): [ K, V ][] {
        return Array.from(this._cache.entries());
    }

    /**
     * Iterate over the cache
     * @template K - The key type
     * @template V - The value type
     * @param {(value: V, key: K, cache: Cache<K, V>) => void} callback - The callback to call for each entry
     */
    public forEach(callback: (value: V, key: K, cache: Map<K, V>) => void): void {
        this._cache.forEach(callback);
    }

    /**
     * Get the cache as a map
     * @template K - The key type
     * @template V - The value type
     * @returns {Map<K, V>}
     */
    public asMap(): Map<K, V> {
        return this._cache;
    }

    /**
     * Update a value in the cache. If the key does not exist, this does nothing.
     * @template K - The key type
     * @template V - The value type
     * @param {K} key - The key
     * @param {V} value - The value
     */
    public update(key: K, value: V): void {
        if (this._cache.has(key)) {
            this._cache.set(key, value);
        }
    }

    /**
     * Upsert a value in the cache. If the key does not exist, it will be created.
     * @template K - The key type
     * @template V - The value type
     * @param {K} key - The key
     * @param {V} value - The value
     */
    public upsert(key: K, value: V): void {
        this._cache.set(key, value);
    }

    /**
     * Get a value from the cache or set it if it does not exist
     * @template K - The key type
     * @template V - The value type
     * @param {K} key - The key
     * @param {V} value - The value
     * @returns {V}
     */
    public getOrSet(key: K, value: V): V {
        const val = this.get(key);
        if (val !== null) {
            return val;
        }

        this.set(key, value);
        return value;
    }
}

export class DualSidedCache<K> extends Cache<K, K> {
    protected readonly _reverse: Map<K, K> = new Map<K, K>();

    public get(key: K): K | null {
        if (this._cache.has(key)) {
            return this._cache.get(key) ?? null;
        }
        return this._reverse.get(key) ?? null;
    }

    public set(key: K, value: K): void {
        if (!this._cache.has(key)) {
            this._cache.set(key, value);
        }

        if (!this._reverse.has(value)) {
            this._reverse.set(value, key);
        }
    }

    public delete(key: K): void {
        if (this._cache.has(key)) {
            this._cache.delete(key);
        }

        if (this._reverse.has(key)) {
            this._reverse.delete(key);
        }
    }

    public clear(): void {
        this._cache.clear();
        this._reverse.clear();
    }

    public size(): number {
        return this._cache.size + this._reverse.size;
    }

    public has(key: K): boolean {
        return this._cache.has(key) || this._reverse.has(key);
    }

    public keys(): K[] {
        return Array.from(new Set([ ...this._cache.keys(), ...this._reverse.keys() ]));
    }

    public values(): K[] {
        return this.keys();
    }

    public entries(): [ K, K ][] {
        return Array.from(new Set([ ...this._cache.entries(), ...this._reverse.entries() ]));
    }

    public forEach(callback: (value: K, key: K, cache: Map<K, K>) => void): void {
        this._cache.forEach(callback);
        this._reverse.forEach(callback);
    }

    public asMap(): Map<K, K> {
        return new Map([ ...this._cache.entries(), ...this._reverse.entries() ]);
    }

    public update(key: K, value: K): void {
        if (this._cache.has(key)) {
            this._cache.set(key, value);
        }

        if (this._reverse.has(value)) {
            this._reverse.set(value, key);
        }
    }

    public upsert(key: K, value: K): void {
        this._cache.set(key, value);
        this._reverse.set(value, key);
    }

    public getOrSet(key: K, value: K): K {
        const val = this.get(key);
        if (val !== null) {
            return val;
        }

        this.set(key, value);
        return value;
    }
}