import { Navigate, Outlet } from 'react-router'
import { isLoggedIn } from '../session'

function RequireAuth() {
    if(!isLoggedIn) {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}

export default RequireAuth