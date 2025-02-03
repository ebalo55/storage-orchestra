import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { commands, Settings } from "../tauri-bindings.ts";

/**
 * Fetches the settings from the state and returns them.
 * If an error occurs, the user is navigated to the error page.
 * @returns {{settings: Settings | undefined, refreshSettings: () => Promise<void>}}
 */
export function useSettings() {
    const navigate = useNavigate();
    const [ settings, setSettings ] = useState<Settings>();

    const refreshSettings = useCallback(async () => {
        const settings = await commands.loadSettings();

        if (settings.status === "error") {
            console.error(settings.error);
            navigate(`/error?message=${ encodeURIComponent(settings.error) }`);
            return;
        }

        setSettings(settings.data);
    }, []);

    useEffect(() => {
        refreshSettings().then(() => console.log("Settings loaded"));
    }, []);

    return {settings, refreshSettings};
}