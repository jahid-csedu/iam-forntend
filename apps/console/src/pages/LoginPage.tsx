import { Alert, Anchor, Button, Container, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router'
import { safeReturnTo } from '../routing/returnTo'
import { useState } from 'react'
import { authenticate } from '../iam-client/auth'
import { ApiError } from '../iam-client/ApiError'
import { useSession } from '../session/SessionContext'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

function loginErrorMessage(error: ApiError): string {
    if (error.message === 'Bad credentials') {
        return 'Wrong username or password.'
    }
    if (error.message === 'Unknown client_id') {
        return 'This console link is not valid.'
    }
    if (error.message === 'Only management users can log in through the management console') {
        return 'This console is for administrators. Log in through your application instead.'
    }
    if (error.message.includes('locked')) {
        return 'Your account is locked after too many failed attempts. Try again in 15 minutes, or reset your password.'
    }
    if (error.message === 'Tenant is suspended') {
        return 'This organization is suspended. Contact the service operator.'
    }
    if (error.message === 'Client is suspended') {
        return 'This application is suspended. Contact your administrator.'
    }
    if (error.message === 'Account is disabled') {
        return 'Your account is disabled. Contact your administrator.'
    }
    return error.message
}

// README step 6: all three required, no password policy at login
const loginSchema = z.object({
    clientId: z.string().min(1, 'Console ID is required'),
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema> // same shape as the old interface

function LoginPage() {
    // On /login/abc123 this is 'abc123'; on /login it's undefined
    const { clientId: clientIdFromUrl } = useParams()
    const { login } = useSession()
    const navigate = useNavigate()
    const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { clientId: clientIdFromUrl ?? '' }
    })
    const [searchParams] = useSearchParams()
    const returnTo = safeReturnTo(searchParams.get('returnTo'))

    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const onSubmit = async (values: LoginFormValues) => {
        setErrorMessage(null)
        try {
            const tokens = await authenticate(values.clientId, values.username, values.password)
            login(tokens.access_token, tokens.refresh_token ?? '', values.clientId)
            navigate(returnTo, { replace: true })
        } catch (error) {
            if (error instanceof ApiError) {
                setErrorMessage(loginErrorMessage(error))
            }
        }
    }

    return (
        <Container size="xs" py="xl">
            <title>Login - IAM Console</title>
            <Title order={1}>Login</Title>
            <Text c="dimmed">The login form comes in README step 6</Text>
            <Text mt="md">After login you will go to: {returnTo}</Text>
            <form onSubmit={handleSubmit(onSubmit)}>
                <Stack mt="md">
                    {clientIdFromUrl ? (
                        <Text size="sm">
                            Console {clientIdFromUrl.slice(0, 6)}...{' '}
                            <Anchor component={Link} to="/login">
                                Not yours? Use another console
                            </Anchor>
                        </Text>
                    ) : (
                        <TextInput
                            label="Console ID"
                            withAsterisk
                            error={errors.clientId?.message}
                            {...register('clientId')}
                        />
                    )}
                    <TextInput label="Username"
                        {...register('username')}
                        withAsterisk
                        error={errors.username?.message} />
                    <PasswordInput label="Password"
                        {...register('password')}
                        withAsterisk
                        error={errors.password?.message} />
                    {errorMessage && (
                        <Alert color="red" variant="light">
                            {errorMessage}
                        </Alert>
                    )}
                    <Button type="submit" loading={isSubmitting}>Log in</Button>
                </Stack>
            </form>
        </Container>
    )
}

export default LoginPage