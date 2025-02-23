import { useSignals } from "@preact/signals-react/runtime";
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { NavigateFunction, useNavigate } from "react-router";
import { commands, Settings } from "../tauri-bindings.ts";

function makeRefreshSettings(
    navigate: NavigateFunction,
    setSettings: Dispatch<SetStateAction<Settings | undefined>>,
    setIsLoadingSettings: Dispatch<SetStateAction<boolean>>,
) {
    return async () => {
        setIsLoadingSettings(true);
        const loaded_settings = await commands.loadSettings();

        if (loaded_settings.status === "error") {
            setIsLoadingSettings(false);
            console.error(loaded_settings.error);
            navigate(`/error?message=${ encodeURIComponent(loaded_settings.error) }`);
            return;
        }

        setIsLoadingSettings(false);
        setSettings(loaded_settings.data);
    };
}

/**
 * Fetches the settings from the state and returns them.
 * If an error occurs, the user is navigated to the error page.
 */
export function useSettings() {
    useSignals();
    const [ settings, setSettings ] = useState<Settings>();
    const [ is_loading_settings, setIsLoadingSettings ] = useState(false);
    const navigate = useNavigate();
    const refreshSettings = useCallback(makeRefreshSettings(navigate, setSettings, setIsLoadingSettings), []);

    useEffect(() => {
        if (!settings && !is_loading_settings) {
            setIsLoadingSettings(true);
            refreshSettings().then(() => {
                setIsLoadingSettings(false);
                console.log("Settings loaded");
            });
        }
    }, []);

    return {settings, refreshSettings};
}