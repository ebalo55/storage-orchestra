import {
    useEffect,
    useState,
} from "react";
import {useNavigate} from "react-router";
import {
    commands,
    ProviderData,
} from "../tauri-bindings.ts";

/**
 * Fetches the providers from the state and returns them, sorted by provider name.
 * If an error occurs, the user is navigated to the settings providers page.
 * @returns {ProviderData[]}
 */
export function useProviders() {
    const navigate = useNavigate();
    const [providers, setProviders] = useState<ProviderData[]>([]);

    useEffect(() => {
        commands.getFromState("providers").then((providers) => {
            if (providers.status === "error") {
                console.error(providers.error);

                // navigate to the settings providers page, as something went wrong
                navigate("/dashboard/settings?page=providers");
                return;
            }

            if ("providers" in providers.data) {
                setProviders(providers.data.providers.sort((a, b) => a.owner.localeCompare(b.provider)));
            }
        });
    }, []);

    return providers;
}