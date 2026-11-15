import { Button, Container, Text, Title } from '@mantine/core'
import { useSearchParams } from 'react-router'
import { safeReturnTo } from '../routing/returnTo'
import { useSession } from '../session/SessionContext'

function LoginPage() {
    const [searchParams] = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))
    const { login } = useSession()

    return (
        <Container size="xs" py="xl">
            <title>Login - IAM Console</title>
            <Title order={1}>Login</Title>
            <Text c="dimmed">The login form comes in README step 6</Text>
            <Text mt="md">After login you will go to: {returnTo}</Text>
            <Button mt="md" onClick={() => login('fake-access', 'fake-refresh', 'console-1')}>
                Fake login
            </Button>
        </Container>
    )
}

export default LoginPage