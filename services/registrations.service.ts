// Path: services/registrations.service.ts
import { CreateRegistrationPayload } from '@/types'

export const registrationsService = {
  async register(payload: CreateRegistrationPayload) {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.json()
  },

  async getByEvent(eventId: string) {
    const res = await fetch(`/api/registrations?event_id=${eventId}`)
    return res.json()
  },

  async getMyRegistrations(userId: string) {
    const res = await fetch(`/api/registrations?user_id=${userId}`)
    return res.json()
  },

  async isRegistered(eventId: string, userId: string): Promise<boolean> {
    const res = await this.getMyRegistrations(userId)
    return res.data?.some((r: any) => r.event_id === eventId && r.status !== 'CANCELLED') ?? false
  },

  async cancelRegistration(registrationId: string) {
    const res = await fetch(`/api/registrations/${registrationId}/cancel`, { method: 'POST' })
    return res.json()
  },
}