import { Group, Stack, Text } from "@mantine/core";
import { FC, ReactNode } from "react";

interface SettingRowProps {
    children: ReactNode;
    title: ReactNode;
    description: ReactNode;
}

export const SettingRow: FC<SettingRowProps> = ({children, description, title}) => (
    <Group grow>
        <Stack gap={ 0 }>
            <Text fw={ 600 }>
                { title }
            </Text>
            <Text size={ "sm" } c={ "dark.4" } darkHidden>
                { description }
            </Text>
            <Text size={ "sm" } c={ "gray.6" } lightHidden>
                { description }
            </Text>
        </Stack>
        { children }
    </Group>
);