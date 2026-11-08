import { Button, Container, Text, Title } from '@mantine/core'

function App() {
  return (
    // py = padding top and bottom; "xl" is a size from the theme
    <Container py="xl">
      <Title order={1}>IAM Console</Title>
      <Text c="dimmed">Mantine is working.</Text>
      {/* mt = margin top */}
      <Button mt="md">Primary button</Button>
    </Container>
  )
}

export default App