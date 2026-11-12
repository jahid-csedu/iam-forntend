import { Text } from '@mantine/core';
import { useParams } from 'react-router'
import Page from '../ui/Page'

function UserDetailPage() {
    const { id } = useParams();

    return (
        <Page title={`User ${id}`}>
            <Text c="dimmed">User details come in README step 11.</Text>
        </Page>
    )
}

export default UserDetailPage