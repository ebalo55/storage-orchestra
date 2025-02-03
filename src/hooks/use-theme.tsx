import { createTheme, MantineThemeOverride, useMantineColorScheme } from "@mantine/core";
import { createContext, useContext, useState } from "react";

export interface ThemeContextType {
    theme: MantineThemeOverride;
    setTheme: (theme: MantineThemeOverride) => void;
}

export type ExtendedThemeContextType = ReturnType<typeof useMantineColorScheme> & ThemeContextType;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useSimpleThemeContext = () => {
    const ctx = useContext(ThemeContext);

    if (!ctx) {
        throw new Error("useSimpleThemeContext must be used within a ThemeProvider");
    }

    return ctx;
};

/**
 * Hook to get the theme context, this is used to get the theme and update it
 * @returns {ExtendedThemeContextType}
 */
export const useThemeContext = () => {
    const ctx = useSimpleThemeContext();
    const colorScheme = useMantineColorScheme({keepTransitions: true});

    return {...ctx, ...colorScheme} as ExtendedThemeContextType;
};

/**
 * Theme provider to provide the theme to the application, this makes the Mantine theme editable in-app
 * @param {React.ReactNode} children
 * @returns {JSX.Element}
 * @constructor
 */
export const ThemeProvider = ({children}: {
    children: React.ReactNode
}) => {
    const [ theme, setTheme ] = useState<MantineThemeOverride>(createTheme({
        fontFamily: "Nunito, sans-serif",
    }));

    return (
        <ThemeContext.Provider value={ {theme, setTheme} }>
            { children }
        </ThemeContext.Provider>
    );
};