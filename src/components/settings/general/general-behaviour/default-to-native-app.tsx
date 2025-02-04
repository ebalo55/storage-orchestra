import { Skeleton, Switch, Text } from "@mantine/core";
import { FC, useRef } from "react";
import { DefaultPageGroups, Settings, SettingsResult } from "../../../../tauri-bindings.ts";
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
    value: boolean,
    settings: Settings,
    updateSettings: (
        updated_value: SettingsResult,
        refreshSettings: () => Promise<void>,
    ) => Promise<void>,
    refreshSettings: () => Promise<void>,
) {
    await updateSettings(
        {
            general_behaviour: {
                ...settings?.general_behaviour,
                default_to_native_app: value,
                default_to_web_editor: !value,
            },
        },
        refreshSettings,
    );

    console.log("Settings update");
}

export const DefaultToNativeApp: FC<DefaultPageProps> = ({settings, updateSettings, refreshSettings}) => {
    const ref = useRef(null);

    return (
        <SettingRow title={ "Default to native app" }
                    description={ <>
                        <Text>
                            When enabled, the application will default to the native app when opening files
                        </Text>
                        <Text>
                            Note that if the provider does not allow file downloads, the application will fallback to
                            the web editor.
                        </Text>
                        <Text>
                            Additionally, you need to have an appropriate application to open a file for this to work.
                        </Text>
                    </>
                    }
                    target={ ref }
        >
            {
                !settings && <Skeleton height={ 40 }
                                       animate
                                       maw={ "24rem" }
                                       ml={ "auto" }/>
            }
            {
                settings && (
                             <Switch
                                 ref={ ref }
                                 ml={ "auto" }
                                 maw={ "8rem" }
                                 checked={ settings.general_behaviour.default_to_native_app }
                                 onChange={ (ev) => handleOnChange(
                                     ev.currentTarget.checked,
                                     settings,
                                     updateSettings,
                                     refreshSettings,
                                 ) }
                             />
                         )
            }
        </SettingRow>
    );
};