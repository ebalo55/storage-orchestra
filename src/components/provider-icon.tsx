import {IconServer} from "@tabler/icons-react";
import {StorageProvider} from "../tauri-bindings.ts";
import {IconDropbox} from "./icon-dropbox.tsx";
import {IconGoogle} from "./icon-google.tsx";
import {IconMicrosoft} from "./icon-microsoft.tsx";
import {IconTerabox} from "./icon-terabox.tsx";

export const ProviderIcon = ({provider}: {
    provider: StorageProvider
}) => {
    switch (provider) {
        case "google":
            return <IconGoogle width={20} height={20}/>;
        case "onedrive":
            return <IconMicrosoft width={20} height={20}/>;
        case "dropbox":
            return <IconDropbox width={20} height={20}/>;
        case "terabox":
            return <IconTerabox width={20} height={20}/>;
        default:
            return <IconServer width={20} height={20}/>;
    }
};