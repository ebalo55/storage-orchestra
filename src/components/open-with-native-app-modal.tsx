import { Loader, Progress, Stack, Stepper, StepperCompleted, StepperStep, Text, useMantineTheme } from "@mantine/core";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { FC, useEffect, useMemo, useState } from "react";
import { dayjs } from "../utility/dayjs.ts";
import { formatByteSize } from "../utility/format-bytesize.ts";

enum StepStatus {
    InProgress = "In progress",
    Completed  = "Completed",
    Pending    = "Pending",
}

export const OpenWithNativeAppModal: FC<{
    download_size: number,
    download_progress: number,
}> = (props) => {
    const theme = useMantineTheme();

    const [ step, setStep ] = useState(0);
    const [ first_step_status, setFirstStepStatus ] = useState(StepStatus.InProgress);
    const [ second_step_status, setSecondStepStatus ] = useState(StepStatus.Pending);
    const [ second_step_progress, setSecondStepProgress ] = useState(0);
    const [ second_step_progress_interval, setSecondStepProgressInterval ] = useState<NodeJS.Timeout | null>(null);

    const progress = useMemo(() => (
        props.download_progress * 100 / props.download_size
    ), [ props.download_progress, props.download_size ]);

    useEffect(() => {
        if (progress >= 100) {
            setTimeout(() => {
                setFirstStepStatus(StepStatus.Completed);
                setSecondStepStatus(StepStatus.InProgress);
                setStep(1);
            }, 1000);
        }
    }, [ progress ]);

    useEffect(() => {
        if (second_step_status === StepStatus.InProgress) {
            setSecondStepProgressInterval(setInterval(() => {
                setSecondStepProgress((prev) => prev + 1);
            }, 1000));
            return () => {
                clearInterval(second_step_progress_interval as NodeJS.Timeout);
            };
        }
    }, [ second_step_status ]);

    return (
        <div className={ "p-4" }>
            <Stepper active={ step }
                     size={ "sm" }
                     allowNextStepsSelect={ false }
                     completedIcon={ <IconCheck size={ 24 }/> }>
                <StepperStep label="Download" description={ first_step_status }>
                    <Stack align={ "center" } gap={ "xs" }>
                        <Text className={ "font-semibold" }>
                            Downloading file from remote drive
                        </Text>
                        <Progress value={ progress } animated w={ "100%" }/>
                        <Text size={ "sm" }
                              c={ "dimmed" }>
                            { formatByteSize(BigInt(props.download_progress)) } /
                            { props.download_progress > props.download_size
                              ? formatByteSize(BigInt(props.download_progress))
                              : formatByteSize(BigInt(props.download_size)) }
                        </Text>
                    </Stack>
                </StepperStep>
                <StepperStep label="Syncing"
                             description={ second_step_status }
                             icon={ second_step_progress > 30
                                    ? <IconAlertTriangle size={ 24 }
                                                         color={ theme.colors.yellow[6] }/>
                                    : null }
                             color={ second_step_progress > 30 ? "yellow" : undefined }
                             styles={ {
                                 stepIcon: {
                                     backgroundColor: second_step_progress > 30 ? theme.colors.yellow[1] : undefined,
                                 },
                             } }
                >
                    <Stack align={ "center" } gap={ "xs" }>
                        <Text className={ "font-semibold" }>
                            Syncing with local processes
                        </Text>
                        <Loader/>
                        <Text size={ "sm" }
                              c={ "dimmed" }>
                            Elapsed time: { dayjs.duration(second_step_progress, "seconds").format("mm:ss") }
                        </Text>
                    </Stack>
                </StepperStep>
                <StepperStep label="Final step" description="Get full access">
                    Step 3 content: Get full access
                </StepperStep>
                <StepperCompleted>
                    Completed, click back button to get to previous step
                </StepperCompleted>
            </Stepper>
        </div>
    );
};