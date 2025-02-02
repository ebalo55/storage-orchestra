// The size of a kilobyte
const KILOBYTE: bigint = 1024n;
// The size of a megabyte
const MEGABYTE: bigint = 1024n * KILOBYTE;
// The size of a gigabyte
const GIGABYTE: bigint = 1024n * MEGABYTE;

/**
 * Format a byte size into a human-readable string
 *
 * @param size - The size in bytes
 * @returns A human-readable string representing the size
 */
export function formatByteSize(size: bigint): string {
    // The scaling factor to represent 2 decimal places after the comma
    const scaling_factor = 1_00n;
    if (size < KILOBYTE) {
        return `${size} B`;
    }
    else if (size < MEGABYTE) {
        return `${(
            Number(size * scaling_factor / KILOBYTE) / Number(scaling_factor)
        ).toFixed(2)} KB`;
    }
    else if (size < GIGABYTE) {
        return `${(
            Number(size * scaling_factor / MEGABYTE) / Number(scaling_factor)
        ).toFixed(2)} MB`;
    }

    return `${(
        Number(size * scaling_factor / GIGABYTE) / Number(scaling_factor)
    ).toFixed(2)} GB`;
}