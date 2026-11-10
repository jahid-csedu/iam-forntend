import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { AppShell, NavLink, Text, Burger, Group } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

interface NavItem {
    label: string
    path: string
}

// Paths from the README step 3 route table
const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Users', path: '/users' },
    { label: 'Roles', path: '/roles' },
    { label: 'Permissions', path: '/permissions' },
    { label: 'Applications', path: '/applications' },
    { label: 'Developer guide', path: '/developers' },
]

interface AppLayoutProps {
    children: ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
    const [opened, { toggle, close }] = useDisclosure(false)
    const location = useLocation()

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
                    <NavLink
                        key={item.path}
                        component={Link}  // draw this NavLink as a router <Link> instead of a plain <a>
                        to={item.path}    // Link uses "to", not "href"
                        label={item.label}
                        active={location.pathname.startsWith(item.path)} // highlight when the URL begins with this path
                        onClick={close}
                    />
                ))}
            </AppShell.Navbar>

            <AppShell.Main>{children}</AppShell.Main>
        </AppShell>
    )
}

export default AppLayout