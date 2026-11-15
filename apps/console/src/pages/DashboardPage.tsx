import { Button, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { request } from '../iam-client/request'
import BackendStatus from '../ui/BackendStatus'
import Page from '../ui/Page'
import { ApiError } from '../iam-client/ApiError'
import { getAccessToken, getStoredSession } from '../iam-client/tokenStore'
import { useSession } from '../session/SessionContext'

function DashboardPage() {
    const { logout } = useSession()
    const showSaved = () => {
        notifications.show({
            title: 'Done',
            message: 'Profile saved',
            color: 'green',
        })
    }

    const testError = async () => {
        try {
            await request('GET', '/api/me')
        } catch (error) {
            if (error instanceof ApiError) {
                console.log(error.fieldErrors)
                notifications.show({
                    color: "red",
                    title: error.title,
                    message: error.message
                })
            }
        }
    }

    return (
        <Page title="Dashboard">
            <Text c="dimmed">Welcome to the IAM Console</Text>
            <BackendStatus />
            <Group mt="md">
                <Button onClick={showSaved}>Save</Button>
                <Button color="red" onClick={testError}>Test error</Button>
                <Button onClick={() => console.log(getAccessToken(), getStoredSession())}>Show Session</Button>
                <Button onClick={logout}>Logout</Button>
            </Group>
        </Page>
    )
}

export default DashboardPage