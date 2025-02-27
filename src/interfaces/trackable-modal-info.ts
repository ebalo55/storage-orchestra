import { Channel } from "@tauri-apps/api/core";
import { FC } from "react";
import { WatchProcessEvent } from "../tauri-bindings.ts";

/**
 * Represents the information of a trackable modal.
 */
export interface TrackableModalInfo {
    id: string,
    progress: {
        total: number,
        current: number,
    }
    channel: Channel<WatchProcessEvent>
    manual_override: {
        path?: string,
        upload: (path: string) => Promise<void>
    }
    element?: FC<Omit<TrackableModalInfo, "id"> & {
        id?: string
    }>
}