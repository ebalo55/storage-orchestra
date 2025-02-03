import { NavigateFunction } from "react-router";
import { ThemeContextType } from "../hooks/use-theme.tsx";
import { commands } from "../tauri-bindings.ts";
import { computeDefaultPage } from "./compute-default-page.ts";
import { loadTheme } from "./load-theme.ts";

/**
 * Ensure the user is authenticated
 * @param redirect The redirect function
 * @returns {Promise<boolean>}
 */
export async function ensureIsAuthenticated(
    redirect?: NavigateFunction,
    theme_ctx?: ThemeContextType,
): Promise<boolean> {
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
        const settings = await commands.loadSettings();

        if (theme_ctx) {
            loadTheme(theme_ctx, settings);
        }

        redirect(computeDefaultPage(settings));
    }

    return true;
}