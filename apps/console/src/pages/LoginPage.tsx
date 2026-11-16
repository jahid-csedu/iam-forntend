import { Button, Container, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useSearchParams } from 'react-router'
import { safeReturnTo } from '../routing/returnTo'
import { useState, type SubmitEvent } from 'react'

function LoginPage() {
    const [clientId, setClientId] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [searchParams] = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        console.log({ clientId, username, password })
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