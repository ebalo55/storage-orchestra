import "@mantine/carousel/styles.css";
import { Carousel, CarouselSlide, Embla } from "@mantine/carousel";
import {
    ActionIcon,
    Button,
    Card,
    Center,
    Grid,
    GridCol,
    Group,
    PasswordInput,
    rem,
    ScrollArea,
    Stack,
    Text,
    ThemeIcon,
    Title,
} from "@mantine/core";
import { useForm, UseFormReturnType } from "@mantine/form";
import { IconArrowRightDashed, IconBrandGoogleDrive, IconCloud, IconTrash } from "@tabler/icons-react";
import { EmblaCarouselType } from "embla-carousel-react";
import { yupResolver } from "mantine-form-yup-resolver";
import { all, title } from "radash";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { NavigateFunction, useNavigate } from "react-router";
import * as yup from "yup";
import classes from "./assets/carousel.module.css";
import { GoogleDriveSignIn } from "./components/google-drive-sign-in.tsx";
import { GoogleProvider } from "./providers/google-provider.ts";
import { ProviderData } from "./tauri-bindings.ts";
import { State } from "./utility/state.ts";

type StrongholdFormValues = {
    password: string
    repeat_password: string
}

type StrongholdForm = UseFormReturnType<StrongholdFormValues, (values: StrongholdFormValues) => StrongholdFormValues>

/**
 * Sets up the stronghold
 * @param values - The values from the form
 * @param {React.Dispatch<React.SetStateAction<boolean>>} set_status - The function to set the status of the stronghold
 *     setup
 * @param embla - The carousel instance
 * @param form - The stronghold form
 * @returns {Promise<void>}
 */
async function setupState(
    values: {
        password: string,
        repeat_password: string,
    },
    set_status: Dispatch<SetStateAction<boolean>>,
    embla: Embla | null,
    form: StrongholdForm,
): Promise<void> {
    console.log("Setting up state");
    set_status(true);
    try {
        await State.init(values.password);

        set_status(false);
        embla?.scrollNext();
    }
    catch (e) {
        if (e instanceof Error) {
            console.error("Error setting up state", e);

            form.setErrors({
                "password": `An error occurred while setting up the state: ${ e.message.toLowerCase() }`,
            });
        }
        set_status(false);
    }
}

/**
 * Updates the providers list
 * @param {React.Dispatch<React.SetStateAction<ProviderData[]>>} setProviders
 * @returns {number}
 */
function updateProviders(setProviders: Dispatch<SetStateAction<ProviderData[]>>) {
    return setInterval(async () => {
        const google = await GoogleProvider.init();

        setProviders((providers) => {
            const non_google_providers = providers.filter(v => v.provider !== "google");

            return [
                ...non_google_providers,
                ...google.providers,
            ];
        });
    }, 5000);
}

/**
 * Drops a provider
 * @param {ProviderData} provider - The provider to drop
 * @returns {Promise<void>}
 */
async function dropProvider(provider: ProviderData): Promise<void> {
    console.log("Dropping provider", provider);
    const state = await State.init("");

    const providers = await state.get("providers");
    if ("providers" in providers) {
        const new_providers = providers.providers.filter((p: ProviderData) => p.owner !== provider.owner);
        await all([
            state.insert({providers: new_providers}),
            GoogleProvider.init().then((google) => google.dropProvider(provider.owner)),
        ]);

        console.log("Provider dropped");
    }
}

function emblaSlideSpy(embla: EmblaCarouselType, setCurrentSlide: Dispatch<SetStateAction<number>>) {
    setCurrentSlide(embla.selectedScrollSnap());
}

function completeSetup(providers: ProviderData[], navigate: NavigateFunction) {
    if (providers.length === 0) {
        return;
    }

    navigate("/dashboard");
}

