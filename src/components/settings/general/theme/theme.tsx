import { Select, Skeleton } from "@mantine/core";
import { FC, useRef } from "react";
import { ExtendedThemeContextType, useThemeContext } from "../../../../hooks/use-theme.tsx";
import { Settings, SettingsResult, Theme as ITheme } from "../../../../tauri-bindings.ts";
import { themeToMantineColorScheme } from "../../../../utility/load-theme.ts";
import { SettingRow } from "../../setting-row.tsx";

interface ThemeProps {
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
    theme_ctx: ExtendedThemeContextType,
) {
    if (!value) {
        return;
    }

    const themes = [
        "dark",
        "system",
        "light",
    ] as ITheme[];

    // if the value is a general group, update the general group value
    if (themes.includes(value as any)) {
        await updateSettings(
            {
                theme: {
                    ...settings?.theme,
                    theme: value as ITheme,
                },
            },
            refreshSettings,
        );
        theme_ctx.setColorScheme(themeToMantineColorScheme(value as ITheme));

        console.log("Settings update");
        return;
    }
    console.error("Invalid theme value");
}

export const Theme: FC<ThemeProps> = ({settings, updateSettings, refreshSettings}) => {
    const theme_ctx = useThemeContext();
    const ref = useRef(null);

    return (
        <SettingRow title={ "Theme" }
                    description={ "The theme to use in the application." }
                    target={ ref }>
            {
                !settings && <Skeleton height={ 40 }
                                       animate
                                       maw={ "10rem" }
                                       ml={ "auto" }/>
            }
            {
                settings && (
                             <Select
                                 ref={ ref }
                                 placeholder={ "Theme" }
                                 data={ [
                                     {label: "Light", value: "light" as ITheme},
                                     {label: "Dark", value: "dark" as ITheme},
                                     {label: "System", value: "system" as ITheme},
                                 ] }
                                 ml={ "auto" }
                                 maw={ "10rem" }
                                 searchable
                                 maxDropdownHeight={ 200 }
                                 value={ settings.theme.theme }
                                 onChange={ (value) => handleOnChange(value, settings, updateSettings, refreshSettings, theme_ctx) }
                             />
                         )
            }
        </SettingRow>
    );
};