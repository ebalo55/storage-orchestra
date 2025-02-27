import "./assets/tailwind.css";
import { localStorageColorSchemeManager, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { ContextMenuProvider } from "mantine-contextmenu";
import { useEffect } from "react";
import { NavigateFunction, Outlet, useNavigate } from "react-router";
import { ModalError } from "./components/modal-error.tsx";
import { useSimpleThemeContext } from "./hooks/use-theme.tsx";
import { VAULT_NAME } from "./utility/state.ts";

const modals = {
    error: ModalError,
};
declare module "@mantine/modals" {
    export interface MantineModalsOverride {
        modals: typeof modals;
    }
}

const colorSchemeManager = localStorageColorSchemeManager({
    key: "color-scheme",
});

export default function Layout() {
    const navigate = useNavigate();
    useEffect(() => {
        shouldOnboard(navigate);
    }, []);

    const {theme} = useSimpleThemeContext();

    return (
        <MantineProvider theme={ theme } colorSchemeManager={ colorSchemeManager } defaultColorScheme={ "light" }>
            <ContextMenuProvider shadow={ "lg" }>
                <ModalsProvider modals={ modals }>
                    <Outlet/>
                </ModalsProvider>
            </ContextMenuProvider>
        </MantineProvider>
    );
}

/**
 * Check if the user should be onboarded
 * @param navigate The navigate function
 */
async function shouldOnboard(navigate: NavigateFunction) {
    // Check if vault exists
    const vault_exists = await exists(VAULT_NAME, {baseDir: BaseDirectory.AppLocalData});

    // If vault does not exist, navigate to onboard page
    if (!vault_exists) {
        navigate("/onboard");
        return;
    }

    // If vault exists, navigate to login page
    navigate("/login");
}

