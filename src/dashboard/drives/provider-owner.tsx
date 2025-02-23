import { Card, Center, Grid, GridCol, Group, Loader, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
    IconArrowsMove,
    IconChevronRight,
    IconCloud,
    IconCloudDownload,
    IconDownload,
    IconHelpHexagon,
    IconInfoHexagon,
    IconPencil,
    IconTrash,
    IconUserPlus,
} from "@tabler/icons-react";
import { Channel } from "@tauri-apps/api/core";
import { BaseDirectory, remove } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useContextMenu } from "mantine-contextmenu";
import { title } from "radash";
import { Dispatch, FC, SetStateAction, useEffect, useState } from "react";
import { useParams } from "react-router";
import classes from "../../assets/context-menu.module.css";
import { OpenWithNativeAppModal } from "../../components/open-with-native-app-modal.tsx";
import { PageHeader } from "../../components/page-header.tsx";
import { IntelligentDivider } from "../../components/provider-intelligent-divider.tsx";
import { DOCUMENT_LIKE_MIMES, FOLDER_LIKE_MIMES, MAPPED_MIMES } from "../../constants.ts";
import { useSettings } from "../../hooks/use-settings.ts";
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
                size:     "36rem",
                padding:  "md",
                closeOnClickOutside: false,
                withCloseButton:     false,
                title:    <Title order={ 4 }>Opening '{ file.name }'</Title>,
                children:            <OpenWithNativeAppModal progress={ {current: 0, total: extended_file.size} }
                                                             channel={ modal_channel }
                                                             manual_override={ {
                                                                 upload: async (_path: string) => {},
                                                             } }
                                     />,
            });
            const modal_data = {
                id:       modal_id,
                progress: {
                    total:   extended_file.size,
                    current: 0,
                },
                channel:         modal_channel,
                manual_override: {
                    upload: async (path: string) => {
                        await google.uploadFile(owner, path, modal_data, file);

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

            // TODO: File upload should handle updating a file already in the drive instead of always creating a new one
            await google.uploadFile(owner, updated_content.data, modal_data, file);

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

const ObjectCard: FC<{
    object: GoogleFile,
    provider: StorageProvider,
    owner: string,
}> = ({object, provider, owner}) => {
    const Icon = MAPPED_MIMES[object.mimeType] || IconHelpHexagon;
    const {showContextMenu} = useContextMenu();
    const {settings} = useSettings();

    return (
        <GridCol span={ 1 }>
            <Card key={ object.id }
                  className={ "p-4 cursor-pointer select-none" }
                  withBorder
                  title={ object.name }
                  onDoubleClick={ () => openWithPreferredApp(object, provider, owner, settings) }
                  onContextMenu={ showContextMenu([
                      {
                          key:       "open-with",
                          hidden:    FOLDER_LIKE_MIMES.includes(object.mimeType),
                          icon:      <IconArrowsMove size={ 18 }/>,
                          iconRight: <IconChevronRight size={ 18 }/>,
                          items:     [
                              {
                                  key:    "cloud-app",
                                  hidden: !DOCUMENT_LIKE_MIMES.includes(object.mimeType),
                                  icon:   <IconCloud size={ 18 }/>,
                                  onClick: () => openWithOnlineApp(object, provider),
                              },
                              {
                                  key:  "native-app",
                                  icon: <IconCloudDownload size={ 18 }/>,
                                  onClick: () => openWithNativeApp(object, provider, owner),
                              },
                          ],
                      },
                      {key: "divider", hidden: FOLDER_LIKE_MIMES.includes(object.mimeType)},
                      {
                          key:  "download",
                          icon: <IconDownload size={ 18 }/>,
                          onClick: () => console.log("Download"),
                      },
                      {
                          key:  "rename",
                          icon: <IconPencil size={ 18 }/>,
                          onClick: () => console.log("Rename"),
                      },
                      {
                          key:  "share",
                          icon: <IconUserPlus size={ 18 }/>,
                          onClick: () => console.log("Share"),
                      },
                      {key: "divider-2"},
                      {
                          key:  "properties",
                          icon: <IconInfoHexagon size={ 18 }/>,
                          onClick: () => console.log("Properties"),
                      },
                      {
                          key:   "trash",
                          icon:  <IconTrash size={ 18 }/>,
                          color: "red",
                          onClick: () => console.log("Trash"),
                      },
                  ], {
                      classNames: {
                          item: classes.contextMenuItem,
                      },
                  }) }
            >
                <Group wrap={ "nowrap" }>
                    <Icon size={ 24 } style={ {flexShrink: "0"} }/>
                    <Text truncate>{ object.name }</Text>
                </Group>
            </Card>
        </GridCol>
    );
};

export default function DrivesProviderOwner() {
    const {provider, owner} = useParams();
    const [ objects, setObjects ] = useState<GoogleFile[]>([]);
    const [ loading, setLoading ] = useState(true);

    useEffect(() => {
        if (!provider || !owner) {
            return;
        }

        loadFiles(provider as StorageProvider, owner, setObjects, setLoading).then(() => console.log("Files fetched"));
    }, [ owner, provider ]);

    return (
        <div className={ "p-8" }>
            <PageHeader title={ `${ title(provider) }'s ${ owner } account` }>
                <Text>
                    This page shows the files and folders in the { title(provider) } account owned by { owner }.
                </Text>
                <Text>
                    You can view and manage these files and folders here like you would in the { title(provider) } web
                    app.
                </Text>
            </PageHeader>
            <Grid columns={ 5 } gutter={ "lg" }>
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
                                <ObjectCard object={ object }
                                            provider={ provider as StorageProvider }
                                            owner={ owner as string }
                                            key={ object.id }/>
                            </>
                        );
                    })
                }
            </Grid>
        </div>
    );
}