import type { ReactNode } from 'react'
import { Container, Title } from '@mantine/core'

interface PageProps {
  title: string
  children: ReactNode
}

function Page({ title, children }: PageProps) {
    return (
        <Container py="xl">
            <Title order={1} mb="md">
                {title}
            </Title>
            {children}
        </Container>
    )
}

export default Page