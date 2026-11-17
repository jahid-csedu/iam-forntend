import { Button, Container, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useSearchParams, useNavigate } from 'react-router'
import { safeReturnTo } from '../routing/returnTo'
import { useState, type SubmitEvent } from 'react'
import { notifications } from '@mantine/notifications'
import { authenticate } from '../iam-client/auth'
import { ApiError } from '../iam-client/ApiError'
import { useSession } from '../session/SessionContext'

function LoginPage() {
    const { login } = useSession()
    const navigate = useNavigate()
    const [clientId, setClientId] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [searchParams] = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        try {
            const tokens = await authenticate(clientId, username, password)
            login(tokens.access_token, tokens.refresh_token ?? '', clientId)
            navigate(returnTo, {replace: true})
        } catch (error) {
            if (error instanceof ApiError) {
                notifications.show({color: "red", title: error.title, message: error.message})
            }
        }
    }

    return (
        <Container size="xs" py="xl">
            <title>Login - IAM Console</title>
            <Title order={1}>Login</Title>
            <Text c="dimmed">The login form comes in README step 6</Text>
            <Text mt="md">After login you will go to: {returnTo}</Text>
            <form onSubmit={handleSubmit}>
                <Stack mt="md">
                    <TextInput
                        label="Console ID"
                        value={clientId}
                        onChange={(event) => setClientId(event.currentTarget.value)}
                        required
                    />
                    <PasswordInput
                        label="Username"
                        value={username}
                        onChange={(event) => setUsername(event.currentTarget.value)}
                        required
                    />
                    <TextInput
                        label="Password"
                        value={password}
                        onChange={(event) => setPassword(event.currentTarget.value)}
                        required
                    />
                    <Button type="submit">Log in</Button>
                </Stack>
            </form>
        </Container>
    )
}

export default LoginPage