import { Outlet, Navigate } from "react-router";
import { isLoggedIn } from "../session";

function RequireAnonymous() {
    if (!isLoggedIn) {
        return <Outlet />
    }

    return <Navigate to="/dashboard" replace />
}

export default RequireAnonymous