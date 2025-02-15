import { Card, Center, Grid, GridCol, Group, Loader, Text } from "@mantine/core";
import {
    IconArrowsMove,
    IconBinary,
    IconChevronRight,
    IconCloud,
    IconCloudDownload,
    IconDownload,
    IconFileText,
    IconFileTypePdf,
    IconFileZip,
    IconFolder,
    IconFolderSymlink,
    IconHelpHexagon,
    IconInfoHexagon,
    IconMusic,
    IconPencil,
    IconPresentation,
    IconProps,
    IconTableFilled,
    IconTrash,
    IconUserPlus,
} from "@tabler/icons-react";
import { useContextMenu } from "mantine-contextmenu";
import { title } from "radash";
import { Dispatch, ExoticComponent, FC, SetStateAction, useEffect, useState } from "react";
import { useParams } from "react-router";
import classes from "../../assets/context-menu.module.css";
import { PageHeader } from "../../components/page-header.tsx";
import { StorageProvider } from "../../tauri-bindings.ts";
import { GoogleFile, GoogleOAuth } from "../../utility/google-auth.ts";

const MAPPED_MIMES: {
    [key: string]: ExoticComponent<IconProps>
} = {
    "application/vnd.google-apps.folder":                                      IconFolder,
    "application/vnd.google-apps.shortcut":                                    IconFolderSymlink,
    "application/vnd.google-apps.spreadsheet":                                 IconTableFilled,
    "application/vnd.google-apps.document":                                    IconFileText,
    "application/vnd.google-apps.presentation":                                IconPresentation,
    "audio/mpeg":                                                              IconMusic,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": IconFileText,
    "application/pdf":                                                         IconFileTypePdf,
    "application/x-zip-compressed":                                            IconFileZip,
    "application/zip":                                                         IconFileZip,
    "application/octet-stream":                                                IconBinary,
};

/**
 * Load files from Google Drive
 * @param {string} owner
 * @param {React.Dispatch<React.SetStateAction<GoogleFile[]>>} setObjects
 * @returns {Promise<void>}
 */
async function loadGoogleFiles(owner: string, setObjects: Dispatch<SetStateAction<GoogleFile[]>>) {
    const google = await GoogleOAuth.init();
    let files = await google.listFiles(owner);

    setObjects(files.files);
    while (files.nextPageToken) {
        files = await google.listFiles(owner, files.nextPageToken);
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

const ObjectCard: FC<{
    object: GoogleFile
}> = ({object}) => {
    const Icon = MAPPED_MIMES[object.mimeType] || IconHelpHexagon;
    const {showContextMenu} = useContextMenu();

    return (
        <GridCol span={ 1 }>
            <Card key={ object.id }
                  className={ "p-4 cursor-pointer" }
                  withBorder
                  title={ object.name }
                  onContextMenu={ showContextMenu([
                      {
                          key:       "open-with",
                          icon:      <IconArrowsMove size={ 18 }/>,
                          iconRight: <IconChevronRight size={ 18 }/>,
                          items:     [
                              {
                                  key:     "cloud-editor",
                                  icon:    <IconCloud size={ 18 }/>,
                                  onClick: () => console.log("Open with online editor"),
                              },
                              {
                                  key:     "native-editor",
                                  icon:    <IconCloudDownload size={ 18 }/>,
                                  onClick: () => console.log("Open with native editor"),
                              },
                          ],
                      },
                      {key: "divider"},
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
                          icon:    <IconUserPlus size={ 18 }/>,
                          onClick: () => console.log("Share"),
                      },
                      {key: "divider"},
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
                    !loading && objects.map(object => <ObjectCard object={ object } key={ object.id }/>)
                }
            </Grid>
        </div>
    );
}