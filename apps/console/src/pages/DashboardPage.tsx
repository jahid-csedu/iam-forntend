import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { apiBaseUrl } from '../iam-client/config'
import Page from '../ui/Page'

function DashboardPage() {
    const showSaved = () => {
        notifications.show({
            title: 'Done',
            message: 'Profile saved',
            color: 'green',
        })
    }

    return (
        <Page title="Dashboard">
            <Text c="dimmed">Welcome to the IAM Console</Text>
            <Text size="sm">API: {apiBaseUrl}</Text>
            <Button mt="md" onClick={showSaved}>
                Save
            </Button>
        </Page>
    )
}

export default DashboardPage