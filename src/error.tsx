import { Stack, Text, Title } from "@mantine/core";

export default function Error() {
    return (
        <Stack>
            <Title>Error</Title>
            <Text>{ new URLSearchParams(window.location.search).get("message") }</Text>
        </Stack>
    );
}