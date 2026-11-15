import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../session/SessionContext'

function RequireAuth() {
    const location = useLocation()
    const { isLoggedIn } = useSession()

    if (!isLoggedIn) {
        const wanted = location.pathname + location.search
        return <Navigate to={`/login?returnTo=${encodeURIComponent(wanted)}`} replace />
    }

    return <Outlet />
}

export default RequireAuth