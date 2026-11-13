import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import BackendStatus from '../ui/BackendStatus'
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
            <BackendStatus />
            <Button mt="md" onClick={showSaved}>
                Save
            </Button>
        </Page>
    )
}

export default DashboardPage