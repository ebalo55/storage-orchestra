import { Card, GridCol, Group, Text } from "@mantine/core";
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
import { useContextMenu } from "mantine-contextmenu";
import { Dispatch, FC, SetStateAction, useMemo } from "react";
import classes from "../assets/context-menu.module.css";
import { DOCUMENT_LIKE_MIMES, FOLDER_LIKE_MIMES, MAPPED_MIMES } from "../constants.ts";
import { DriveFile } from "../interfaces/drive-file.ts";
import { GoogleFile } from "../providers/google-provider.tsx";
import { Settings, StorageProvider } from "../tauri-bindings.ts";

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
                          onClick: () => console.log("Download"),
                      },
                      {
                          key:     "rename",
                          icon:    <IconPencil size={ 18 }/>,
                          onClick: () => console.log("Rename"),
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
                          onClick: () => console.log("Properties"),
                      },
                      {
                          key:     "trash",
                          icon:    <IconTrash size={ 18 }/>,
                          color:   "red",
                          onClick: () => console.log("Trash"),
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