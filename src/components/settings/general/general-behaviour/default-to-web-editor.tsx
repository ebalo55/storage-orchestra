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
                default_to_web_editor: value,
                default_to_native_app: !value,
            },
        },
        refreshSettings,
    );

    console.log("Settings update");
}

export const DefaultToWebEditor: FC<DefaultPageProps> = ({settings, updateSettings, refreshSettings}) => {
    const ref = useRef(null);

    return (
        <SettingRow title={ "Default to web editor" }
                    description={ <>
                        <Text>
                            When enabled, the application will default to the web editor when opening files.
                        </Text>
                        <Text>
                            Not all storage providers support the web editor, in that case, the application will
                            fallback
                            to the native app.
                        </Text>
                    </> }
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
                                 checked={ settings.general_behaviour.default_to_web_editor }
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