import {
    Button,
    Card,
    Group,
    Loader,
    ProgressLabel,
    ProgressRoot,
    ProgressSection,
    Stack,
    Text,
    Tooltip,
} from "@mantine/core";
import { fetch } from "@tauri-apps/plugin-http";
import querystring from "query-string";
import { all, unique } from "radash";
import { Dispatch, FC, SetStateAction, useEffect, useState } from "react";
import { Link } from "react-router";
import { PageHeader } from "../components/page-header.tsx";
import { ProviderIcon } from "../components/provider-icon.tsx";
import { useProviders } from "../hooks/use-providers.ts";
import { commands, ProviderData, StorageProvider } from "../tauri-bindings.ts";
import { dayjs } from "../utility/dayjs.ts";
import { formatByteSize } from "../utility/format-bytesize.ts";
import { GoogleOAuth } from "../utility/google-auth.ts";

interface ProviderStats {
    /**
     * The provider of the storage.
     */
    provider: StorageProvider;
    /**
     * The owner of the storage.
     */
    owner: string;
    /**
     * The total available storage.
     */
    available: bigint;
    /**
     * The used storage.
     */
    used: {
        /**
         * The storage used by documents.
         */
        documents: bigint
        /**
         * The storage used by other things.
         */
        other: bigint
    };
    /**
     * The free storage.
     */
    free: bigint;
    /**
     * Represents the storage in a human-readable format.
     */
    textual: {
        /**
         * The total available storage.
         */
        available: string
        /**
         * The used storage.
         */
        used: {
            /**
             * The storage used by documents.
             */
            documents: string
            /**
             * The storage used by other things.
             */
            other: string
        }
        /**
         * The free storage.
         */
        free: string
    };
    /**
     * The quota usages in percent out of the total available storage.
     */
    quotas: {
        /**
         * The quota usage by documents.
         */
        documents: number
        /**
         * The quota usage by other things.
         */
        others: number
        /**
         * The free quota.
         */
        free: number
    };
}

async function fetchGoogleStats(provider: ProviderData): Promise<ProviderStats | undefined> {
    const now = dayjs.utc().unix();

    if (provider.expiry <= now) {
        const google_oauth = await GoogleOAuth.init();
        const updated_provider = await google_oauth.refresh(provider);
        if (updated_provider) {
            console.log("Successfully refreshed Google OAuth token for provider", provider.owner);
            provider = updated_provider;
        }
        else {
            console.error("Failed to refresh Google OAuth token for provider", provider.owner);
            return;
        }
    }

    const access_token = await commands.cryptDataGetRawDataAsString(provider.access_token);
    if (access_token.status === "error") {
        console.error("Failed to decrypt Google OAuth access token for provider", provider.owner);
        return;
    }

    const response = await fetch("https://www.googleapis.com/drive/v3/about?" + querystring.stringify({
        fields: "storageQuota",
    }), {
        headers: {
            Authorization: `Bearer ${ access_token.data }`,
        },
    });

    if (!response.ok) {
        console.error(
            "Failed to fetch Google Drive stats for provider",
            provider.owner,
            "with status",
            response.status,
            "and message",
            await response.json(),
        );
        return;
    }

    const data = await response.json();

    const available = BigInt(data.storageQuota.limit as string);
    const used = BigInt(data.storageQuota.usageInDrive as string);
    const free = available - used;
    const used_for_other = available - (
        free + used
    );

    // scale the values to percentage (100) with 2 decimal points (00) needed to represent the percentage
    const scaling_factor = 100_00n;

    const result = {
        provider: "google",
        owner:    provider.owner,
        available,
        used:     {
            documents: used,
            other:     used_for_other,
        },
        free,
        textual:  {
            available: formatByteSize(available),
            used:      {
                documents: formatByteSize(used),
                other:     formatByteSize(used_for_other),
            },
            free:      formatByteSize(free),
        },
        quotas:   {
            documents: +(
                Number(used * scaling_factor / available) / 100
            ).toFixed(2),
            others:    +(
                Number(used_for_other * scaling_factor / available) / 100
            ).toFixed(2),
            free:      +(
                Number(free * scaling_factor / available) / 100
            ).toFixed(2),
        },
    } as ProviderStats;

    console.log(
        "Google Drive stats for provider",
        provider.owner,
        "are",
        result,
    );

    return result;
}

async function fetchStats(provider: ProviderData): Promise<ProviderStats | undefined> {
    switch (provider.provider) {
        case "google":
            return fetchGoogleStats(provider);
    }
}

function fetchAllStats(
    providers: ProviderData[],
    setStats: Dispatch<SetStateAction<ProviderStats[]>>,
    setLoading: Dispatch<SetStateAction<boolean>>,
) {
    setLoading(true);
    all(providers.map((v) => fetchStats(v).then((p) => setStats((prev) => {
        if (p) {
            return unique([ ...prev, p ], (i) => `${ i.provider }-${ i.owner }`);
        }
        return prev;
    })))).then(() => {
        console.log("All stats fetched");
        setLoading(false);
    });
}

