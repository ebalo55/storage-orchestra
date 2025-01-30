import {
    isPermissionGranted,
    requestPermission,
} from "@tauri-apps/plugin-notification";

export async function requestNotificationPermission() {
    let permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
        await requestPermission();
    }
}