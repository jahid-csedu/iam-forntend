import { Text } from '@mantine/core'
import Page from '../ui/Page'

function NotFoundPage() {
  return (
    <Page title="Not Found">
      <Text c="dimmed">The page you are looking for does not exist.</Text>
    </Page>
  )
}

export default NotFoundPage