import { Table } from "@mantine/core";
import { FC } from "react";
import { DriveFile } from "../interfaces/drive-file.ts";
import { Provider } from "../interfaces/storage-provider.tsx";
import { ExtendedGoogleFile } from "../providers/google-provider.tsx";
import { dayjs } from "../utility/dayjs.ts";
import { formatByteSize } from "../utility/format-bytesize.ts";

interface ModalFilePropertiesProps {
    file: ExtendedGoogleFile;
    provider: Provider;
    owner: string;
    folder_tree: DriveFile[];
}

export const ModalFileProperties: FC<ModalFilePropertiesProps> = ({file, folder_tree}) => {
    return (
        <Table data={ {
            head: [
                "Property",
                "Value",
            ],
            body: [
                [ "ID", file.id ],
                [ "Name", file.name ],
                [ "Type", file.mimeType ],
                [ "Size", !file.size ? "Unknown" : formatByteSize(BigInt(file.size)) ],
                [ "Owners", file.owners.map(v => v.displayName).join(",") ],
                [ "Shared", file.shared ? "Yes" : "No" ],
                [ "Parents", folder_tree.map(v => v.name === "root" ? "My Drive" : v.name).join(" / ") ],
                [ "Created at", dayjs(file.createdTime).format("YYYY-MM-DD HH:mm:ss") ],
                [ "Last modified at",
                  `${ dayjs(file.modifiedTime)
                      .format("YYYY-MM-DD HH:mm:ss") }, by ${ file.lastModifyingUser.displayName }`,
                ],
            ],
        } }/>
    );
};