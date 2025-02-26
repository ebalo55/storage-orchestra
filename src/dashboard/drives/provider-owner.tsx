import { ActionIcon, Center, Grid, GridCol, Group, List, ListItem, Loader, Stack, Text, Title } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { modals } from "@mantine/modals";
import {
    IconCloudUpload,
    IconFile,
    IconFilePlus,
    IconFolderPlus,
    IconListTree,
    IconRefresh,
    IconX,
} from "@tabler/icons-react";
import { Channel } from "@tauri-apps/api/core";
import { BaseDirectory, remove } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { title } from "radash";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useParams } from "react-router";
import { MyDriveObjectCard } from "../../components/my-drive-object-card.tsx";
import { OpenWithNativeAppModal } from "../../components/open-with-native-app-modal.tsx";
import { PageHeader } from "../../components/page-header.tsx";
import { IntelligentDivider } from "../../components/provider-intelligent-divider.tsx";
import { UploadFiles } from "../../components/upload-files.tsx";
import { TrackableModalInfo } from "../../interfaces/trackable-modal-info.ts";
import { GoogleFile, GoogleProvider } from "../../providers/google-provider.tsx";
import { commands, Settings, StorageProvider, WatchProcessEvent } from "../../tauri-bindings.ts";

/**
 * Load files from Google Drive
 * @param {string} owner
 * @param {React.Dispatch<React.SetStateAction<GoogleFile[]>>} setObjects
 * @returns {Promise<void>}
 */
async function loadGoogleFiles(owner: string, setObjects: Dispatch<SetStateAction<GoogleFile[]>>) {
    const google = await GoogleProvider.init();
    let files = await google.listFiles(owner);

    setObjects(files.files);
    while (files.nextPageToken) {
        files = await google.listFiles(owner, "root", files.nextPageToken);
        setObjects((prev) => prev.concat(files.files));
    }
}

/**
 * Load files from a storage provider
 * @param {StorageProvider} provider
 * @param {string} owner
 * @param {React.Dispatch<React.SetStateAction<GoogleFile[]>>} setObjects
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setLoading
 * @returns {Promise<void>}
 */
async function loadFiles(
    provider: StorageProvider,
    owner: string,
    setObjects: Dispatch<SetStateAction<GoogleFile[]>>,
    setLoading: Dispatch<SetStateAction<boolean>>,
) {
    switch (provider) {
        case "google":
            await loadGoogleFiles(owner, setObjects);
            break;
    }

    setLoading(false);
}

/**
 * Open a file with an online app
 * @param file {GoogleFile} The file to open
 * @param provider {StorageProvider} The provider of the file
 */
async function openWithOnlineApp(file: GoogleFile, provider: StorageProvider) {
    switch (provider) {
        case "google":
            switch (file.mimeType) {
                case "application/vnd.google-apps.document":
                    await openUrl(`https://docs.google.com/document/d/${ file.id }/edit`);
                    break;
                case "application/vnd.google-apps.presentation":
                    await openUrl(`https://docs.google.com/presentation/d/${ file.id }/edit`);
                    break;
                case "application/vnd.google-apps.spreadsheet":
                    await openUrl(`https://docs.google.com/spreadsheets/d/${ file.id }/edit`);
                    break;
                case "application/pdf":
                    await openUrl(`https://drive.google.com/file/d/${ file.id }/view`);
                    break;
                default:
                    throw new Error("No online app found for this file");
            }
            break;
    }
}

/**
 * Open a file with a native app
 * @param file {GoogleFile} The file to open
 * @param provider {StorageProvider} The provider of the file
 * @param owner {string} The owner of the file
 */
async function openWithNativeApp(file: GoogleFile, provider: StorageProvider, owner: string) {
    console.log("Opening with native app", file, provider, owner);
    switch (provider) {
        case "google":
            const google = await GoogleProvider.init();
            const extended_file = await google.getFile(owner, file);

            if (!extended_file) {
                throw new Error("Failed to get extended file information");
            }

            const modal_channel = new Channel<WatchProcessEvent>();

            // TODO: allow for multiple instances of sync to be open at the same time with a "reduce to icon" like
            // behaviour that allows the user to open the windows from where he left off Allow only a single modal to
            // be open at a time
            const modal_id = modals.open({
                size:    "36rem",
                padding: "md",
                closeOnClickOutside: false,
                withCloseButton:     false,
                title:   <Title order={ 4 }>Opening '{ file.name }'</Title>,
                children:            <OpenWithNativeAppModal progress={ {current: 0, total: extended_file.size} }
                                                             channel={ modal_channel }
                                                             manual_override={ {
                                                                 upload: async (_path: string) => {},
                                                             } }
                                     />,
            });
            const modal_data = {
                id:              modal_id,
                progress:        {
                    total:   extended_file.size,
                    current: 0,
                },
                channel:         modal_channel,
                manual_override: {
                    upload: async (path: string) => {
                        await google.updateFile(owner, path, modal_data, file);

                        // Get the filename from the updated content to include the extension automatically
                        const filename = path.replace(/\\/g, "/").split("/").pop()!;
                        await remove(filename, {baseDir: BaseDirectory.Temp});
                    },
                },
            } as TrackableModalInfo;

            const download_path = await google.downloadFile(owner, file, modal_data);
            console.log(download_path);
            if (!download_path) {
                throw new Error("Failed to download file");
            }

            const updated_content = await commands.watchNativeOpen(download_path, modal_channel);

            if (updated_content.status === "error") {
                throw new Error(updated_content.error);
            }

            await google.updateFile(owner, updated_content.data, modal_data, file);

            // Get the filename from the updated content to include the extension automatically
            const filename = updated_content.data.split("/").pop()!;
            await remove(filename, {baseDir: BaseDirectory.Temp});

            break;
    }
}

