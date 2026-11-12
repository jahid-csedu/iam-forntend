import { Anchor, Group, Text } from '@mantine/core'
import Page from '../ui/Page'
import { Link  } from 'react-router'

function UsersPage() {
  return (
    <Page title="Users">
      <Text c="dimmed">The users list comes in README step 10.</Text>
      <Group mt="md">
        <Anchor component={Link} to="/users/1">User 1</Anchor>
        <Anchor component={Link} to="/users/2">User 2</Anchor>
      </Group>
    </Page>
  )
}

export default UsersPage