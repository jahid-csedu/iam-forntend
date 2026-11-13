import { useEffect, useState } from "react";
import { Text } from "@mantine/core";
import { getHealth } from "../iam-client/health";
import type { HealthResponse } from "../iam-client/health";

function BackendStatus() {
    const [status, setStatus] = useState("Fetching...");
    useEffect(() => {
        const loadHealth = async () => {
            try {
                const health: HealthResponse = await getHealth()
                setStatus(health.status)
            } catch {
                setStatus("DOWN")
            }
        }
        loadHealth()
    }, [])

    return <Text>Backend: {status}</Text>
}

export default BackendStatus