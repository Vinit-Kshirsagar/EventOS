import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized', success: false }, { status: 401 })
    }

    const regId = params.id

    // 1. Fetch the registration
    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .select('id, event_id, user_id, status, team_id')
      .eq('id', regId)
      .single()

    if (regError || !reg) {
      return NextResponse.json({ data: null, error: 'Registration not found', success: false }, { status: 404 })
    }

    // 2. Ensure the user owns this registration
    if (reg.user_id !== user.id) {
      return NextResponse.json({ data: null, error: 'Not your registration', success: false }, { status: 403 })
    }

    if (reg.status === 'CANCELLED') {
      return NextResponse.json({ data: null, error: 'Already cancelled', success: false }, { status: 400 })
    }

    // Use service client for cascade operations (bypasses RLS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceClient() as any

    // 3. Check if user is a team leader for this event
    const { data: ledTeam } = await admin
      .from('teams')
      .select('id')
      .eq('event_id', reg.event_id)
      .eq('leader_id', user.id)
      .not('status', 'eq', 'DISQUALIFIED')
      .single()

    if (ledTeam) {
      // ── Team leader cascade ──
      // a. Get all team members (except the leader)
      const { data: members } = await admin
        .from('team_members')
        .select('user_id')
        .eq('team_id', ledTeam.id)
        .neq('user_id', user.id)

      // b. Cancel all team members' registrations for this event
      if (members && members.length > 0) {
        const memberUserIds = members.map((m: { user_id: string }) => m.user_id)
        await admin
          .from('registrations')
          .update({ status: 'CANCELLED', team_id: null })
          .eq('event_id', reg.event_id)
          .in('user_id', memberUserIds)
          .neq('status', 'CANCELLED')
      }

      // c. Remove all team members
      await admin
        .from('team_members')
        .delete()
        .eq('team_id', ledTeam.id)

      // d. Reject any pending join requests
      await admin
        .from('team_join_requests')
        .update({ status: 'REJECTED' })
        .eq('team_id', ledTeam.id)
        .eq('status', 'PENDING')

      // e. Mark team as DISQUALIFIED
      await admin
        .from('teams')
        .update({ status: 'DISQUALIFIED' })
        .eq('id', ledTeam.id)
    }

    // 4. Cancel the user's own registration
    const { error: cancelError } = await admin
      .from('registrations')
      .update({ status: 'CANCELLED', team_id: null })
      .eq('id', regId)

    if (cancelError) {
      console.error('Cancel registration error:', cancelError)
      return NextResponse.json({ data: null, error: cancelError.message, success: false }, { status: 500 })
    }

    return NextResponse.json({ data: null, error: null, success: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('POST /api/registrations/[id]/cancel exception:', e)
    return NextResponse.json({ data: null, error: 'Cancellation failed', success: false }, { status: 500 })
  }
}
