import { Alert, Anchor, Button, Container, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { Link } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from "../iam-client/passwordPolicy";
import PasswordChecklist from '../ui/PasswordChecklist'
import { useState } from "react";
import { signup } from "../iam-client/tenants";
import { notifications } from "@mantine/notifications";
import { ApiError } from "../iam-client/ApiError";

const signupSchema = z.object({
    tenantName: z.string().trim().min(1, 'Organization name is required'),
    username: z.string().trim().min(1, 'Username is required'),
    fullName: z.string(),
    email: z.email('Enter a valid email address'),
    password: z.string().regex(PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE),
    confirmPassword: z.string(),
})
    .refine((values) => values.password === values.confirmPassword, {
        error: 'Passwords do not match',
        path: ['confirmPassword'], // the message appears under "Confirm password"
    })

type SignupFormValues = z.infer<typeof signupSchema>

// 422: the backend's field names (its nested API shape) → our form's field names
const apiFieldToFormField: Record<string, keyof SignupFormValues> = {
    tenantName: 'tenantName',
    'rootUser.username': 'username',
    'rootUser.fullName': 'fullName',
    'rootUser.email': 'email',
    'rootUser.password': 'password',
}

// 409 / 400: the message tells us the field (README step 5 error table)
function fieldForMessage(message: string): keyof SignupFormValues | null {
    if (message === 'Tenant name not available') return 'tenantName'
    if (message === 'Username not available') return 'username'
    if (message === 'Email not available') return 'email'
    if (message.startsWith('Password must')) return 'password' // the policy message (400)
    return null
}

function SignupPage() {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        control,
        setError,
        resetField,
        formState: { errors, isSubmitting }
    } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) })

    const password = useWatch({ control, name: 'password' }) ?? '' // empty before the first keystroke

    const onSubmit = async (values: SignupFormValues) => {
        setErrorMessage(null)

        try {
            const result = await signup({
                tenantName: values.tenantName,
                rootUser: {
                    username: values.username,
                    password: values.password,
                    fullName: values.fullName || undefined,
                    email: values.email
                }
            })
            console.log(result)
            notifications.show({ color: 'green', message: `${result.tenant.name} is ready` })
        } catch (error) {
            if (error instanceof ApiError) {
                resetField('password')
                resetField('confirmPassword')
                let placed = false // did we find a field for it?

                // 422: one message per field
                for (const [apiField, message] of Object.entries(error.fieldErrors)) {
                    const field = apiFieldToFormField[apiField]
                    if (field) {
                        setError(field, { message })
                        placed = true
                    }
                }

                // 409 / 400: the message itself tells us the field
                const field = fieldForMessage(error.message)
                if (field) {
                    setError(field, { message: error.message })
                    placed = true
                }

                // Anything else (e.g. server down): the box above the button
                if (!placed) {
                    setErrorMessage(error.message)
                }
            }
        }
    }

    return (
        <Container size="xs" py="xl">
            <title>Create your organization - IAM Console</title>
            <Title order={1}>Create your organization</Title>
            <form onSubmit={handleSubmit(onSubmit)}>
                <Stack mt="md">
                    <Title order={4}>Organization</Title>
                    <TextInput
                        label="Organization name"
                        withAsterisk
                        error={errors.tenantName?.message}
                        {...register('tenantName')}
                    />
                    <Title order={4}>Your root account</Title>
                    <TextInput
                        label="Username"
                        withAsterisk
                        error={errors.username?.message}
                        {...register('username')}
                    />
                    <TextInput label="Full name" {...register('fullName')} />
                    <TextInput
                        label="Email"
                        description="Required: password resets are sent here." // grey hint under the label (README mockup)
                        withAsterisk
                        error={errors.email?.message}
                        {...register('email')}
                    />
                    <PasswordInput
                        label="Password"
                        withAsterisk
                        error={errors.password?.message}
                        {...register('password')}
                    />
                    <PasswordChecklist password={password} />
                    <PasswordInput
                        label="Confirm password"
                        withAsterisk
                        error={errors.confirmPassword?.message}
                        {...register('confirmPassword')}
                    />

                    {errorMessage && (
                        <Alert color="red" variant="light">
                            {errorMessage}
                        </Alert>
                    )}
                    <Button type="submit" loading={isSubmitting}>
                        Create organization
                    </Button>
                    <Text size="sm">
                        Already have one? {' '}
                        <Anchor component={Link} to="/login">
                            Log in
                        </Anchor>
                    </Text>
                </Stack>
            </form>
        </Container>
    )
}

export default SignupPage