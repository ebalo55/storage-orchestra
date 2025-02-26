import { Progress, Stack, Text } from "@mantine/core";
import { FileWithPath } from "@mantine/dropzone";
import { all } from "radash";
import { Dispatch, FC, SetStateAction, useEffect, useMemo, useState } from "react";
import { Provider } from "../interfaces/storage-provider.ts";
import { GoogleProvider } from "../providers/google-provider.tsx";
import { StorageProvider } from "../tauri-bindings.ts";

interface UploadFilesProps {
    files: FileWithPath[];
    owner: string;
    provider: StorageProvider;
    setUploading: Dispatch<SetStateAction<boolean>>;
}

let uploading = false;

async function upload(
    files: FileWithPath[],
    owner: string,
    provider: StorageProvider,
    setUploadedFiles: Dispatch<SetStateAction<number>>,
    setUploading: Dispatch<SetStateAction<boolean>>,
) {
    if (uploading) {
        return;
    }
    uploading = true;

    const make_promise = (prov: Provider) => all(files.map((file) => prov.uploadFiles(
        owner,
        file,
        setUploadedFiles,
        "root",
    )));

    switch (provider) {
        case "google":
            const google = await GoogleProvider.init();
            await make_promise(google);
            break;
        default:
            throw new Error("Unsupported provider");
    }
    uploading = false;
    setTimeout(() => setUploading(false), 1000);
}

export const UploadFiles: FC<UploadFilesProps> = (props) => {
    const [ uploaded_files, setUploadedFiles ] = useState<number>(0);

    const progress = useMemo(() => uploaded_files * 100 / props.files.length, [ uploaded_files, props.files.length ]);

    useEffect(() => {
        console.log("Uploading files", props.files);
        upload(props.files, props.owner, props.provider, setUploadedFiles, props.setUploading)
            .then(() => console.log("Upload completed"));
    }, []);

    return (
        <Stack gap={ "sm" } align={ "center" } justify={ "center" } className={ "p-4" }>
            <Text size={ "lg" }>Uploading { props.files.length } files</Text>

            <Stack gap={ 0 } className={ "w-full" }>
                <Text size={ "xs" } ml={ "auto" } c={ "dimmed" }>{ uploaded_files } / { props.files.length }</Text>
                <Progress value={ progress } animated className={ "w-full" }/>
            </Stack>
        </Stack>
    );
};