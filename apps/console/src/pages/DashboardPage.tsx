import { Button, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { request } from '../iam-client/request'
import BackendStatus from '../ui/BackendStatus'
import Page from '../ui/Page'
import { ApiError } from '../iam-client/ApiError'
import { clearSession, getAccessToken, getStoredSession, saveSession } from '../iam-client/tokenStore'

function DashboardPage() {
    const showSaved = () => {
        notifications.show({
            title: 'Done',
            message: 'Profile saved',
            color: 'green',
        })
    }

    const testError = async () => {
        try {
            await request('POST', '/api/tenants/signup', { body: {} })
        } catch (error) {
            if (error instanceof ApiError) {
                console.log(error.fieldErrors)
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
                <Button onClick={() => saveSession('fake-access', 'fake-refresh', 'console-1')}>Fake login</Button>
                <Button onClick={() => console.log(getAccessToken(), getStoredSession())}>Show Session</Button>
                <Button onClick={() => clearSession()}>Logout</Button>
            </Group>
        </Page>
    )
}

export default DashboardPage