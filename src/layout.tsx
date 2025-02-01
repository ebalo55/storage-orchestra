import "@mantine/core/styles.css";
import "./assets/tailwind.css";
import {
    createTheme,
    localStorageColorSchemeManager,
    MantineProvider,
} from "@mantine/core";
import {
    BaseDirectory,
    exists,
} from "@tauri-apps/plugin-fs";
import {useEffect} from "react";
import {
    NavigateFunction,
    Outlet,
    useNavigate,
} from "react-router";
import {VAULT_NAME} from "./utility/state.ts";

const theme = createTheme({}),
    colorSchemeManager = localStorageColorSchemeManager({
        key: "color-scheme",
    });
export default function Layout() {
    const navigate = useNavigate();
    useEffect(() => {
        shouldOnboard(navigate);
    }, []);

    return (
        <MantineProvider theme={theme} colorSchemeManager={colorSchemeManager} defaultColorScheme={"light"}>
            <Outlet/>
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

