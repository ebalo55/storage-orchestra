import { Group, Stack, Text } from "@mantine/core";
import { FC, MutableRefObject, ReactNode } from "react";

interface SettingRowProps {
    children: ReactNode;
    title: ReactNode;
    description: ReactNode;
    target: MutableRefObject<any>;
}

export const SettingRow: FC<SettingRowProps> = ({children, description, title, target}) => (
    <Group grow>
        <Stack gap={ 0 } onClick={ () => target.current.focus() } className={ "cursor-pointer" }>
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