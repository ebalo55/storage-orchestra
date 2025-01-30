export interface IProviderData {
    /**
     * The access token
     */
    access_token: string;
    /**
     * The refresh token
     */
    refresh_token: string;
    /**
     * The expiry date of the token (utc unix timestamp)
     */
    expiry: number;
    /**
     * The owner of the token (email)
     */
    owner: string;
    /**
     * The provider of the token
     */
    provider: "google"
}