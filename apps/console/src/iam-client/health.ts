import { request } from './request'

export interface HealthResponse {
  status: 'UP' | 'DOWN'
}

export function getHealth() {
  return request<HealthResponse>('GET', '/actuator/health')
}