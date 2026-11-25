import { Button, Container, Stack, Text, Title } from '@mantine/core'
import { Link, useLocation } from 'react-router'
import type { SignupResponse } from '../iam-client/tenants'
import CopyButtonWithText from '../ui/CopyButtonWithText'

function SignupDonePage() {
  // The signup result, handed over by navigate() on the signup page
  const result = useLocation().state as SignupResponse | null

  if (!result) {
    // Opened directly (bookmark, new tab): there is no result to show
    return (
      <Container size="xs" py="xl">
        <title>Signup - IAM Console</title>
        <Text>Log in with your console link.</Text>
      </Container>
    )
  }

  const clientId = result.managementConsole.client_id
  // README uses VITE_CONSOLE_BASE_URL for this later; the current site's address is enough for now
  const loginLink = `${window.location.origin}/login/${clientId}`

  return (
    <Container size="xs" py="xl">
      <title>{`${result.tenant.name} is ready - IAM Console`}</title>
      <Title order={1}>{result.tenant.name} is ready</Title>

      <Stack mt="md">
        <Text>Your console login link (bookmark it):</Text>
        <CopyButtonWithText value={loginLink} />

        <Text>Your Console ID:</Text>
        <CopyButtonWithText value={result.managementConsole.client_id} />

        <Text>Username: {result.rootUser.username}</Text>

        <Text size="sm" c="dimmed">
          Included: roles ADMIN, USER_MANAGER, VIEWER and a management console for your admins.
        </Text>

        <Button component={Link} to={`/login/${clientId}`}>
          Log in now
        </Button>
      </Stack>
    </Container>
  )
}

export default SignupDonePage