/**
 * Open a file with the preferred app
 * @param file {GoogleFile} The file to open
 * @param provider {StorageProvider} The provider of the file
 * @param owner {string} The owner of the file
 * @param settings {Settings} The settings of the app
 */
async function openWithPreferredApp(file: GoogleFile, provider: StorageProvider, owner: string, settings?: Settings) {
    if (settings?.general_behaviour.default_to_web_editor) {
        await openWithOnlineApp(file, provider);
        return;
    }
    else if (settings?.general_behaviour.default_to_native_app) {
        await openWithNativeApp(file, provider, owner);
        return;
    }

    // Try to open with online app first, if it fails, open with native one
    try {
        await openWithOnlineApp(file, provider);
    }
    catch (e) {
        await openWithNativeApp(file, provider, owner);
    }
}

export default function DrivesProviderOwner() {
    const {provider, owner} = useParams();
    const [ objects, setObjects ] = useState<GoogleFile[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ uploading, setUploading ] = useState(false);
    const [ modal_id, setModalId ] = useState<string>();

    useEffect(() => {
        if (!provider || !owner) {
            return;
        }

        loadFiles(provider as StorageProvider, owner, setObjects, setLoading).then(() => console.log("Files fetched"));
    }, [ owner, provider ]);

    useEffect(() => {
        if (!uploading && modal_id) {
            modals.close(modal_id);
        }
    }, [ uploading, modal_id ]);

    return (
        <>
            <div className={ "p-8 relative" }>
                <PageHeader title={ `${ title(provider) }'s ${ owner } account` }>
                    <Text>
                        This page shows the files and folders in the { title(provider) } account owned by { owner }.
                    </Text>
                    <Text>
                        Here you can:
                    </Text>
                    <List ml={ "md" } listStyleType={ "none" }>
                        <ListItem>
                            <Group>
                                <IconCloudUpload size={ 20 }/>
                                <Text>
                                    Upload files and folders dragging them into this window
                                </Text>
                            </Group>
                        </ListItem>
                        <ListItem>
                            <Group>
                                <IconListTree size={ 20 }/>
                                <Text>
                                    Explore the files and folders in the account
                                </Text>
                            </Group>
                        </ListItem>
                        <ListItem>
                            <Group>
                                <IconFile size={ 20 }/>
                                <Text>
                                    Open files with your preferred app
                                </Text>
                            </Group>
                        </ListItem>
                    </List>
                </PageHeader>
                <Grid columns={ 5 } gutter={ "lg" }>
                    <GridCol span={ 5 } key={ "toolbar" }>
                        <Group>
                            <ActionIcon variant={ "outline" }>
                                <IconFolderPlus size={ 20 }/>
                            </ActionIcon>
                            <ActionIcon variant={ "outline" }>
                                <IconFilePlus size={ 20 }/>
                            </ActionIcon>
                            <ActionIcon variant={ "light" } ml={ "auto" }>
                                <IconRefresh size={ 20 }/>
                            </ActionIcon>
                        </Group>
                    </GridCol>
                    {
                        loading && (
                                    <GridCol span={ 5 }>
                                        <Center className={ "p-4" }>
                                            <Loader/>
                                        </Center>
                                    </GridCol>
                                )
                    }
                    {
                        !loading &&
                        objects.map((object, index) => {
                            return (
                                <>
                                    <IntelligentDivider objects={ objects }
                                                        key={ index }
                                                        index={ index }
                                                        object={ object }/>
                                    <MyDriveObjectCard object={ object }
                                                       provider={ provider as StorageProvider }
                                                       owner={ owner as string }
                                                       key={ object.id }
                                                       openWithPreferredApp={ openWithPreferredApp }
                                                       openWithOnlineApp={ openWithOnlineApp }
                                                       openWithNativeApp={ openWithNativeApp }
                                    />
                                </>
                            );
                        })
                    }
                </Grid>
            </div>
            <Dropzone.FullScreen
                active
                onDrop={ (files) => {
                    setUploading(true);
                    setTimeout(() => {
                        if (!uploading) {
                            setModalId(modals.open({
                                size:                "36rem",
                                padding:             "md",
                                closeOnClickOutside: false,
                                withCloseButton:     true,
                                title:               <Title order={ 4 }>Uploading files</Title>,
                                children:            <UploadFiles files={ files }
                                                                  owner={ owner! }
                                                                  provider={ provider! as StorageProvider }
                                                                  setUploading={ setUploading }/>,
                                onClose:             () => setUploading(false),
                            }));
                        }
                    }, 1000);
                } }
                styles={ {
                    root:  {
                        display: "flex",
                    },
                    inner: {
                        flexGrow: 1,
                    },
                } }
            >
                <Stack justify={ "center" }
                       align={ "center" }
                       gap={ "lg" }
                       mih={ "100%" }
                       h={ "100%" }
                       style={ {pointerEvents: "none"} }>
                    <Dropzone.Accept>
                        <IconCloudUpload size={ 52 } color="var(--mantine-color-blue-6)" stroke={ 1.5 }/>
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                        <IconX size={ 52 } color="var(--mantine-color-red-6)" stroke={ 1.5 }/>
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                        <IconCloudUpload size={ 52 } color="var(--mantine-color-dimmed)" stroke={ 1.5 }/>
                    </Dropzone.Idle>

                    <Stack gap={ 5 } align={ "center" }>
                        <Title order={ 2 } className={ "text-center !font-semibold" }>
                            Drag and drop files and folders here
                        </Title>
                        <Text size={ "lg" } c={ "dimmed" } className={ "text-center" }>
                            Attach as many file and folders as you want, we'll take care of the rest
                        </Text>
                    </Stack>
                </Stack>
            </Dropzone.FullScreen>
        </>
    );
}