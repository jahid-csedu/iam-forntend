import { Navigate, Outlet, useLocation } from 'react-router'
import { isLoggedIn } from '../session'

function RequireAuth() {
    const location = useLocation()

    if(!isLoggedIn) {
        const wanted = location.pathname + location.search
        return <Navigate to={`/login?returnTo=${encodeURIComponent(wanted)}`} replace />
    }

    return <Outlet />
}

export default RequireAuth