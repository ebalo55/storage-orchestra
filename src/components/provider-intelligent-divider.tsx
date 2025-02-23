import { Divider, GridCol } from "@mantine/core";
import { signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { FC, useEffect } from "react";
import { FOLDER_LIKE_MIMES } from "../constants.ts";
import { GoogleFile } from "../providers/google-provider.tsx";

const should_show_divider = signal<boolean[]>([]);
export const IntelligentDivider: FC<{
    objects: GoogleFile[],
    index: number,
    object: GoogleFile,
}> = (props) => {
    useSignals();

    useEffect(() => {
        should_show_divider.value = Array.from({length: props.objects.length}, () => true);
    }, [ props.objects.length ]);

    // If the files divider has already been placed, don't place it again
    if (!should_show_divider.value[props.index]) {
        return null;
    }

    // Show the folders divider if the current object is a folder-like object and it's the first one (folders are always
    // first)
    if (FOLDER_LIKE_MIMES.includes(props.object.mimeType) && props.index === 0) {
        return (
            <GridCol span={ 5 }>
                <Divider label={ "Folders" } labelPosition={ "left" }/>
            </GridCol>
        );
    }

    // Show the divider if the previous object was a folder-like object and the current
    // one is not or if the current object is not a folder-like object and it's the
    // first one
    if ((
            !FOLDER_LIKE_MIMES.includes(props.object.mimeType) && props.index > 0 &&
            FOLDER_LIKE_MIMES.includes(props.objects.at(props.index - 1)!.mimeType)
        ) || (
            !FOLDER_LIKE_MIMES.includes(props.object.mimeType) && props.index === 0
        )) {
        // Hide all dividers after this one
        if (props.index + 1 < props.objects.length) {
            for (let i = props.index + 1; i < props.objects.length; i++) {
                should_show_divider.value[i] = false;
            }
        }
        return (
            <GridCol span={ 5 }>
                <Divider label={ "Files" } labelPosition={ "left" }/>
            </GridCol>
        );
    }

    return null;
};