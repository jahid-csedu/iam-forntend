import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import AppLayout from './ui/AppLayout'
import Page from './ui/Page'

function App() {
  const showSaved = () => {
    notifications.show({
      title: 'Done',
      message: 'Profile saved',
      color: 'green',
    })
  }

  const showEmailFailed = () => {
    notifications.show({
      title: 'Email Failed',
      message: 'The email could not be sent. Nothing was changed. Try again later.',
      color: 'red',
    })
  }

  return (
    <AppLayout>
      <Page title="Dashboard">
        <Text c="dimmed">Mantine is working.</Text>
        <Button mt="md" onClick={showSaved}>
          Save
        </Button>
        <Button mt="md" onClick={showEmailFailed}>
          Send Email
        </Button>
      </Page>
    </AppLayout>
  )
}

export default App