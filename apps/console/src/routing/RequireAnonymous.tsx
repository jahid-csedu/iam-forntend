import { Outlet, Navigate } from "react-router";
import { useSession } from "../session/SessionContext";

function RequireAnonymous() {
    const { isLoggedIn } = useSession()
    if (!isLoggedIn) {
        return <Outlet />
    }

    return <Navigate to="/dashboard" replace />
}

export default RequireAnonymous