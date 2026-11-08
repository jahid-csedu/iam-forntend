import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css' // Mantine's CSS: without it, components are unstyled
import { MantineProvider, createTheme } from '@mantine/core'
import App from './App.tsx'

// One place for app-wide style settings
const theme = createTheme({
  primaryColor: 'teal',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
)