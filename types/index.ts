// Path: types/index.ts
// ─── ROLES ───────────────────────────────────────────────────────────────────
// Global role: what the user signed up as
export type UserRole = 'ORGANIZER' | 'PARTICIPANT'

// Derived at runtime: is this user the creator of a specific event?
export type EventPermission = 'EVENT_ADMIN' | 'PARTICIPANT' | 'NONE'

// ─── USER ────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url?: string
  created_at: string
}

// ─── EVENT ───────────────────────────────────────────────────────────────────
export type EventType   = 'INDIVIDUAL' | 'TEAM'
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'

export interface Event {
  id: string
  title: string
  description: string
  type: EventType
  status: EventStatus
  start_date: string
  end_date: string
  location: string
  max_participants: number
  max_team_size?: number
  min_team_size?: number
  registration_deadline: string
  cover_image?: string
  tags: string[]
  created_by: string          // ← this user is the admin for this event
  created_at: string
  updated_at: string
  // computed
  registration_count?: number
  checkin_count?: number
  // joined
  organizer?: User
}

export interface CreateEventPayload {
  title: string
  description: string
  type: EventType
  start_date: string
  end_date: string
  location: string
  max_participants: number
  max_team_size?: number
  min_team_size?: number
  registration_deadline: string
  tags: string[]
  cover_image?: string
}

// ─── REGISTRATION ─────────────────────────────────────────────────────────────
export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED'

export interface Registration {
  id: string
  event_id: string
  user_id: string
  status: RegistrationStatus
  qr_token: string
  team_id?: string            // set once accepted into a team
  checked_in: boolean
  checked_in_at?: string
  created_at: string
  // joined
  user?: User
  event?: Event
}

export interface CreateRegistrationPayload {
  event_id: string
  user_id: string
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────
export type TeamStatus = 'FORMING' | 'COMPLETE' | 'APPROVED' | 'DISQUALIFIED'

export interface Team {
  id: string
  event_id: string
  name: string
  description?: string
  status: TeamStatus
  leader_id: string
  skills: string[]
  max_size: number
  created_at: string
  updated_at: string
  // joined
  members?: TeamMember[]
  leader?: User
  member_count?: number
  pending_requests?: number
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'LEADER' | 'MEMBER'
  joined_at: string
  // joined
  user?: User
}

export interface CreateTeamPayload {
  event_id: string
  name: string
  description?: string
  skills: string[]
  leader_id: string
}

// ─── TEAM JOIN REQUEST ────────────────────────────────────────────────────────
export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface TeamJoinRequest {
  id: string
  team_id: string
  user_id: string
  status: JoinRequestStatus
  message?: string
  created_at: string
  updated_at: string
  // joined
  user?: User
  team?: Team
}

export interface CreateJoinRequestPayload {
  team_id: string
  user_id: string
  message?: string
}

export interface RespondToRequestPayload {
  request_id: string
  response: 'ACCEPTED' | 'REJECTED'
}

// ─── CHECKIN ─────────────────────────────────────────────────────────────────
export interface CheckIn {
  id: string
  registration_id: string
  event_id: string
  checked_in_by: string
  checked_in_at: string
  registration?: Registration
}

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────
export type NotificationType     = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
export type NotificationCategory = 'REGISTRATION' | 'TEAM' | 'EVENT' | 'CHECKIN' | 'SYSTEM'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  category: NotificationCategory
  read: boolean
  action_url?: string
  created_at: string
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
export interface EventAnalytics {
  event_id: string
  total_registrations: number
  confirmed_registrations: number
  checked_in_count: number
  total_teams: number
  approved_teams: number
  checkin_rate: number
  team_formation_rate: number
  registration_velocity: { date: string; count: number }[]
  health_score: number
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export interface AuthSession {
  user: User
  access_token: string
  expires_at: string
}

export interface LoginPayload    { email: string; password: string }
export interface RegisterPayload { email: string; password: string; name: string; role?: UserRole }