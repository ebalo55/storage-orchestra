import { MantineColorScheme } from "@mantine/core";
import { ExtendedThemeContextType, ThemeContextType } from "../hooks/use-theme.tsx";
import { Result, Settings, Theme } from "../tauri-bindings.ts";

/**
 * Convert the theme string to a MantineColorScheme
 * @param {Theme} theme
 * @returns {MantineColorScheme}
 */
export function themeToMantineColorScheme(theme: Theme): MantineColorScheme {
    switch (theme) {
        case "dark":
            return "dark";
        case "light":
            return "light";
        case "system":
            return "auto";
    }
}

/**
 * Load the theme settings into the theme context
 * @param {ThemeContextType} theme_ctx
 * @param {Settings} settings
 */
export function loadTheme(theme_ctx: ExtendedThemeContextType, settings: Result<Settings, string>) {
    if (settings.status === "error") {
        console.error(settings.error);
        return;
    }

    const {theme} = settings.data;

    theme_ctx.setTheme({
        ...theme_ctx.theme,
        fontSizes: {
            xs: `${ theme.font_size * 0.75 }px`,
            sm: `${ theme.font_size * 0.875 }px`,
            md: `${ theme.font_size }px`,
            lg: `${ theme.font_size * 1.125 }px`,
            xl: `${ theme.font_size * 1.25 }px`,
        },
    });
    theme_ctx.setColorScheme(themeToMantineColorScheme(theme.theme));
}