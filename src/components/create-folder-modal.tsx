import { Button, Kbd, Loader, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconFolderPlus } from "@tabler/icons-react";
import { yupResolver } from "mantine-form-yup-resolver";
import { Dispatch, FC, SetStateAction, useState } from "react";
import * as yup from "yup";
import { GoogleProvider } from "../providers/google-provider.tsx";
import { StorageProvider } from "../tauri-bindings.ts";

interface CreateFolderModalProps {
    provider: StorageProvider,
    owner: string,
    refresh: () => Promise<void>,
    parent: string,
}

async function createFolder(
    provider: StorageProvider,
    owner: string,
    path: string,
    parent: string,
    setLoading: Dispatch<SetStateAction<boolean>>,
    refresh: () => Promise<void>,
) {
    setLoading(true);
    const path_fragments = path.split("/").filter((part) => part.length > 0);
    console.log("Creating folder(s)", path_fragments);

    switch (provider) {
        case "google":
            const google = await GoogleProvider.init();
            for (const fragment of path_fragments) {
                const created_folder = await google.createFolder(owner, parent, fragment);
                if (!created_folder) {
                    console.error("Error creating folder", fragment);
                    setLoading(false);
                    return;
                }
                parent = created_folder.id;
            }
            break;
    }

    await refresh();
    setLoading(false);
}

export const CreateFolderModal: FC<CreateFolderModalProps> = ({provider, owner, refresh, parent}) => {
    const [ loading, setLoading ] = useState(false);
    const form = useForm({
        initialValues: {
            path: "",
        },
        validate:      yupResolver(yup.object({
            path: yup.string().required().min(1).matches(/^[A-Za-z0-9\-_.\[\]*/+= ]+$/, {message: "Invalid path"}),
        })),
    });

    return (
        <form className={ "p-4" }
              onSubmit={ form.onSubmit((values) => createFolder(
                  provider,
                  owner,
                  values.path,
                  parent,
                  setLoading,
                  refresh,
              )) }>
            {
                !loading && (
                             <Stack>
                                 <TextInput label={ "Folder name" }
                                            description={ <>
                                                <Text size={ "xs" }>
                                                    Folder name must be valid thus contain letters, numbers, space and optionally one
                                                    or
                                                    more
                                                    of the following characters <Kbd>-_.[]*/+=</Kbd>.
                                                </Text>
                                                <Text size={ "xs" }>
                                                    Nested folders can be created by separating the folder names with a <Kbd>/</Kbd>.
                                                </Text>
                                            </> }
                                            placeholder={ "example/folder/name" }
                                            { ...form.getInputProps("path") } />
                                 <Button type={ "submit" }
                                         leftSection={ <IconFolderPlus size={ 20 }/> }
                                         className={ "ml-auto" }
                                         variant={ "light" }>
                                     Create folder
                                 </Button>
                             </Stack>
                         )
            }
            {
                loading && (
                            <Stack align={ "center" } justify={ "center" }>
                                <Loader/>
                                <Text>
                                    Creating folder...
                                </Text>
                            </Stack>
                        )
            }
        </form>
    );
};