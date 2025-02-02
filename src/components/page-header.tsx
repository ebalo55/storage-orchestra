import {
    Divider,
    Stack,
    Title,
} from "@mantine/core";
import {
    FC,
    ReactNode,
} from "react";

interface PageHeaderProps {
    children: ReactNode;
    title: ReactNode;
}

export const PageHeader: FC<PageHeaderProps> = ({children, title}) => (
    <Stack gap={"sm"} mb={"xl"}>
        <Title order={2}>
            {title}
        </Title>
        <Stack gap={0}>
            {children}
        </Stack>
        <Divider/>
    </Stack>
);