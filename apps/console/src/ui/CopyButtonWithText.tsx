import { Group, Code, CopyButton, Button } from '@mantine/core'

interface CopyButtonWithTextProps {
    value: string
}

function CopyButtonWithText(props: CopyButtonWithTextProps) {
    return (
        <Group>
            <Code>{props.value}</Code>
            <CopyButton value={props.value}>
                {({ copied, copy }) => (
                    <Button size="xs" variant="light" onClick={copy}>
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                )}
            </CopyButton>
        </Group>
    )
}

export default CopyButtonWithText