export default function Onboard() {
    const navigate = useNavigate();

    const [ embla, setEmbla ] = useState<Embla | null>(null);
    const [ current_slide, setCurrentSlide ] = useState<number>(0);

    const [ providers, setProviders ] = useState<ProviderData[]>([]);

    const [ is_initiating_stronghold, setInitiatingStronghold ] = useState<boolean>(false);
    const stronghold_form = useForm({
        initialValues: {
            password:        "",
            repeat_password: "",
        },
        validate:      yupResolver(yup.object({
            password:        yup.string().required().min(8),
            repeat_password: yup.string().required().oneOf([ yup.ref("password") ], "Passwords must match"),
        })),
    });

    useEffect(() => {
        console.log("Current slide", current_slide);
        if (current_slide === 2) {
            const interval = updateProviders(setProviders);
            return () => clearInterval(interval);
        }
    }, [ current_slide ]);

    useEffect(() => {
        if (embla) {
            embla.on("select", () => emblaSlideSpy(embla, setCurrentSlide));
        }

        return () => {
            if (embla) {
                embla.off("select", () => emblaSlideSpy(embla, setCurrentSlide));
            }
        };
    }, [ embla ]);

    return (
        <div className={ "flex h-svh relative" }>
            <Carousel
                slideGap="md"
                className={ "flex-1 bg-indigo-200" }
                height={ "100%" }
                maw={ "100%" }
                withIndicators
                withControls={ false }
                classNames={ classes }
                getEmblaApi={ setEmbla }
            >
                <CarouselSlide>
                    <Center h={ "100%" }>
                        <Card miw={ "48rem" } maw={ "48rem" } shadow={ "xl" } p={ "xl" }>
                            <Stack>
                                <Title>
                                    Welcome in Storage Orchestra
                                </Title>
                                <Text>
                                    Welcome in Storage Orchestra, this app is designed to help you interact with your
                                    files
                                    across multiple cloud providers without the need to switch between different apps or
                                    download each file from your third-party storage provider in order to work on it.
                                </Text>
                                <Text>
                                    With Storage Orchestra, you can access all your files from different cloud providers
                                    in one place, and interact with them as if they were stored locally on your device.
                                </Text>
                                <Text>
                                    Click next to continue with the first setup.
                                </Text>
                                <Button className={ "ml-auto" }
                                        rightSection={ <IconArrowRightDashed className={ "animate-bounce-right" }/> }
                                        onClick={ () => embla?.scrollNext() }
                                >
                                    Next
                                </Button>
                            </Stack>
                        </Card>
                    </Center>
                </CarouselSlide>
                <CarouselSlide>
                    <Center h={ "100%" }>
                        <Card miw={ "48rem" } maw={ "48rem" } shadow={ "xl" }>
                            <Stack>
                                <Title>
                                    Security
                                </Title>
                                <Text>
                                    Storage Orchestra is designed to be secure, all your data are encrypted and securely
                                    stored locally on your device.
                                    No data is stored on our servers, and we do not have access to your data.
                                </Text>
                                <Text>
                                    To ensure your security, you should now create a password to protect your data.
                                    Please note that this password is not linked to your account but only used locally
                                    to
                                    encrypt your data.
                                </Text>
                                <form className={ "mt-8" }
                                      onSubmit={ stronghold_form.onSubmit((values) => setupState(
                                          values,
                                          setInitiatingStronghold,
                                          embla,
                                          stronghold_form,
                                      )) }>
                                    <Stack>
                                        <PasswordInput placeholder={ "Password" }
                                                       label={ "Password" }
                                                       description={ "Define a strong password you will remember, consider that this will be used to store all your access data locally" }
                                                       key={ stronghold_form.key("password") }
                                                       { ...stronghold_form.getInputProps("password") }
                                        />
                                        <PasswordInput placeholder={ "Repeat password" }
                                                       label={ "Repeat password" }
                                                       key={ stronghold_form.key("repeat_password") }
                                                       { ...stronghold_form.getInputProps("repeat_password") }/>
                                        <Button type={ "submit" }
                                                rightSection={
                                                    <IconArrowRightDashed className={ "animate-bounce-right" }/>
                                                }
                                                className={ "ml-auto" }
                                                loading={ is_initiating_stronghold }>
                                            Confirm password
                                        </Button>
                                    </Stack>
                                </form>
                            </Stack>
                        </Card>
                    </Center>
                </CarouselSlide>
                <CarouselSlide>
                    <Center h={ "100%" }>
                        <Card miw={ "48rem" } maw={ "48rem" } shadow={ "xl" }>
                            <Stack>
                                <Title>
                                    Connect your cloud providers
                                </Title>
                                <Text>
                                    Storage Orchestra allows you to connect multiple cloud providers to access all your
                                    files in one place. Multiple instances of the same provider are supported.
                                </Text>
                                <Text>
                                    Choose the cloud provider you want to connect and follow the instructions to connect
                                    it.
                                </Text>
                                <Grid columns={ 6 }>
                                    <GridCol span={ 2 }>
                                        <ScrollArea h={ rem(250) } offsetScrollbars>
                                            <Stack gap={ "sm" }>
                                                <GoogleDriveSignIn/>
                                                <Button leftSection={ <IconCloud/> } disabled>
                                                    More soon ...
                                                </Button>
                                            </Stack>
                                        </ScrollArea>
                                    </GridCol>
                                    <GridCol span={ 4 }>
                                        <ScrollArea h={ rem(250) } offsetScrollbars>
                                            <Stack gap={ "xs" }>
                                                { providers.map((provider) => (
                                                    <Card key={ provider.provider + "-" + provider.owner }
                                                          withBorder
                                                          shadow={ "none" }>
                                                        <Group gap={ "sm" } align={ "end" }>
                                                            <ThemeIcon size={ "md" }
                                                                       color={ "blue" }
                                                                       variant={ "subtle" }>
                                                                {
                                                                    provider.provider === "google" &&
                                                                    <IconBrandGoogleDrive/>
                                                                }
                                                            </ThemeIcon>
                                                            <Title order={ 3 }>
                                                                { title(provider.provider) }
                                                            </Title>
                                                            <Text>
                                                                { provider.owner }
                                                            </Text>
                                                            <ActionIcon color={ "red" }
                                                                        variant={ "light" }
                                                                        ml={ "auto" }
                                                                        onClick={ () => dropProvider(provider) }>
                                                                <IconTrash size={ 18 }/>
                                                            </ActionIcon>
                                                        </Group>
                                                    </Card>
                                                )) }
                                                {
                                                    providers.length === 0 && (
                                                                         <Center h={ rem(200) }>
                                                                             <Title order={ 4 } size={ "sm" }>
                                                                                 No providers connected
                                                                             </Title>
                                                                         </Center>
                                                                     )
                                                }
                                            </Stack>
                                        </ScrollArea>
                                    </GridCol>
                                </Grid>
                                <Button rightSection={ <IconArrowRightDashed className={ "animate-bounce-right" }/> }
                                        onClick={ () => completeSetup(providers, navigate) }
                                        disabled={ providers.length === 0 }
                                        className={ "ml-auto" }>
                                    Complete setup
                                </Button>
                            </Stack>
                        </Card>
                    </Center>
                </CarouselSlide>
            </Carousel>
        </div>
    );
}

