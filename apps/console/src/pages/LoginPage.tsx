import { Container, Text, Title } from '@mantine/core'
import { useSearchParams } from 'react-router'
import { safeReturnTo } from '../routing/returnTo'

function LoginPage() {
    const [searchParams] = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))

    return (
        <Container size="xs" py="xl">
            <title>Login - IAM Console</title>
            <Title order={1}>Login</Title>
            <Text c="dimmed">The login form comes in README step 6</Text>
            <Text mt="md">After login you will go to: {returnTo}</Text>
        </Container>
    )
}

export default LoginPage