import { Button, Text } from '@mantine/core'
import AppLayout from './ui/AppLayout'
import Page from './ui/Page'

function App() {
  return (
    <AppLayout>
      <Page title="Dashboard">
        <Text c="dimmed">Mantine is working.</Text>
        <Button mt="md">Primary button</Button>
      </Page>
    </AppLayout>
  )
}

export default App