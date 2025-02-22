import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import DrivesIndex from "./dashboard/drives";
import DrivesProviderOwner from "./dashboard/drives/provider-owner.tsx";
import Home from "./dashboard/home.tsx";
import DashboardLayout from "./dashboard/layout.tsx";
import Settings from "./dashboard/settings.tsx";
import Error from "./error.tsx";
import { ThemeProvider } from "./hooks/use-theme.tsx";
import Layout from "./layout.tsx";
import Login from "./login.tsx";
import Onboard from "./onboard.tsx";
import { requestNotificationPermission } from "./utility/notification.ts";
import "./utility/dayjs.ts";

requestNotificationPermission().then(() => console.log("Notification permission granted"));

const root = document.getElementById("root") as HTMLElement;

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    <Route path={ "/" } element={ <Layout/> }>
                        <Route path={ "login" } element={ <Login/> }/>
                        <Route path={ "onboard" } element={ <Onboard/> }/>
                        <Route path={ "error" } element={ <Error/> }/>

                        <Route path={ "dashboard" } element={ <DashboardLayout/> }>
                            <Route index element={ <Home/> }/>
                            <Route path={ "drives" }>
                                <Route index element={ <DrivesIndex/> }/>
                                <Route path={ ":provider/:owner" } element={ <DrivesProviderOwner/> }/>
                            </Route>
                            <Route path={ "settings" } element={ <Settings/> }/>
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    </React.StrictMode>,
);
