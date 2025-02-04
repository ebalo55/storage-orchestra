import { NumberInput, Skeleton } from "@mantine/core";
import { FC, useRef } from "react";
import { ThemeContextType, useThemeContext } from "../../../../hooks/use-theme.tsx";
import { Settings, SettingsResult } from "../../../../tauri-bindings.ts";
import { SettingRow } from "../../setting-row.tsx";

interface FontSizeProps {
    settings?: Settings;
    updateSettings: (updated_value: SettingsResult, refreshSettings: () => Promise<void>) => Promise<void>;
    refreshSettings: () => Promise<void>;
}

async function handleOnChange(
    value: string | number,
    settings: Settings,
    updateSettings: (
        updated_value: SettingsResult,
        refreshSettings: () => Promise<void>,
    ) => Promise<void>,
    refreshSettings: () => Promise<void>,
    theme_ctx: ThemeContextType,
) {
    if (!value || !Number.isSafeInteger(value)) {
        return;
    }

    value = Number(value);

    if (value < 10 || value > 30) {
        console.error("Invalid font size value");
        return;
    }

    // if the value is a general group, update the general group value
    await updateSettings(
        {
            theme: {
                ...settings?.theme,
                font_size: value,
            },
        },
        refreshSettings,
    );

    theme_ctx.setTheme({
        ...theme_ctx.theme,
        fontSizes: {
            xs: `${ value * 0.75 }px`,
            sm: `${ value * 0.875 }px`,
            md: `${ value }px`,
            lg: `${ value * 1.125 }px`,
            xl: `${ value * 1.25 }px`,
        },
    });

    console.log("Settings update");
    return;
}

export const FontSize: FC<FontSizeProps> = ({settings, updateSettings, refreshSettings}) => {
    const theme_ctx = useThemeContext();
    const ref = useRef(null);

    return (
        <SettingRow title={ "Font size" }
                    description={ "Change the font size of the application" }
                    target={ ref }>
            {
                !settings && <Skeleton height={ 40 }
                                       animate
                                       maw={ "10rem" }
                                       ml={ "auto" }/>
            }
            {
                settings && (
                             <NumberInput
                                 ref={ ref }
                                 placeholder={ "Font size" }
                                 ml={ "auto" }
                                 maw={ "10rem" }
                                 min={ 10 }
                                 max={ 30 }
                                 suffix={ "px" }
                                 value={ settings.theme.font_size }
                                 onChange={ (value) => handleOnChange(value, settings, updateSettings, refreshSettings, theme_ctx) }
                             />
                         )
            }
        </SettingRow>
    );
};