const StatCard: FC<{
    stat: ProviderStats
}> = ({stat}) => (
    <Card withBorder shadow={ "md" }>
        <Stack>
            <Group>
                <ProviderIcon provider={ stat.provider }/>
                <Text size={ "sm" }>
                    { stat.owner }
                </Text>
                <Button size={ "xs" }
                        variant={ "light" }
                        ml={ "auto" }
                        component={ Link }
                        to={ `/dashboard/drives/${ stat.provider }/${ stat.owner }` }>
                    Open
                </Button>
            </Group>
            <Stack gap={ 5 }>
                <ProgressRoot size={ "xl" }>
                    <Tooltip label={ `In use - ${ stat.textual.used.documents }` }
                             withArrow
                             arrowSize={ 8 }
                             arrowRadius={ 4 }>
                        <ProgressSection value={ stat.quotas.documents }
                                         color={ "blue.4" }
                                         darkHidden>
                            <ProgressLabel>
                                In use - { stat.quotas.documents }%
                            </ProgressLabel>
                        </ProgressSection>
                    </Tooltip>
                    <Tooltip label={ `In use - ${ stat.textual.used.documents }` }
                             withArrow
                             arrowSize={ 8 }
                             arrowRadius={ 4 }>
                        <ProgressSection value={ stat.quotas.documents }
                                         color={ "blue.9" }
                                         lightHidden>
                            <ProgressLabel>
                                In use - { stat.quotas.documents }%
                            </ProgressLabel>
                        </ProgressSection>
                    </Tooltip>

                    <Tooltip label={ `Other - ${ stat.textual.used.other }` }
                             withArrow
                             arrowSize={ 8 }
                             arrowRadius={ 4 }>
                        <ProgressSection value={ stat.quotas.others } color={ "orange.4" } darkHidden>
                            <ProgressLabel>
                                Other - { stat.quotas.others }%
                            </ProgressLabel>
                        </ProgressSection>
                    </Tooltip>
                    <Tooltip label={ `Other - ${ stat.textual.used.other }` }
                             withArrow
                             arrowSize={ 8 }
                             arrowRadius={ 4 }>
                        <ProgressSection value={ stat.quotas.others } color={ "orange.9" } lightHidden>
                            <ProgressLabel>
                                Other - { stat.quotas.others }%
                            </ProgressLabel>
                        </ProgressSection>
                    </Tooltip>

                    <Tooltip label={ `Free - ${ stat.textual.free }` }
                             withArrow
                             arrowSize={ 8 }
                             arrowRadius={ 4 }>
                        <ProgressSection value={ stat.quotas.free } color={ "gray.2" } darkHidden>
                            <ProgressLabel c={ "dark" }>
                                Free - { stat.quotas.free }%
                            </ProgressLabel>
                        </ProgressSection>
                    </Tooltip>
                    <Tooltip label={ `Free - ${ stat.textual.free }` }
                             withArrow
                             arrowSize={ 8 }
                             arrowRadius={ 4 }>
                        <ProgressSection value={ stat.quotas.free } color={ "dark.4" } lightHidden>
                            <ProgressLabel c={ "gray.4" }>
                                Free - { stat.quotas.free }%
                            </ProgressLabel>
                        </ProgressSection>
                    </Tooltip>
                </ProgressRoot>
                <Text size={ "xs" } className={ "font-semibold tabular-nums" } ml={ "auto" }>
                    { stat.textual.available }
                </Text>
            </Stack>
        </Stack>
    </Card>
);

export default function Home() {
    const providers = useProviders();
    const [ stats, setStats ] = useState<ProviderStats[]>([]);
    const [ loading, setLoading ] = useState<boolean>(true);

    useEffect(() => {
        fetchAllStats(providers, setStats, setLoading);
    }, [ providers ]);

    return (
        <div className={ "p-8" }>
            <PageHeader title={ "Dashboard" }>
                <Text>
                    The dashboard is the place where you can see the status of all your connected cloud storage
                    providers with their respective usage statistics.
                </Text>
                <Text>
                    Please note that the statistics are fetched from your cloud storage providers, recent
                    modifications might not be reflected immediately.
                </Text>
            </PageHeader>
            <Stack>
                {
                    stats.length === 0 && !loading && (
                                     <Stack align={ "center" } justify={ "center" }>
                                         <Text size={ "sm" } fw={ 600 } className={ "text-center" }>
                                             No storage providers connected.<br/>
                                             Please connect a storage provider to see the statistics.
                                         </Text>
                                         <Button component={ Link } to={ "/dashboard/settings?page=providers" } variant={ "light" }>
                                             Connect a storage provider
                                         </Button>
                                     </Stack>
                                 )
                }
                {
                    loading && (
                                <Stack align={ "center" } justify={ "center" }>
                                    <Text>
                                        Loading storage statistics...
                                    </Text>
                                    <Loader/>
                                </Stack>
                            )
                }
                {
                    stats.map((stat) => <StatCard stat={ stat }/>)
                }
            </Stack>
        </div>
    );
}