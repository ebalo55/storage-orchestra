import {useEffect} from "react";
import {useNavigate} from "react-router";
import {ensureIsAuthenticated} from "./utility/ensure-is-autenticated.ts";

export default function Dashboard() {
    const navigate = useNavigate();

    useEffect(() => {
        ensureIsAuthenticated(navigate);
    }, []);

    return (
        <>Dashboard page</>
    );
}

