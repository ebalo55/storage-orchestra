import { Card, GridCol, Group, Text, Title } from "@mantine/core";
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
import { path } from "@tauri-apps/api";
import { Channel } from "@tauri-apps/api/core";
import { useContextMenu } from "mantine-contextmenu";
import { Dispatch, FC, SetStateAction, useMemo } from "react";
import classes from "../assets/context-menu.module.css";
import { DOCUMENT_LIKE_MIMES, FOLDER_LIKE_MIMES, MAPPED_MIMES } from "../constants.ts";
import { DriveFile } from "../interfaces/drive-file.ts";
import { TrackableModalInfo } from "../interfaces/trackable-modal-info.ts";
import { GoogleFile, GoogleProvider } from "../providers/google-provider.tsx";
import { Settings, StorageProvider, WatchProcessEvent } from "../tauri-bindings.ts";
import { ModalDownloadFile } from "./modal-download-file.tsx";
import { ModalFileProperties } from "./modal-file-properties.tsx";

type OpenWithPreferredAppSignature = (
    file: GoogleFile,
    provider: StorageProvider,
    owner: string,
    setFolder: Dispatch<SetStateAction<DriveFile[]>>,
    settings?: Settings,
) => Promise<void>;
type openWithOnlineAppSignature = (file: GoogleFile, provider: StorageProvider) => Promise<void>
type openWithNativeAppSignature = (file: GoogleFile, provider: StorageProvider, owner: string) => Promise<void>;

interface MyDriveObjectCardProps {
    object: GoogleFile;
    provider: StorageProvider;
    owner: string;
    settings: Settings | undefined;
    setFolderTree: Dispatch<SetStateAction<DriveFile[]>>,
    openWithPreferredApp: OpenWithPreferredAppSignature;
    openWithOnlineApp: openWithOnlineAppSignature;
    openWithNativeApp: openWithNativeAppSignature;
    folder_tree: DriveFile[];
}

async function downloadFile(file: DriveFile, provider: StorageProvider, owner: string) {
    switch (provider) {
        case "google":
            if (file.mimeType === "application/vnd.google-apps.folder") {
                modals.openContextModal({
                    modal:      "error",
                    title:      <Title order={ 4 }>Error</Title>,
                    innerProps: {
                        modalBody: "Cannot download a folder",
                    },
                });
                return;
            }

            const google = await GoogleProvider.init();
            const extended_file = await google.getFile(owner, file);

            if (!extended_file) {
                throw new Error("Failed to get extended file information");
            }

            const channel = new Channel<WatchProcessEvent>();

            const modal_data: TrackableModalInfo = {
                id:              "download-modal",
                progress:        {
                    current: 0,
                    total:   extended_file.size,
                },
                channel,
                manual_override: {
                    upload: async (_path: string) => {},
                },
                element:         ModalDownloadFile,
            };

            const modal_id = modals.open({
                title:               <Title order={ 4 }>Downloading file</Title>,
                children:            <ModalDownloadFile { ...modal_data }/>,
                closeOnClickOutside: false,
                closeOnEscape:       false,
                withCloseButton:     false,
            });
            modal_data.id = modal_id;

            await google.downloadFile(
                owner,
                file,
                modal_data,
                await path.downloadDir(),
            );

            setTimeout(() => {
                modals.close(modal_id);
            }, 2500);
            break;
    }
}

async function getProperties(file: DriveFile, provider: StorageProvider, owner: string, folder_tree: DriveFile[]) {
    switch (provider) {
        case "google":
            const google = await GoogleProvider.init();
            const extended_file = await google.getFile(owner, file);

            if (!extended_file) {
                throw new Error("Failed to get extended file information");
            }

            modals.open({
                title:    <Title order={ 4 }>Properties</Title>,
                children: <ModalFileProperties file={ extended_file }
                                               owner={ owner }
                                               provider={ google }
                                               folder_tree={ folder_tree }/>,
                size:     "xl",
            });
            break;
    }
}

export const MyDriveObjectCard: FC<MyDriveObjectCardProps> = (
    {
        object,
        provider,
        owner,
        settings,
        setFolderTree,
        openWithPreferredApp,
        openWithOnlineApp,
        openWithNativeApp,
        folder_tree,
    },
) => {
    const Icon = useMemo(() => {
        if (MAPPED_MIMES[object.mimeType]) {
            return MAPPED_MIMES[object.mimeType];
        }

        console.log("Unknown mime type", object.mimeType);
        return IconHelpHexagon;
    }, [ object.mimeType ]);
    const {showContextMenu} = useContextMenu();

    return (
        <GridCol span={ 1 }>
            <Card key={ object.id }
                  className={ "p-4 cursor-pointer select-none" }
                  withBorder
                  title={ object.name }
                  onDoubleClick={ () => openWithPreferredApp(object, provider, owner, setFolderTree, settings) }
                  onContextMenu={ showContextMenu([
                      {
                          key:       "open-with",
                          hidden:    FOLDER_LIKE_MIMES.includes(object.mimeType),
                          icon:      <IconArrowsMove size={ 18 }/>,
                          iconRight: <IconChevronRight size={ 18 }/>,
                          items:     [
                              {
                                  key:     "cloud-app",
                                  hidden:  !DOCUMENT_LIKE_MIMES.includes(object.mimeType),
                                  icon:    <IconCloud size={ 18 }/>,
                                  onClick: () => openWithOnlineApp(object, provider),
                              },
                              {
                                  key:     "native-app",
                                  icon:    <IconCloudDownload size={ 18 }/>,
                                  onClick: () => openWithNativeApp(object, provider, owner),
                              },
                          ],
                      },
                      {key: "divider", hidden: FOLDER_LIKE_MIMES.includes(object.mimeType)},
                      {
                          key:     "download",
                          icon:    <IconDownload size={ 18 }/>,
                          onClick: () => downloadFile(object, provider, owner),
                      },
                      {
                          key:      "rename",
                          disabled: true,
                          icon:     <IconPencil size={ 18 }/>,
                          onClick:  () => console.log("Rename"),
                      },
                      {
                          key:     "share",
                          disabled: true,
                          icon:    <IconUserPlus size={ 18 }/>,
                          onClick: () => console.log("Share"),
                      },
                      {key: "divider-2"},
                      {
                          key:     "properties",
                          icon:    <IconInfoHexagon size={ 18 }/>,
                          onClick: () => getProperties(object, provider, owner, folder_tree),
                      },
                      {
                          key:      "trash",
                          disabled: true,
                          icon:     <IconTrash size={ 18 }/>,
                          color:    "red",
                          onClick:  () => console.log("Trash"),
                      },
                  ], {
                      classNames: {
                          item: classes.contextMenuItem,
                          root: classes.contextMenu,
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