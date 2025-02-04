import { MultiSelect, Skeleton, Text } from "@mantine/core";
import { title, unique } from "radash";
import { FC, useMemo, useRef } from "react";
import { useProviders } from "../../../../hooks/use-providers.ts";
import { DefaultPageGroups, Settings, SettingsResult, StorageProvider } from "../../../../tauri-bindings.ts";
import { SettingRow } from "../../setting-row.tsx";

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
    value: string[],
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

    const available_providers = [
        "dropbox",
        "google",
        "onedrive",
        "terabox",
    ] as StorageProvider[];

    if (value.length === 0) {
        await updateSettings(
            {
                general_behaviour: {
                    ...settings?.general_behaviour,
                    compress_files: {},
                },
            },
            refreshSettings,
        );
        console.log("Settings update");

        return;
    }

    const compress_files = {} as Partial<{ [key in StorageProvider]: boolean }>;

    for (let elem of value) {
        // if the value is a storage provider, update the compress_files value
        if (available_providers.includes(elem as any)) {
            compress_files[elem as StorageProvider] = true;
        }
    }

    // update the settings
    await updateSettings(
        {
            general_behaviour: {
                ...settings?.general_behaviour,
                compress_files,
            },
        },
        refreshSettings,
    );

    console.log("Settings update");
}

export const CompressFiles: FC<DefaultPageProps> = ({settings, updateSettings, refreshSettings}) => {
    const providers = useProviders();
    const default_page_options = useMemo(() => {
        return unique(providers.map((provider) => (
            {
                label: `${ title(provider.provider) }`,
                value: `${ provider.provider }`,
            }
        )), (v) => v.value);
    }, [ providers ]);

    const ref = useRef(null);

    return (
        <SettingRow title={ "Compress files" }
                    description={ <>
                        <Text>
                            When enabled, files will be compressed before being uploaded to the provider.
                        </Text>
                        <Text>
                            This can save bandwidth and storage space, but, if the provided natively supports file and
                            collaborative editing, it will not work as expected.
                        </Text>
                        <Text>
                            This setting affects all accounts using the same provider.
                        </Text>
                    </> }
                    target={ ref }>
            {
                !settings && <Skeleton height={ 40 }
                                       animate
                                       maw={ "24rem" }
                                       ml={ "auto" }/>
            }
            {
                settings && (
                             <MultiSelect
                                 ref={ ref }
                                 placeholder={ "Providers to compress files to" }
                                 data={ default_page_options }
                                 ml={ "auto" }
                                 maw={ "24rem" }
                                 searchable
                                 maxDropdownHeight={ 200 }
                                 value={ Object.keys(settings.general_behaviour.compress_files) }
                                 onChange={ (value) => handleOnChange(value, settings, updateSettings, refreshSettings) }
                             />
                         )
            }
        </SettingRow>
    );
};