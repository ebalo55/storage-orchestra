import {
    ComboboxData,
    Select,
    Skeleton,
} from "@mantine/core";
import {title} from "radash";
import {
    FC,
    useMemo,
    useRef,
} from "react";
import {useProviders} from "../../../../hooks/use-providers.ts";
import {
    DefaultPageGeneralGroup,
    DefaultPageGroups,
    Settings,
    SettingsResult,
    StorageProvider,
} from "../../../../tauri-bindings.ts";
import {SettingRow} from "../../setting-row.tsx";

interface DefaultPageProps {
    settings?: Settings;
    updateSettings: (updated_value: SettingsResult, refreshSettings: () => Promise<void>) => Promise<void>;
    refreshSettings: () => Promise<void>;
}

/**
 * Convert a page group to a dropdown value
 * @param {DefaultPageGroups} page_group
 * @returns {string}
 */
function pageGroupToDropdownValue(page_group: DefaultPageGroups): string {
    if ("general" in page_group) {
        return page_group.general;
    }

    return `${ page_group.providers.provider }-${ page_group.providers.owner }`;
}

async function handleOnChange(
    value: string | null,
    settings: Settings,
    updateSettings: (
        updated_value: SettingsResult,
        refreshSettings: () => Promise<void>,
    ) => Promise<void>,
    refreshSettings: () => Promise<void>,
) {
    if (!value) {
        return;
    }

    const default_general_groups = [
        "dashboard",
        "all_my_drives",
        "settings",
    ] as DefaultPageGeneralGroup[];

    // if the value is a general group, update the general group value
    if (default_general_groups.includes(value as any)) {
        await updateSettings(
            {
                general_behaviour: {
                    ...settings?.general_behaviour,
                    default_page: {
                        general: value as DefaultPageGeneralGroup,
                    },
                },
            },
            refreshSettings,
        );
    }
    else {
        const [ provider, owner ] = (
            value as string
        ).split("-");

        await updateSettings(
            {
                general_behaviour: {
                    ...settings?.general_behaviour,
                    default_page: {
                        providers: {
                            provider: provider as StorageProvider,
                            owner,
                        },
                    },
                },
            },
            refreshSettings,
        );
    }
    console.log("Settings update");
}

export const DefaultPage: FC<DefaultPageProps> = ({settings, updateSettings, refreshSettings}) => {
    const providers = useProviders();
    const default_page_options = useMemo(() => {
        return [
            {
                group: "General",
                items: [
                    {
                        label: "Dashboard",
                        value: "dashboard" as DefaultPageGeneralGroup,
                    },
                    {
                        label: "All my drives",
                        value: "all_my_drives" as DefaultPageGeneralGroup,
                    },
                    {
                        label: "Settings",
                        value: "settings" as DefaultPageGeneralGroup,
                    },
                ],
            },
            {
                group: "Providers",
                items: providers.map((provider, i) => (
                    {
                        label: `${ title(provider.provider) } - ${ provider.owner }`,
                        value: `${ provider.provider }-${ provider.owner }`,
                    }
                )),
            },
        ] as ComboboxData;
    }, [ providers ]);

    const ref = useRef(null);

    return (
        <SettingRow title={ "Default page" }
                    description={ "The page that you want to be redirected to when you log in" }
                    target={ ref }>
            {
                !settings && <Skeleton height={ 40 }
                                       animate
                                       maw={ "24rem" }
                                       ml={ "auto" }/>
            }
            {
                settings && (
                             <Select
                                 ref={ ref }
                                 placeholder={ "Default page" }
                                 data={ default_page_options }
                                 ml={ "auto" }
                                 maw={ "24rem" }
                                 searchable
                                 maxDropdownHeight={ 200 }
                                 value={ pageGroupToDropdownValue(settings.general_behaviour.default_page) }
                                 onChange={ (value) => handleOnChange(value, settings, updateSettings, refreshSettings) }
                             />
                         )
            }
        </SettingRow>
    );
};