import { Progress, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { TrackableModalInfo } from "../interfaces/trackable-modal-info.ts";
import { formatByteSize } from "../utility/format-bytesize.ts";

export const ModalDownloadFile: NonNullable<TrackableModalInfo["element"]> = (props) => {
    const progress = useMemo(() => (
        props.progress.current * 100 / props.progress.total
    ), [ props.progress.current, props.progress.total ]);

    return (
        <div className={ "p-4" }>
            <Stack align={ "center" } gap={ "xs" }>
                <Text className={ "font-semibold" }>
                    Downloading file from remote drive
                </Text>
                <Progress value={ progress } animated w={ "100%" }/>
                <Text size={ "sm" }
                      c={ "dimmed" }>
                    { formatByteSize(BigInt(props.progress.current)) } /{ " " }
                    { props.progress.current > props.progress.total
                      ? formatByteSize(BigInt(props.progress.current))
                      : formatByteSize(BigInt(props.progress.total)) }
                </Text>
            </Stack>
        </div>
    );
};