import { Button, Text } from '@mantine/core'
import Page from '../ui/Page'
import { useNavigate } from 'react-router'

function NotFoundPage() {

  const nagivate = useNavigate()
  const goToDashboard = () => {
    nagivate('/dashboard')
  }

  return (
    <Page title="Not Found">
      <Text c="dimmed">The page you are looking for does not exist.</Text>
      <Button mt="md" color="blue" onClick={goToDashboard}>
        Go to Dashboard
      </Button>
    </Page>
  )
}

export default NotFoundPage