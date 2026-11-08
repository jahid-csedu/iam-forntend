import type { ReactNode } from 'react'
import { AppShell, NavLink, Text } from '@mantine/core'

// From the README step 2 mockup. Real links come with routing (module 3).
const navItems = ['Dashboard', 'Users', 'Roles', 'Permissions', 'Applications', 'Developer guide']

interface AppLayoutProps {
  children: ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppShell
      header={{ height: 60 }}                       // header is 60px tall
      navbar={{ width: 240, breakpoint: "sm" }}     // nav is 240px wide on screens wider than "sm"
      padding="md"                                  // space around the main content
    >
      <AppShell.Header px="md">
        <Text fw={700} lh="60px">                   {/* fw = font weight, lh = line height */}
          IAM Console
        </Text>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {navItems.map((item) => (
          <NavLink key={item} href="#" label={item} />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}

export default AppLayout