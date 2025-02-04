import {
    ActionIcon,
    Skeleton,
    Text,
    TextInput,
} from "@mantine/core";
import {IconX} from "@tabler/icons-react";
import {
    FC,
    useRef,
} from "react";
import {
    Settings,
    SettingsResult,
} from "../../../../tauri-bindings.ts";
import {SettingRow} from "../../setting-row.tsx";

interface PasswordHint {
    settings?: Settings;
    updateSettings: (updated_value: SettingsResult, refreshSettings: () => Promise<void>) => Promise<void>;
    refreshSettings: () => Promise<void>;
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
    await updateSettings(
        {
            security: {
                ...settings?.security,
                password_hint: value,
            },
        },
        refreshSettings,
    );

    console.log("Settings update");
}

export const PasswordHint: FC<PasswordHint> = ({settings, updateSettings, refreshSettings}) => {
    const ref = useRef(null);

    return (
        <SettingRow title={"Password hint"}
                    description={<>
                        <Text>
                            The hint that will be shown when the user is entering their password
                        </Text>
                        <Text>
                            This hint is used to help the user remember their password.
                        </Text>
                        <Text>
                            Remember that <strong>the hint is not encrypted</strong> and{" "}
                            <strong>is stored in plain text</strong>, so make sure to not include any sensitive{" "}
                            information in the hint.
                        </Text>
                    </>}
                    target={ref}>
            {
                !settings && <Skeleton height={40}
                                       animate
                                       maw={"24rem"}
                                       ml={"auto"}/>
            }
            {
                settings && (
                    <TextInput
                        ref={ref}
                        placeholder={"Password hint"}
                        ml={"auto"}
                        maw={"24rem"}
                        value={settings.security.password_hint || ""}
                        rightSection={<>
                            <ActionIcon variant={"white"} color={"gray"} onClick={() => handleOnChange(
                                null,
                                settings,
                                updateSettings,
                                refreshSettings,
                            )}>
                                <IconX size={16}/>
                            </ActionIcon>
                        </>}
                        onChange={(ev) => handleOnChange(
                            ev.currentTarget.value,
                            settings,
                            updateSettings,
                            refreshSettings,
                        )}
                    />
                )
            }
        </SettingRow>
    );
};