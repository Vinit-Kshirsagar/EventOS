import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { CreateRegistrationPayload } from '@/types'
import { generateQRToken } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  const userId = searchParams.get('user_id')

  const supabase = createServerClient()

  let query = supabase.from('registrations').select(`*, user:profiles!registrations_user_id_fkey(*)`)

  if (eventId) query = query.eq('event_id', eventId)
  if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query

  if (error) {
    console.error("GET /api/registrations error:", error)
    return NextResponse.json({ data: null, error: error.message, success: false }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, success: true })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized', success: false }, { status: 401 })
    }

    const { event_id }: CreateRegistrationPayload = await req.json()

    // 1. Fetch event to validate deadlines and limits
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, status, registration_deadline, max_participants')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ data: null, error: 'Event not found', success: false }, { status: 404 })
    }

    if (!['PUBLISHED', 'ONGOING'].includes(event.status)) {
      return NextResponse.json({ data: null, error: 'Event is not accepting registrations', success: false }, { status: 400 })
    }

    if (new Date(event.registration_deadline) < new Date()) {
      return NextResponse.json({ data: null, error: 'Registration deadline has passed', success: false }, { status: 400 })
    }

    // Check capacity using event_stats
    const { data: stats } = await supabase
      .from('event_stats')
      .select('total_registrations')
      .eq('event_id', event_id)
      .single()

    if (stats && stats.total_registrations >= event.max_participants) {
      return NextResponse.json({ data: null, error: 'Event is full', success: false }, { status: 400 })
    }

    // 2. Check if user already has a registration for this event (possibly cancelled)
    const { data: existing } = await supabase
      .from('registrations')
      .select('id, status')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      if (existing.status !== 'CANCELLED') {
        return NextResponse.json({ data: null, error: 'Already registered', success: false }, { status: 409 })
      }
      // Re-activate the cancelled registration
      const { data: reactivated, error: reactivateError } = await supabase
        .from('registrations')
        .update({ status: 'CONFIRMED', qr_token: generateQRToken(event_id, user.id), checked_in: false, team_id: null })
        .eq('id', existing.id)
        .select(`*, user:profiles!registrations_user_id_fkey(*)`)
        .single()

      if (reactivateError) {
        console.error("Reactivate registration error:", reactivateError)
        return NextResponse.json({ data: null, error: reactivateError.message, success: false }, { status: 500 })
      }
      return NextResponse.json({ data: reactivated, error: null, success: true }, { status: 200 })
    }

    // 3. Insert new registration
    const { data, error } = await supabase
      .from('registrations')
      .insert({
        event_id,
        user_id: user.id,
        status: 'CONFIRMED',
        qr_token: generateQRToken(event_id, user.id),
      })
      .select(`*, user:profiles!registrations_user_id_fkey(*)`)
      .single()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json({ data: null, error: error.message, success: false }, { status: 500 })
    }

    return NextResponse.json({ data, error: null, success: true }, { status: 201 })
  } catch (e: unknown) {
    console.error("POST /api/registrations error:", e)
    return NextResponse.json({ data: null, error: 'Registration failed', success: false }, { status: 500 })
  }
}