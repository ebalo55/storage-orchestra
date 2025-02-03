import { Result, Settings } from "../tauri-bindings.ts";

/**
 * Compute the default page to redirect to after login.
 * @param {Result<Settings, string>} settings
 * @returns {string}
 */
export function computeDefaultPage(settings: Result<Settings, string>): string {
    if (settings.status === "error") {
        return "/error?message=" + encodeURIComponent(settings.error);
    }

    const default_page = settings.data.general_behaviour.default_page;

    if ("general" in default_page) {
        switch (default_page.general) {
            case "dashboard":
                return "/dashboard";
            case "all_my_drives":
                return "/dashboard/drives";
            case "settings":
                return "/dashboard/settings";
        }
    }
    else {
        return `/dashboard/drives/${ default_page.providers.provider }/${ default_page.providers.owner }`;
    }
}