/**
 * Represents the information of a trackable modal.
 */
export interface TrackableModalInfo {
    id: string,
    progress: {
        total: number,
        current: number,
    }
}