import type { ReactNode } from 'react'
import { AppShell, NavLink, Text, Burger, Group } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

// From the README step 2 mockup. Real links come with routing (module 3).
const navItems = ['Dashboard', 'Users', 'Roles', 'Permissions', 'Applications', 'Developer guide']

interface AppLayoutProps {
    children: ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
    const [opened, { toggle, close }] = useDisclosure(false)

    return (
        <AppShell
            header={{ height: 60 }}                       // header is 60px tall
            navbar={{
                width: 240,
                breakpoint: "sm",
                collapsed: { mobile: !opened },
            }}     // nav is 240px wide on screens wider than "sm"
            padding="md"                                  // space around the main content
        >
            <AppShell.Header px="md">
                <Group h="100%">
                    <Burger
                        opened={opened}
                        onClick={toggle}
                        hiddenFrom="sm"  // hide the burger on screens wider than "sm"
                        size="sm"
                        aria-label="Toggle navigation"
                    />
                    <Text fw={700}>                   {/* fw = font weight */}
                        IAM Console
                    </Text>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="sm">
                {navItems.map((item) => (
                    <NavLink key={item} href="#" label={item} onClick={close} />
                ))}
            </AppShell.Navbar>

            <AppShell.Main>{children}</AppShell.Main>
        </AppShell>
    )
}

export default AppLayout