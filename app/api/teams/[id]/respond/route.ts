// Path: app/api/teams/[id]/respond/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized', success: false }, { status: 401 })
    }

    const teamId = params.id
    const body = await req.json()
    const { request_id, response } = body

    if (!['ACCEPTED', 'REJECTED'].includes(response)) {
      return NextResponse.json({ data: null, error: 'Invalid response', success: false }, { status: 400 })
    }

    // 1. Verify that the current user is the leader of this team
    const { data: team, error: teamError } = await supabase
      .from('team_details')
      .select('id, leader_id, member_count, max_size')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json({ data: null, error: 'Team not found', success: false }, { status: 404 })
    }

    if (team.leader_id !== user.id) {
      return NextResponse.json({ data: null, error: 'Only the team leader can respond to requests', success: false }, { status: 403 })
    }

    // 2. Fetch the request to verify it exists
    const { data: request, error: reqError } = await supabase
      .from('team_join_requests')
      .select('*')
      .eq('id', request_id)
      .eq('team_id', teamId)
      .single()

    if (reqError || !request) {
      return NextResponse.json({ data: null, error: 'Join request not found', success: false }, { status: 404 })
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ data: null, error: `Request already ${request.status.toLowerCase()}`, success: false }, { status: 400 })
    }

    // 3. Handle ACCEPTED or REJECTED
    if (response === 'ACCEPTED') {
      // Check capacity
      if (team.member_count >= team.max_size) {
        return NextResponse.json({ data: null, error: 'Team is full', success: false }, { status: 400 })
      }

      // Add user to team_members
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: request.user_id,
          role: 'MEMBER'
        })

      // 23505 is unique violation (already a member)
      if (memberError && memberError.code !== '23505') {
        return NextResponse.json({ data: null, error: memberError.message, success: false }, { status: 500 })
      }
    }

    // Update request status (for both ACCEPTED and REJECTED)
    const { error: updateError } = await supabase
      .from('team_join_requests')
      .update({ status: response })
      .eq('id', request_id)

    if (updateError) {
      return NextResponse.json({ data: null, error: updateError.message, success: false }, { status: 500 })
    }

    return NextResponse.json({ data: { status: response }, error: null, success: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error(`POST /api/teams/[id]/respond exception:`, err)
    return NextResponse.json({ data: null, error: err.message || 'Internal error', success: false }, { status: 500 })
  }
}