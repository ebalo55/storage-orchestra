import {NavigateFunction} from "react-router";
import {commands} from "../tauri-bindings.ts";

/**
 * Ensure the user is authenticated
 * @param redirect The redirect function
 * @returns {Promise<boolean>}
 */
export async function ensureIsAuthenticated(redirect?: NavigateFunction) {
    const is_authenticated = await commands.isAuthenticated();

    // If the user is not authenticated, redirect to login page
    if (!is_authenticated) {
        // If redirect is not set, return false
        if (redirect) {
            redirect("/login");
        }

        return false;
    }

    // If redirect is set (and user is authenticated), redirect to dashboard
    if (redirect) {
        redirect("/dashboard");
    }

    return true;
}