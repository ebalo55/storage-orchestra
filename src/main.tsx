import React from "react";
import ReactDOM from "react-dom/client";
import {
    BrowserRouter,
    Route,
    Routes,
} from "react-router";
import Dashboard from "./dashboard.tsx";
import Layout from "./layout.tsx";
import Login from "./login.tsx";
import Onboard from "./onboard.tsx";
import {requestNotificationPermission} from "./utility/notification.ts";

requestNotificationPermission().then(()=>console.log("Notification permission granted"));

const root = document.getElementById("root") as HTMLElement;

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path={"/"} element={<Layout/>}>
                    <Route index path={"/vault-access"} element={<Login/>}/>
                    <Route path={"/onboard"} element={<Onboard/>}/>
                    <Route path={"/dashboard"} element={<Dashboard/>}/>
                </Route>
            </Routes>
        </BrowserRouter>
    </React.StrictMode>,
);
