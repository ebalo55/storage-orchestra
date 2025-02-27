import { Stack, Text } from "@mantine/core";
import { ContextModalProps } from "@mantine/modals";
import { IconExclamationCircle } from "@tabler/icons-react";
import { FC } from "react";

export const ModalError: FC<ContextModalProps<{
    modalBody: string
}>> = ({innerProps}) => (
    <Stack align={ "center" }>
        <IconExclamationCircle size={ 52 } color={ "red" }/>
        <Text size="lg">
            { innerProps.modalBody }
        </Text>
    </Stack>
);