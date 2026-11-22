import { Stack, Text } from '@mantine/core'

// One rule per line of the README checklist (same rules as PASSWORD_POLICY)
const rules = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Digit', test: (p: string) => /\d/.test(p) },
  { label: 'Special: @ # ! $ % ^ & - + = ( )', test: (p: string) => /[@#!$%^&\-+=()]/.test(p) },
  { label: 'No spaces', test: (p: string) => p.length > 0 && !/\s/.test(p) },
]

interface PasswordChecklistProps {
  password: string
}

function PasswordChecklist({ password }: PasswordChecklistProps) {
  return (
    <Stack gap={2}>
      {rules.map((rule) => {
        const ok = rule.test(password)
        return (
          <Text key={rule.label} size="sm" c={ok ? 'teal' : 'dimmed'}>
            {ok ? '✓' : '○'} {rule.label}
          </Text>
        )
      })}
    </Stack>
  )
}

export default PasswordChecklist