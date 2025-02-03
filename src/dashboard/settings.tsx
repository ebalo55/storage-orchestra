import { Card, Divider, Stack, Tabs, TabsList, TabsPanel, TabsTab, Text, Title } from "@mantine/core";
import { IconServer, IconSettings, IconShield } from "@tabler/icons-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "../components/page-header.tsx";
import { DefaultPage } from "../components/settings/general/general-behaviour/default-page.tsx";
import { FontSize } from "../components/settings/general/theme/font-size.tsx";
import { Theme } from "../components/settings/general/theme/theme.tsx";
import { useSettings } from "../hooks/use-settings.ts";
import { commands, SettingsResult } from "../tauri-bindings.ts";

/**
 * Save the updated settings to the backend and refresh the settings
 * @param {SettingsResult} updated_value
 * @param {() => Promise<void>} refreshSettings
 * @returns {Promise<void>}
 */
async function updateSettings(updated_value: SettingsResult, refreshSettings: () => Promise<void>) {
    await commands.updateSettings(updated_value);
    await refreshSettings();
}

export default function Settings() {
    const [ search_params ] = useSearchParams();

    const requested_page = useMemo(() => {
        const page = search_params.get("page");

        // if the page is not set or is not a valid page, default to "general"
        if (!page || ![ "general", "providers", "security" ].includes(page)) {
            return "general";
        }

        return page;
    }, [ search_params ]);

    const {settings, refreshSettings} = useSettings();

    return (
        <div className={ "p-8" }>
            <PageHeader title={ "Settings" }>
                <Text>
                    The settings is where you can configure the application to your liking, many settings are available
                    to customize most of the application's behavior.
                </Text>
                <Text>
                    These are divided into categories, each category contains a set of settings that are related
                    to each other, for example, the "General" category contains settings that are related to the general
                    behavior of the application.
                </Text>
                <Text>
                    Settings are saved automatically when changed, so you don't have to worry about losing your
                    settings when you close the application.
                </Text>
            </PageHeader>
            <Tabs variant="outline" radius="md" defaultValue={ requested_page }>
                <TabsList>
                    <TabsTab value="general" leftSection={ <IconSettings size={ 16 }/> }>
                        General
                    </TabsTab>
                    <TabsTab value="providers" leftSection={ <IconServer size={ 16 }/> }>
                        Providers
                    </TabsTab>
                    <TabsTab value="security" leftSection={ <IconShield size={ 16 }/> }>
                        Security
                    </TabsTab>
                </TabsList>

                <TabsPanel value="general" className={ "p-4" }>
                    <Stack gap={ "lg" }>
                        <Card withBorder>
                            <Title order={ 4 }>
                                Theme
                            </Title>
                            <Stack mt={ "md" } gap={ "lg" }>
                                <Theme settings={ settings }
                                       refreshSettings={ refreshSettings }
                                       updateSettings={ updateSettings }/>
                                <Divider/>
                                <FontSize settings={ settings }
                                          refreshSettings={ refreshSettings }
                                          updateSettings={ updateSettings }/>
                            </Stack>
                        </Card>
                        <Card withBorder>
                            <Title order={ 4 }>
                                General behaviour
                            </Title>
                            <Stack mt={ "md" } gap={ "lg" }>
                                <DefaultPage settings={ settings }
                                             refreshSettings={ refreshSettings }
                                             updateSettings={ updateSettings }/>
                            </Stack>
                        </Card>
                    </Stack>
                </TabsPanel>

                <TabsPanel value="providers" className={ "p-4" }>
                    Providers tab content
                </TabsPanel>

                <TabsPanel value="security" className={ "p-4" }>
                    Security tab content
                </TabsPanel>
            </Tabs>
        </div>
    );
}