import { Text, Button } from '@mantine/core';
import { useParams, useNavigate } from 'react-router'
import Page from '../ui/Page'
import { notifications } from '@mantine/notifications';

function UserDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()

    const deleteUser = () => {
        notifications.show({ message: 'User deleted', color: 'green' })
        navigate('/users')
    }

    return (
        <Page title={`User ${id}`}>
            <Text c="dimmed">User details come in README step 11.</Text>
            <Button mt="md" color="red" onClick={deleteUser}>
                Delete
            </Button>
        </Page>
    )
}

export default UserDetailPage