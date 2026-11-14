import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { request } from '../iam-client/request'
import BackendStatus from '../ui/BackendStatus'
import Page from '../ui/Page'
import { ApiError } from '../iam-client/ApiError'

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
            <Button mt="md" onClick={showSaved}>
                Save
            </Button>
            <Button mt="md" color="red" onClick={testError}>Test error</Button>
        </Page>
    )
}

export default DashboardPage