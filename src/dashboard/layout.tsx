import {
    AppShell,
    AppShellMain,
    AppShellNavbar,
    AppShellSection,
    Image,
    NavLink,
    ScrollArea,
} from "@mantine/core";
import {
    IconChartCohort,
    IconLayoutDashboard,
    IconServer,
    IconSettings,
} from "@tabler/icons-react";
import {useEffect} from "react";
import {
    Link,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router";
import {ProviderIcon} from "../components/provider-icon.tsx";
import {useProviders} from "../hooks/use-providers.ts";
import {ensureIsAuthenticated} from "../utility/ensure-is-autenticated.ts";

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const providers = useProviders();

    useEffect(() => {
        ensureIsAuthenticated(navigate);
    }, []);

    return (
        <AppShell
            header={{height: 0}}
            navbar={{
                width: 300,
                breakpoint: "sm",
            }}
            padding={"md"}
            layout={"alt"}
        >
            <AppShellNavbar p={"md"}>
                <AppShellSection>
                    <Link to={"/dashboard"}>
                        <Image src={"/logo.svg"}
                               alt={"Storage Orchestra"}
                               mah={"4rem"}
                               fit={"contain"}/>
                    </Link>
                </AppShellSection>
                <AppShellSection grow my={"md"} component={ScrollArea} offsetScrollbars>
                    <NavLink to={"/dashboard"}
                             label={"Dashboard"}
                             leftSection={<IconLayoutDashboard size={20} stroke={1.5}/>}
                             active={location.pathname === "/dashboard"}
                             component={Link}
                    />
                    <NavLink to={"/dashboard/drives"}
                             label={"My drives"}
                             leftSection={<IconServer size={20} stroke={1.5}/>}
                             component={Link}
                             active={location.pathname.startsWith("/dashboard/drives")}>
                        <NavLink to={"/dashboard/drives"}
                                 label={"All my drives"}
                                 leftSection={<IconChartCohort size={20} stroke={1.5}/>}
                                 component={Link}
                                 active={location.pathname === "/dashboard/drives"}/>
                        {
                            providers.map((provider) => (
                                <NavLink to={`/dashboard/drives/${provider.provider}/${provider.owner}`}
                                         key={`${provider.provider}-${provider.owner}`}
                                         label={provider.owner}
                                         leftSection={<ProviderIcon provider={provider.provider}/>}
                                         component={Link}
                                         active={location.pathname === `/dashboard/drives/${provider.provider}/${provider.owner}`}/>
                            ))
                        }
                    </NavLink>
                    <NavLink to={"/dashboard/settings"}
                             label={"Settings"}
                             leftSection={<IconSettings size={20} stroke={1.5}/>}
                             active={location.pathname === "/dashboard/settings"}
                             component={Link}/>
                </AppShellSection>
            </AppShellNavbar>
            <AppShellMain>
                <Outlet/>
            </AppShellMain>
        </AppShell>
    );
}

