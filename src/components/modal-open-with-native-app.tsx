import {
    Button,
    Center,
    Group,
    Progress,
    Stack,
    Stepper,
    StepperCompleted,
    StepperStep,
    Text,
    useMantineTheme,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { batch, signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import {
    IconAlertTriangle,
    IconCheck,
    IconCloudDownload,
    IconCloudUp,
    IconDeviceGamepad2,
    IconRotateRectangle,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { TrackableModalInfo } from "../interfaces/trackable-modal-info.ts";
import { commands, WatchProcessEvent } from "../tauri-bindings.ts";
import { dayjs } from "../utility/dayjs.ts";
import { formatByteSize } from "../utility/format-bytesize.ts";

/**
 * The possible statuses of a step.
 */
enum StepStatus {
    InProgress     = "In progress",
    Completed      = "Completed",
    Pending        = "Pending",
    Error          = "Error",
    ManualOverride = "Manual override",
}

/**
 * The variants for the syncing process animation.
 */
const variants = {
    enter:  {
        opacity:   0,
        left:      "50%",
        y:         50,
        transform: "translateX(-50%)",
    },
    center: {
        opacity:    1,
        y:          0,
        left:       "50%",
        top:        "50%",
        transform:  "translateX(-50%) translateY(-50%)",
        transition: {duration: 0.6, ease: "easeOut"},
    },
    exit:   {
        opacity:    0,
        y:          -50,
        left:       "50%",
        transform:  "translateX(-50%)",
        transition: {duration: 0.6, ease: "easeIn"},
    },
};

/**
 * The threshold for syncing to be considered slow. If the syncing process takes longer than this threshold, the user
 * will be prompted to take control of the process.
 *
 * This value is in seconds.
 * @type {number}
 */
const SYNCING_SLOW_THRESHOLD = 30;

const current_step = signal<number>(0);
const step_1_status = signal<StepStatus>(StepStatus.InProgress);
const step_2_status = signal<StepStatus>(StepStatus.Pending);
const step_3_status = signal<StepStatus>(StepStatus.Pending);

/**
 * The progress of the second step, aka the number of seconds elapsed since the start of the second step.
 */
const step_2_progress = signal(0);
/**
 * The interval for the second step progress.
 */
const second_step_progress_interval = signal<NodeJS.Timeout | null>(null);
/**
 * The index of the current animation element. This is used to cycle through the elements in step 2.
 */
const animation_element_index = signal<number>(0);
/**
 * The signal for the number of processes to analyze. This is used to display the progress of the process analysis
 * (step 2).
 */
const process_to_analyze = signal(0);
/**
 * The signal for the number of processes analyzed. This is used to display the progress of the process analysis (step
 * 2).
 */
const analyzed_processes = signal(0);

/**
 * The elements for the syncing process animation.
 */
const elements = [
    () => {
        useSignals();
        return (
            <Text size={ "sm" }
                  c={ "dimmed" }>
                Opening app
            </Text>
        );
    },
    () => {
        useSignals();
        return (
            <Text size={ "sm" }
                  c={ "dimmed" }>
                Waiting for process to wake up
            </Text>
        );
    },
    () => {
        useSignals();
        return (
            <Text size={ "sm" }
                  c={ "dimmed" }>
                Searching for native process { analyzed_processes.value } / { process_to_analyze.value }
            </Text>
        );
    },
    () => {
        useSignals();
        return (
            <Text size={ "sm" }
                  c={ "dimmed" }>
                Process found
            </Text>
        );
    },
    () => {
        useSignals();
        return (
            <Text size={ "sm" }
                  c={ "dimmed" }>
                Waiting for process to exit
            </Text>
        );
    },
    () => {
        useSignals();
        return (
            <Text size={ "sm" }
                  c={ "dimmed" }>
                Process exited
            </Text>
        );
    },
    () => {
        useSignals();
        return (
            <Text size={ "sm" }
                  c={ "dimmed" }>
                Process not found
            </Text>
        );
    },
];

/**
 * Prompts the user to take control of the syncing process.
 * @returns {Promise<void>}
 */
async function manualOverride(): Promise<void> {
    batch(() => {
        step_2_status.value = StepStatus.ManualOverride;
        current_step.value = 2;
    });
    await commands.cancelWatchNativeOpen();
}

/**
 * Update the animation element index to the next element or a specific index.
 * @type {number}
 */
function nextAnimationElement(index: number | null = null) {
    if (index) {
        animation_element_index.value = index;
    }

    animation_element_index.value = (
                                        animation_element_index.value + 1
                                    ) % elements.length;
}

/**
 * Handles the channel message.
 * @param {WatchProcessEvent} ev - The event data
 */
function handleChannelMessage(ev: WatchProcessEvent) {
    switch (ev.event) {
        case "waiting_for_process_wakeup":
            nextAnimationElement();
            break;
        case "searching_native_process":
            process_to_analyze.value = ev.data.processes || 0;
            nextAnimationElement();
            break;
        case "process_analyzed":
            analyzed_processes.value = analyzed_processes.value + 1;
            break;
        case "process_found":
            nextAnimationElement();
            clearInterval(second_step_progress_interval.value as NodeJS.Timeout);
            break;
        case "process_not_found":
            nextAnimationElement(elements.length - 1);
            step_2_status.value = StepStatus.Error;
            clearInterval(second_step_progress_interval.value as NodeJS.Timeout);
            break;
        case "waiting_for_process_exit":
            nextAnimationElement();
            break;
        case "process_exited":
            nextAnimationElement();
            setTimeout(() => {
                clearInterval(second_step_progress_interval.value as NodeJS.Timeout);
                batch(() => {
                    step_2_status.value = StepStatus.Completed;
                    step_3_status.value = StepStatus.InProgress;
                    current_step.value = 2;
                    step_2_progress.value = 0;
                });
            }, 2500);
            break;
    }
}

export const ModalOpenWithNativeApp: NonNullable<TrackableModalInfo["element"]> = (props) => {
    useSignals();
    const Component = elements[animation_element_index.value];

    const theme = useMantineTheme();

    const progress = useMemo(() => (
        props.progress.current * 100 / props.progress.total
    ), [ props.progress.current, props.progress.total ]);

    const second_step_icon = useMemo(() => {
        if (step_2_status.value === StepStatus.Error) {
            return {
                icon:            <IconAlertTriangle size={ 24 }
                                                    color={ theme.colors.red[6] }/>,
                color:           "red",
                backgroundColor: theme.colors.red[1],
            };
        }
        else if (step_2_progress.value > SYNCING_SLOW_THRESHOLD) {
            return {
                icon:            <IconAlertTriangle size={ 24 }
                                                    color={ theme.colors.yellow[6] }/>,
                color:           "yellow",
                backgroundColor: theme.colors.yellow[1],
            };
        }

        return {
            icon:            step_2_status.value !== StepStatus.Completed
                             ? <IconRotateRectangle size={ 24 }/>
                             : <IconCheck size={ 24 }/>,
            color:           undefined,
            backgroundColor: undefined,
        };
    }, [ step_2_status.value, step_2_progress.value ]);

    useEffect(() => {
        // If the progress is 100% and the first step is in progress, the first step is just completed
        if (progress >= 100 && step_1_status.value === StepStatus.InProgress) {
            setTimeout(() => {
                batch(() => {
                    step_1_status.value = StepStatus.Completed;
                    step_2_status.value = StepStatus.InProgress;
                    current_step.value = 1;
                });
            }, 1000);
        }
            // If the progress is 100% and the first step is completed, the third step is in progress, a progress of
        // 100% means that it's completed that one too now
        else if (progress >= 100 && step_1_status.value === StepStatus.Completed && step_3_status.value ===
                 StepStatus.InProgress) {
            batch(() => {
                step_3_status.value = StepStatus.Completed;
                current_step.value = 3;
            });
        }
    }, [ progress, step_1_status.value ]);

    useEffect(() => {
        if (step_2_status.value === StepStatus.InProgress) {
            second_step_progress_interval.value = setInterval(() => {
                step_2_progress.value += 1;
            }, 1000);
            return () => {
                clearInterval(second_step_progress_interval.value as NodeJS.Timeout);
            };
        }
    }, [ step_2_status.value ]);

    useEffect(() => {
        props.channel.onmessage = handleChannelMessage;
    }, []);

    return (
        <div className={ "p-4" }>
            <Stepper active={ current_step.value }
                     size={ "sm" }
                     allowNextStepsSelect={ false }>
                <StepperStep label="Download"
                             description={ step_1_status.value }
                             icon={ <IconCloudDownload size={ 24 }/> }>
                    <Stack align={ "center" } gap={ "xs" }>
                        <Text className={ "font-semibold" }>
                            Downloading file from remote drive
                        </Text>
                        <Progress value={ progress } animated w={ "100%" }/>
                        <Text size={ "sm" }
                              c={ "dimmed" }>
                            { formatByteSize(BigInt(props.progress.current)) } /
                            { props.progress.current > props.progress.total
                              ? formatByteSize(BigInt(props.progress.current))
                              : formatByteSize(BigInt(props.progress.total)) }
                        </Text>
                    </Stack>
                </StepperStep>
                <StepperStep label="Syncing"
                             description={ step_2_status.value }
                             icon={ second_step_icon.icon }
                             completedIcon={ second_step_icon.icon }
                             color={ second_step_icon.color }
                             styles={ {
                                 stepIcon: {
                                     backgroundColor: second_step_icon.backgroundColor,
                                 },
                             } }
                >
                    <Stack gap={ "xs" } className={ "pt-6 px-4" }>
                        <Center>
                            <Text className={ "font-semibold" }>
                                Syncing with local process, please wait
                            </Text>
                        </Center>
                        <Stack gap={ 0 } align={ "center" }>
                            <Group className={ "relative" }>
                                <div className="relative h-12 w-140 min-w-8 overflow-hidden flex items-center justify-start">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={ animation_element_index.value }
                                            variants={ variants }
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            className="absolute"
                                        >
                                            {
                                                <Component/>
                                            }
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </Group>
                            <Text size={ "sm" }
                                  mt={ "-0.5rem" }
                                  c={ "dimmed" }>
                                Elapsed time: { dayjs.duration(step_2_progress.value, "seconds").format("mm:ss") }
                            </Text>
                        </Stack>
                        {
                            (
                                step_2_status.value === StepStatus.Error || step_2_progress.value >
                                SYNCING_SLOW_THRESHOLD
                            ) && (
                                <>
                                    {
                                        step_2_status.value === StepStatus.Error && (
                                                                <Text className={ "font-semibold" }>
                                                                    Something went wrong while syncing, click the button below to
                                                                    enter "manual override" mode.
                                                                </Text>
                                                            )
                                    }
                                    {
                                        step_2_status.value !== StepStatus.Error && (
                                                                <Text className={ "font-semibold" }>
                                                                    Syncing seems to be taking longer than expected, click the button below to
                                                                    enter "manual override" mode.
                                                                    You can also wait for the process to finish.
                                                                </Text>
                                                            )
                                    }
                                    <Center>
                                        <Button variant={ "filled" }
                                                color={ "yellow.7" }
                                                leftSection={ <IconDeviceGamepad2 size={ 20 }/> }
                                                onClick={ () => manualOverride() }>
                                            Manual override
                                        </Button>
                                    </Center>
                                </>
                            )
                        }
                    </Stack>
                </StepperStep>
                <StepperStep label="Upload" description={ step_3_status.value } icon={ <IconCloudUp size={ 24 }/> }>
                    {
                        step_3_status.value === StepStatus.ManualOverride && (
                                                <Stack gap={ "xs" } className={ "pt-6 px-4" }>
                                                    <Text className={ "font-semibold" }>
                                                        Manual override activated
                                                    </Text>
                                                    <Text size={ "sm" }>
                                                        You are now in control of the syncing process. Click the button below once you are ready
                                                        to
                                                        upload your file back to the remote drive.
                                                    </Text>
                                                    <Center>
                                                        <Button variant={ "filled" }
                                                                color={ "blue" }
                                                                leftSection={ <IconCloudUp size={ 20 }/> }
                                                                onClick={ () => {
                                                                    step_3_status.value = StepStatus.InProgress;
                                                                    props.manual_override.upload(props.manual_override.path!);
                                                                } }>
                                                            Upload file
                                                        </Button>
                                                    </Center>
                                                </Stack>
                                            )
                    }
                    {
                        step_3_status.value !== StepStatus.ManualOverride && (
                                                <Stack gap={ "xs" } className={ "pt-6 px-4" }>
                                                    <Text className={ "font-semibold" }>
                                                        Uploading file to remote drive
                                                    </Text>
                                                    <Progress value={ progress } animated w={ "100%" }/>
                                                    <Text size={ "sm" }
                                                          c={ "dimmed" }>
                                                        { formatByteSize(BigInt(props.progress.current)) } /
                                                        { props.progress.current > props.progress.total
                                                          ? formatByteSize(BigInt(props.progress.current))
                                                          : formatByteSize(BigInt(props.progress.total)) }
                                                    </Text>
                                                </Stack>
                                            )
                    }
                </StepperStep>
                <StepperCompleted>
                    <Stack align={ "center" } className={ "p-4" } gap={ 0 }>
                        <Text className={ "font-semibold" }>
                            File successfully edited and synced back to remote drive.
                        </Text>
                        <Text className={ "font-semibold" }>
                            You can now close this window.
                        </Text>
                        <Button variant={ "filled" }
                                color={ "blue" }
                                mt={ "sm" }
                                onClick={ () => modals.close(props.id!) }>
                            Close window
                        </Button>
                    </Stack>
                </StepperCompleted>
            </Stepper>
        </div>
    );
};