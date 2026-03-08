-- =============================================================================
-- EventOS · Supabase Schema
-- =============================================================================
-- HOW TO APPLY
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--   Safe to re-run: every object uses CREATE … IF NOT EXISTS or
--   CREATE OR REPLACE, and DROP … IF EXISTS before recreation.
--
-- SECTIONS
--   1.  Extensions
--   2.  Enum types
--   3.  Tables          (profiles, events, registrations, teams,
--                        team_members, team_join_requests, check_ins,
--                        notifications)
--   4.  Foreign-key patches (circular refs resolved after all tables exist)
--   5.  Indexes
--   6.  Functions & Triggers
--       6a  set_updated_at          – keeps updated_at fresh
--       6b  handle_new_user         – auto-creates profile on auth signup
--       6c  handle_team_created     – auto-adds leader as LEADER member
--       6d  handle_join_request_accepted – the full accept flow:
--               add to team_members · link registration.team_id
--               auto-reject other pending requests · mark team COMPLETE
--       6e  handle_checkin_inserted – syncs registrations.checked_in
--   7.  Views           (event_stats, team_details)
--   8.  Row Level Security
--   9.  Grants
--  10.  Seed data       (mirrors mock-data.ts exactly, for local dev)
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram indexes for ILIKE search
CREATE EXTENSION IF NOT EXISTS "btree_gist";-- needed for EXCLUDE constraint on teams


-- =============================================================================
-- 2. ENUM TYPES
-- =============================================================================
DO $$ BEGIN CREATE TYPE user_role             AS ENUM ('ORGANIZER','PARTICIPANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE event_type            AS ENUM ('INDIVIDUAL','TEAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE event_status          AS ENUM ('DRAFT','PUBLISHED','ONGOING','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE registration_status   AS ENUM ('PENDING','CONFIRMED','CANCELLED','WAITLISTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE team_status           AS ENUM ('FORMING','COMPLETE','APPROVED','DISQUALIFIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE team_member_role      AS ENUM ('LEADER','MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE join_request_status   AS ENUM ('PENDING','ACCEPTED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_type     AS ENUM ('INFO','SUCCESS','WARNING','ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_category AS ENUM ('REGISTRATION','TEAM','EVENT','CHECKIN','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================================================
-- 3. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1  profiles
--      One row per Supabase auth user.  id = auth.users.id.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT         NOT NULL UNIQUE,
  name        TEXT         NOT NULL,
  role        user_role    NOT NULL DEFAULT 'PARTICIPANT',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.profiles                IS 'Extends auth.users with EventOS-specific fields.';
COMMENT ON COLUMN public.profiles.role           IS 'ORGANIZER: can create events. PARTICIPANT: can register and join teams.';


-- -----------------------------------------------------------------------------
-- 3.2  events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT          NOT NULL,
  description           TEXT          NOT NULL DEFAULT '',
  type                  event_type    NOT NULL,
  status                event_status  NOT NULL DEFAULT 'DRAFT',
  start_date            TIMESTAMPTZ   NOT NULL,
  end_date              TIMESTAMPTZ   NOT NULL,
  location              TEXT          NOT NULL,
  max_participants      INTEGER       NOT NULL CHECK (max_participants > 0),
  min_team_size         INTEGER,
  max_team_size         INTEGER,
  registration_deadline TIMESTAMPTZ   NOT NULL,
  cover_image           TEXT,
  tags                  TEXT[]        NOT NULL DEFAULT '{}',
  created_by            UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_team_size_only_for_team
    CHECK (type = 'TEAM' OR (min_team_size IS NULL AND max_team_size IS NULL)),
  CONSTRAINT chk_min_lte_max_team_size
    CHECK (min_team_size IS NULL OR max_team_size IS NULL OR min_team_size <= max_team_size),
  CONSTRAINT chk_min_team_size_gte_2
    CHECK (min_team_size IS NULL OR min_team_size >= 2),
  CONSTRAINT chk_max_team_size_gte_2
    CHECK (max_team_size IS NULL OR max_team_size >= 2),
  CONSTRAINT chk_deadline_before_start
    CHECK (registration_deadline <= start_date),
  CONSTRAINT chk_start_before_end
    CHECK (start_date < end_date)
);

COMMENT ON TABLE  public.events            IS 'Each event is exclusively owned by created_by.';
COMMENT ON COLUMN public.events.created_by IS 'The ORGANIZER who owns this event. Only they may edit/delete it.';
COMMENT ON COLUMN public.events.tags       IS 'Free-form searchable tags, e.g. {AI, Hackathon, Open Source}';


-- -----------------------------------------------------------------------------
-- 3.3  registrations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
  id            UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID                 NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       UUID                 NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        registration_status  NOT NULL DEFAULT 'CONFIRMED',
  qr_token      TEXT                 NOT NULL UNIQUE,
  team_id       UUID,                -- FK to teams added in section 4
  checked_in    BOOLEAN              NOT NULL DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

  -- one active registration per user per event
  CONSTRAINT uq_one_registration_per_user_per_event UNIQUE (event_id, user_id)
);

COMMENT ON TABLE  public.registrations            IS 'One row per user+event pair. qr_token used for physical check-in.';
COMMENT ON COLUMN public.registrations.qr_token   IS 'Unique token shown as QR code. Matches against check-in scanner input.';
COMMENT ON COLUMN public.registrations.team_id    IS 'Populated by trigger when a join request is accepted.';


-- -----------------------------------------------------------------------------
-- 3.4  teams
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID         NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  description TEXT,
  status      team_status  NOT NULL DEFAULT 'FORMING',
  leader_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  skills      TEXT[]       NOT NULL DEFAULT '{}',
  max_size    INTEGER      NOT NULL DEFAULT 4 CHECK (max_size >= 1),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_team_name_per_event UNIQUE (event_id, name)
);

COMMENT ON TABLE  public.teams           IS 'A team belongs to one event. leader_id also appears in team_members with role=LEADER.';
COMMENT ON COLUMN public.teams.skills    IS 'Skills the team is looking for, e.g. {React, Python, ML}';
COMMENT ON COLUMN public.teams.max_size  IS 'Max number of members including the leader.';


-- -----------------------------------------------------------------------------
-- 3.5  team_members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id        UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID              NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id   UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      team_member_role  NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_member_per_team UNIQUE (team_id, user_id)
);

COMMENT ON TABLE public.team_members IS 'Membership rows. Each user appears at most once per team.';


-- -----------------------------------------------------------------------------
-- 3.6  team_join_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id         UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID                 NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  user_id    UUID                 NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     join_request_status  NOT NULL DEFAULT 'PENDING',
  message    TEXT,
  created_at TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

  -- one request per (user, team) at a time – enforced by unique index
  CONSTRAINT uq_one_request_per_user_per_team UNIQUE (team_id, user_id)
);

COMMENT ON TABLE public.team_join_requests IS
  'Participant requests to join a team. Accepting triggers the full join-flow via trigger.';


-- -----------------------------------------------------------------------------
-- 3.7  check_ins
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.check_ins (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID         NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  event_id        UUID         NOT NULL REFERENCES public.events(id)         ON DELETE CASCADE,
  checked_in_by   UUID         NOT NULL REFERENCES public.profiles(id)       ON DELETE RESTRICT,
  checked_in_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- prevent double check-in
  CONSTRAINT uq_one_checkin_per_registration UNIQUE (registration_id)
);

COMMENT ON TABLE public.check_ins IS 'Immutable record of a QR-code scan. Inserting here triggers sync to registrations.';


-- -----------------------------------------------------------------------------
-- 3.8  notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID                    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT                    NOT NULL,
  message    TEXT                    NOT NULL,
  type       notification_type       NOT NULL DEFAULT 'INFO',
  category   notification_category   NOT NULL DEFAULT 'SYSTEM',
  read       BOOLEAN                 NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS 'In-app notifications per user. Mark read via UPDATE.';


-- =============================================================================
-- 4. FOREIGN-KEY PATCHES
--    registrations.team_id could not reference teams at creation time
--    because teams did not exist yet.
-- =============================================================================
ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_team_id_fkey;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_team_id_fkey
    FOREIGN KEY (team_id)
    REFERENCES public.teams(id)
    ON DELETE SET NULL;


-- =============================================================================
-- 5. INDEXES
--    One index per column that appears in WHERE / ORDER BY / JOIN in any route.
-- =============================================================================

-- events ──────────────────────────────────────────────────────────────────────
-- GET /api/events?created_by=  (organizer dashboard)
CREATE INDEX IF NOT EXISTS idx_events_created_by  ON public.events(created_by);
-- GET /api/events?status=      (landing page, public events page)
CREATE INDEX IF NOT EXISTS idx_events_status      ON public.events(status);
-- GET /api/events?type=
CREATE INDEX IF NOT EXISTS idx_events_type        ON public.events(type);
-- ORDER BY start_date (soonest sort on /events page)
CREATE INDEX IF NOT EXISTS idx_events_start_date  ON public.events(start_date);
-- Full-text search: title + description + location
CREATE INDEX IF NOT EXISTS idx_events_fts ON public.events
  USING gin(to_tsvector('english', title || ' ' || description || ' ' || location));
-- Tag array search
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING gin(tags);

-- registrations ───────────────────────────────────────────────────────────────
-- GET /api/registrations?event_id=  (organizer check-in page)
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON public.registrations(event_id);
-- GET /api/registrations?user_id=   (participant's own registrations)
CREATE INDEX IF NOT EXISTS idx_registrations_user_id  ON public.registrations(user_id);
-- POST /api/checkins  → lookup by qr_token
CREATE INDEX IF NOT EXISTS idx_registrations_qr_token ON public.registrations(qr_token);
-- team_id FK lookup
CREATE INDEX IF NOT EXISTS idx_registrations_team_id  ON public.registrations(team_id);
-- status filter (exclude CANCELLED)
CREATE INDEX IF NOT EXISTS idx_registrations_status   ON public.registrations(status);

-- teams ───────────────────────────────────────────────────────────────────────
-- GET /api/teams?event_id=   (browse teams for an event)
CREATE INDEX IF NOT EXISTS idx_teams_event_id  ON public.teams(event_id);
-- leader badge + permission check
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON public.teams(leader_id);
-- status filter (FORMING / COMPLETE / APPROVED)
CREATE INDEX IF NOT EXISTS idx_teams_status    ON public.teams(status);
-- Full-text search: name + description (Find a Team search box)
CREATE INDEX IF NOT EXISTS idx_teams_fts ON public.teams
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description,'')));
-- Skill array search (GET /api/teams?skills=)
CREATE INDEX IF NOT EXISTS idx_teams_skills ON public.teams USING gin(skills);

-- team_members ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

-- team_join_requests ──────────────────────────────────────────────────────────
-- GET /api/teams/requests?team_id=  (leader view)
CREATE INDEX IF NOT EXISTS idx_requests_team_id ON public.team_join_requests(team_id);
-- GET /api/teams/requests?user_id=  (participant view)
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.team_join_requests(user_id);
-- filter PENDING only
CREATE INDEX IF NOT EXISTS idx_requests_status  ON public.team_join_requests(status);

-- check_ins ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_checkins_event_id ON public.check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_checkins_reg_id   ON public.check_ins(registration_id);

-- notifications ───────────────────────────────────────────────────────────────
-- fetch unread count badge
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read)
  WHERE read = FALSE;


-- =============================================================================
-- 6. FUNCTIONS & TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6a  set_updated_at
--     Generic trigger: keeps updated_at = NOW() on any UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at             ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at              ON public.teams;
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_join_requests_updated_at      ON public.team_join_requests;
CREATE TRIGGER trg_join_requests_updated_at
  BEFORE UPDATE ON public.team_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 6b  handle_new_user
--     Fires AFTER INSERT on auth.users (Supabase built-in table).
--     Auto-creates the matching profiles row so the app never has to.
--     Reads name + role from raw_user_meta_data, which the register API
--     must pass as { name, role } when calling supabase.auth.signUp().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'PARTICIPANT'::user_role
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();


-- -----------------------------------------------------------------------------
-- 6c  handle_team_created
--     When a new team is inserted, automatically add the leader as a
--     LEADER member row so team_members is always in sync.
--     Mirrors the mock: teams/route.ts POST manually pushes the leader.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handle_team_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.leader_id, 'LEADER')
  ON CONFLICT (team_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_created ON public.teams;
CREATE TRIGGER trg_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_team_created();


-- -----------------------------------------------------------------------------
-- 6d  handle_join_request_accepted
--     The core business-logic trigger.  Fires AFTER UPDATE on
--     team_join_requests only when status changes to 'ACCEPTED'.
--
--     Steps (matching teams/[id]/respond/route.ts exactly):
--       1. Guard: only run when NEW.status = 'ACCEPTED' and it was not before.
--       2. If team is already full  → flip this request to REJECTED, abort.
--       3. INSERT into team_members (MEMBER role).
--       4. UPDATE registrations SET team_id = team.id
--             WHERE user_id = requester AND event_id = team.event_id.
--       5. Auto-REJECT all other PENDING requests from this user
--             for any team in the same event.
--       6. If team is now full → set teams.status = 'COMPLETE'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handle_join_request_accepted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
  v_max_size  INTEGER;
  v_cur_count BIGINT;
BEGIN
  -- Guard: only fire on transitions TO 'ACCEPTED'
  IF NEW.status <> 'ACCEPTED' OR OLD.status = 'ACCEPTED' THEN
    RETURN NEW;
  END IF;

  -- Fetch team metadata
  SELECT event_id, max_size
    INTO v_event_id, v_max_size
    FROM public.teams
   WHERE id = NEW.team_id;

  -- Step 2: auto-reject if team became full between request and response
  SELECT COUNT(*) INTO v_cur_count
    FROM public.team_members
   WHERE team_id = NEW.team_id;

  IF v_cur_count >= v_max_size THEN
    -- Mutate the row to REJECTED instead of ACCEPTED
    NEW.status     := 'REJECTED';
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- Step 3: add to team_members
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.team_id, NEW.user_id, 'MEMBER')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- Step 4: link registration.team_id
  UPDATE public.registrations
     SET team_id = NEW.team_id
   WHERE user_id  = NEW.user_id
     AND event_id = v_event_id
     AND status  <> 'CANCELLED';

  -- Step 5: auto-reject all other PENDING requests from this user
  --         for teams belonging to the same event
  UPDATE public.team_join_requests
     SET status     = 'REJECTED',
         updated_at = NOW()
   WHERE user_id = NEW.user_id
     AND id      <> NEW.id
     AND status  = 'PENDING'
     AND team_id IN (
           SELECT id FROM public.teams WHERE event_id = v_event_id
         );

  -- Step 6: mark team COMPLETE if now full
  SELECT COUNT(*) INTO v_cur_count
    FROM public.team_members
   WHERE team_id = NEW.team_id;

  IF v_cur_count >= v_max_size THEN
    UPDATE public.teams
       SET status     = 'COMPLETE',
           updated_at = NOW()
     WHERE id = NEW.team_id AND status = 'FORMING';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_join_request_accepted ON public.team_join_requests;
CREATE TRIGGER trg_join_request_accepted
  BEFORE UPDATE ON public.team_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_join_request_accepted();


-- -----------------------------------------------------------------------------
-- 6e  handle_checkin_inserted
--     When a check_ins row is inserted, sync the denormalised columns
--     on registrations (checked_in, checked_in_at).
--     Mirrors: checkins/route.ts POST which does reg.checked_in = true.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handle_checkin_inserted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.registrations
     SET checked_in    = TRUE,
         checked_in_at = NEW.checked_in_at
   WHERE id = NEW.registration_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkin_inserted ON public.check_ins;
CREATE TRIGGER trg_checkin_inserted
  AFTER INSERT ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_checkin_inserted();


-- =============================================================================
-- 7. VIEWS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7.1  event_stats
--      Used by GET /api/events/[id]/analytics
--      Returns one row per event with all aggregate counts pre-computed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.event_stats AS
SELECT
  e.id                                                                            AS event_id,
  e.title,
  e.type,
  e.max_participants,
  COUNT(DISTINCT r.id)  FILTER (WHERE r.status <> 'CANCELLED')                   AS total_registrations,
  COUNT(DISTINCT r.id)  FILTER (WHERE r.status = 'CONFIRMED')                    AS confirmed_registrations,
  COUNT(DISTINCT ci.id)                                                           AS checked_in_count,
  COUNT(DISTINCT t.id)                                                            AS total_teams,
  COUNT(DISTINCT t.id)  FILTER (WHERE t.status = 'APPROVED')                     AS approved_teams,
  COUNT(DISTINCT r.id)  FILTER (WHERE r.team_id IS NOT NULL
                                  AND r.status <> 'CANCELLED')                   AS teamed_registrations,
  CASE
    WHEN COUNT(DISTINCT r.id) FILTER (WHERE r.status <> 'CANCELLED') = 0 THEN 0
    ELSE ROUND(
      COUNT(DISTINCT ci.id)::NUMERIC /
      NULLIF(COUNT(DISTINCT r.id) FILTER (WHERE r.status <> 'CANCELLED'), 0) * 100
    )
  END                                                                             AS checkin_rate,
  CASE
    WHEN e.type <> 'TEAM' THEN NULL
    WHEN COUNT(DISTINCT r.id) FILTER (WHERE r.status <> 'CANCELLED') = 0 THEN 0
    ELSE ROUND(
      COUNT(DISTINCT r.id) FILTER (WHERE r.team_id IS NOT NULL
                                    AND r.status <> 'CANCELLED')::NUMERIC /
      NULLIF(COUNT(DISTINCT r.id) FILTER (WHERE r.status <> 'CANCELLED'), 0) * 100
    )
  END                                                                             AS team_formation_rate
FROM      public.events        e
LEFT JOIN public.registrations r  ON r.event_id = e.id
LEFT JOIN public.check_ins     ci ON ci.event_id = e.id
LEFT JOIN public.teams         t  ON t.event_id  = e.id
GROUP BY  e.id, e.title, e.type, e.max_participants;


-- -----------------------------------------------------------------------------
-- 7.2  team_details
--      Used by GET /api/teams?event_id= and GET /api/teams/[id]/...
--      Attaches computed member_count and pending_requests to every team row.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.team_details AS
SELECT
  t.*,
  COUNT(DISTINCT tm.id)                                              AS member_count,
  COUNT(DISTINCT tjr.id) FILTER (WHERE tjr.status = 'PENDING')      AS pending_requests
FROM      public.teams              t
LEFT JOIN public.team_members       tm  ON tm.team_id  = t.id
LEFT JOIN public.team_join_requests tjr ON tjr.team_id = t.id
GROUP BY  t.id;


-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;


-- ── profiles ──────────────────────────────────────────────────────────────────
-- Public names/avatars needed by organizer chip on event cards
DROP POLICY IF EXISTS "profiles_select_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE USING (id = auth.uid());


-- ── events ────────────────────────────────────────────────────────────────────
-- Unauthenticated visitors (anon role) can read PUBLISHED and ONGOING events.
-- This is what powers the landing page carousel and /events public page.
DROP POLICY IF EXISTS "events_select_public"      ON public.events;
DROP POLICY IF EXISTS "events_select_own_all"     ON public.events;
DROP POLICY IF EXISTS "events_insert_organizer"   ON public.events;
DROP POLICY IF EXISTS "events_update_own"         ON public.events;
DROP POLICY IF EXISTS "events_delete_own_draft"   ON public.events;

CREATE POLICY "events_select_public"
  ON public.events FOR SELECT
  USING (status IN ('PUBLISHED','ONGOING'));

CREATE POLICY "events_select_own_all"
  ON public.events FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "events_insert_organizer"
  ON public.events FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "events_update_own"
  ON public.events FOR UPDATE
  USING (created_by = auth.uid());

-- Only allow deleting DRAFT or CANCELLED events
CREATE POLICY "events_delete_own_draft"
  ON public.events FOR DELETE
  USING (created_by = auth.uid() AND status IN ('DRAFT','CANCELLED'));


-- ── registrations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reg_select_own"             ON public.registrations;
DROP POLICY IF EXISTS "reg_select_organizer"       ON public.registrations;
DROP POLICY IF EXISTS "reg_insert_own"             ON public.registrations;
DROP POLICY IF EXISTS "reg_update_own"             ON public.registrations;
DROP POLICY IF EXISTS "reg_update_organizer"       ON public.registrations;

-- Participant sees their own registrations
CREATE POLICY "reg_select_own"
  ON public.registrations FOR SELECT
  USING (user_id = auth.uid());

-- Organizer sees all registrations for events they own (check-in page)
CREATE POLICY "reg_select_organizer"
  ON public.registrations FOR SELECT
  USING (event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid()));

-- Participant creates their own registration
CREATE POLICY "reg_insert_own"
  ON public.registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Participant can cancel their own
CREATE POLICY "reg_update_own"
  ON public.registrations FOR UPDATE
  USING (user_id = auth.uid());

-- Organizer can update check-in fields for their events
-- (triggered via check_ins insert, but direct update allowed too)
CREATE POLICY "reg_update_organizer"
  ON public.registrations FOR UPDATE
  USING (event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid()));


-- ── teams ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "teams_select_public_events"  ON public.teams;
DROP POLICY IF EXISTS "teams_insert_participant"    ON public.teams;
DROP POLICY IF EXISTS "teams_update_leader"         ON public.teams;
DROP POLICY IF EXISTS "teams_update_organizer"      ON public.teams;

-- Anyone (even unauth) can browse teams for public events (Find a Team page)
CREATE POLICY "teams_select_public_events"
  ON public.teams FOR SELECT
  USING (event_id IN (SELECT id FROM public.events WHERE status IN ('PUBLISHED','ONGOING')));

-- A registered participant creates a team for an event they're registered for
CREATE POLICY "teams_insert_participant"
  ON public.teams FOR INSERT
  WITH CHECK (
    leader_id = auth.uid()
    AND event_id IN (
      SELECT event_id FROM public.registrations
       WHERE user_id = auth.uid() AND status <> 'CANCELLED'
    )
  );

-- Leader can edit their own team
CREATE POLICY "teams_update_leader"
  ON public.teams FOR UPDATE
  USING (leader_id = auth.uid());

-- Organizer can update teams for their own events (approve/disqualify)
CREATE POLICY "teams_update_organizer"
  ON public.teams FOR UPDATE
  USING (event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid()));


-- ── team_members ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tm_select_public_events"  ON public.team_members;
DROP POLICY IF EXISTS "tm_insert_trigger"        ON public.team_members;

-- Public read (same scope as teams)
CREATE POLICY "tm_select_public_events"
  ON public.team_members FOR SELECT
  USING (team_id IN (
    SELECT t.id FROM public.teams t
    JOIN public.events e ON e.id = t.event_id
    WHERE e.status IN ('PUBLISHED','ONGOING')
  ));

-- Inserts happen exclusively through triggers (fn_handle_team_created,
-- fn_handle_join_request_accepted). We allow INSERT for authenticated users
-- so the triggers (running as the invoking user) succeed.
CREATE POLICY "tm_insert_trigger"
  ON public.team_members FOR INSERT
  WITH CHECK (TRUE);


-- ── team_join_requests ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "req_select_own_sent"      ON public.team_join_requests;
DROP POLICY IF EXISTS "req_select_leader"        ON public.team_join_requests;
DROP POLICY IF EXISTS "req_insert_participant"   ON public.team_join_requests;
DROP POLICY IF EXISTS "req_update_leader"        ON public.team_join_requests;

-- Participant sees requests they sent
CREATE POLICY "req_select_own_sent"
  ON public.team_join_requests FOR SELECT
  USING (user_id = auth.uid());

-- Team leader sees all requests for their team
CREATE POLICY "req_select_leader"
  ON public.team_join_requests FOR SELECT
  USING (team_id IN (SELECT id FROM public.teams WHERE leader_id = auth.uid()));

-- Participant can send a request (must be registered for the event)
CREATE POLICY "req_insert_participant"
  ON public.team_join_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND team_id IN (
      SELECT t.id FROM public.teams t
      JOIN public.registrations r
        ON r.event_id = t.event_id AND r.user_id = auth.uid()
       AND r.status <> 'CANCELLED'
    )
  );

-- Only the leader of the team can accept/reject
CREATE POLICY "req_update_leader"
  ON public.team_join_requests FOR UPDATE
  USING (team_id IN (SELECT id FROM public.teams WHERE leader_id = auth.uid()));


-- ── check_ins ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ci_select_organizer"  ON public.check_ins;
DROP POLICY IF EXISTS "ci_select_own"        ON public.check_ins;
DROP POLICY IF EXISTS "ci_insert_organizer"  ON public.check_ins;

CREATE POLICY "ci_select_organizer"
  ON public.check_ins FOR SELECT
  USING (event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid()));

CREATE POLICY "ci_select_own"
  ON public.check_ins FOR SELECT
  USING (registration_id IN (
    SELECT id FROM public.registrations WHERE user_id = auth.uid()
  ));

-- Only the organizer of an event can check people in
CREATE POLICY "ci_insert_organizer"
  ON public.check_ins FOR INSERT
  WITH CHECK (
    checked_in_by = auth.uid()
    AND event_id IN (SELECT id FROM public.events WHERE created_by = auth.uid())
  );


-- ── notifications ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notif_select_own"  ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own"  ON public.notifications;

CREATE POLICY "notif_select_own"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Mark read
CREATE POLICY "notif_update_own"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());


-- =============================================================================
-- 9. GRANTS
--    anon  = unauthenticated visitors (landing page, /events page)
--    authenticated = signed-in users
--    service_role  = server-side API routes (bypasses RLS when needed)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public read-only (unauthenticated landing page + /events page)
GRANT SELECT ON public.profiles             TO anon, authenticated;
GRANT SELECT ON public.events               TO anon, authenticated;
GRANT SELECT ON public.teams                TO anon, authenticated;
GRANT SELECT ON public.team_members         TO anon, authenticated;
GRANT SELECT ON public.event_stats          TO anon, authenticated;
GRANT SELECT ON public.team_details         TO anon, authenticated;

-- Authenticated user operations
GRANT INSERT, UPDATE         ON public.profiles             TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.registrations        TO authenticated;
GRANT INSERT, UPDATE         ON public.teams                TO authenticated;
GRANT SELECT, INSERT         ON public.team_members         TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.team_join_requests   TO authenticated;
GRANT SELECT, INSERT         ON public.check_ins            TO authenticated;
GRANT SELECT, UPDATE         ON public.notifications        TO authenticated;

-- Service role can insert notifications (sent from API routes server-side)
GRANT INSERT ON public.notifications TO service_role;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;


-- =============================================================================
-- 10. SEED DATA
--     Exactly mirrors lib/mock-data.ts.
--     UUIDs match the string IDs used in mock data
--     (mapped to valid UUID format for Postgres).
--
--     HOW TO USE:
--       Option A – Local Supabase dev (supabase start):
--         Uncomment the entire block and run it once.
--       Option B – Hosted Supabase:
--         Sign each user up through the app UI first (so auth.users rows exist),
--         then insert the events/teams/etc. data below, or use the app itself.
-- =============================================================================

/*
── Uncomment from here ─────────────────────────────────────────────────────────

-- Stable UUIDs derived from mock string IDs
-- user-org-1  → a0000001-0000-0000-0000-000000000001
-- user-org-2  → a0000002-0000-0000-0000-000000000002
-- user-p-1    → b0000001-0000-0000-0000-000000000001
-- user-p-2    → b0000002-0000-0000-0000-000000000002
-- user-p-3    → b0000003-0000-0000-0000-000000000003
-- user-p-4    → b0000004-0000-0000-0000-000000000004
-- event-1     → c0000001-0000-0000-0000-000000000001
-- event-2     → c0000002-0000-0000-0000-000000000002
-- event-3     → c0000003-0000-0000-0000-000000000003
-- team-1      → d0000001-0000-0000-0000-000000000001
-- team-2      → d0000002-0000-0000-0000-000000000002

-- Auth users (local dev only – hosted Supabase: sign up via app instead)
INSERT INTO auth.users
  (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data,
   created_at, updated_at, aud, role)
VALUES
  ('a0000001-0000-0000-0000-000000000001','organizer@eventos.dev',
   crypt('org123',gen_salt('bf')), NOW(),
   '{"name":"Alex Organizer","role":"ORGANIZER"}'::jsonb,
   NOW()-INTERVAL '30 days', NOW(), 'authenticated', 'authenticated'),

  ('a0000002-0000-0000-0000-000000000002','priya@eventos.dev',
   crypt('org123',gen_salt('bf')), NOW(),
   '{"name":"Priya Shah","role":"ORGANIZER"}'::jsonb,
   NOW()-INTERVAL '20 days', NOW(), 'authenticated', 'authenticated'),

  ('b0000001-0000-0000-0000-000000000001','participant@eventos.dev',
   crypt('part123',gen_salt('bf')), NOW(),
   '{"name":"Jamie Dev","role":"PARTICIPANT"}'::jsonb,
   NOW()-INTERVAL '10 days', NOW(), 'authenticated', 'authenticated'),

  ('b0000002-0000-0000-0000-000000000002','sam@eventos.dev',
   crypt('part123',gen_salt('bf')), NOW(),
   '{"name":"Sam Builder","role":"PARTICIPANT"}'::jsonb,
   NOW()-INTERVAL '8 days', NOW(), 'authenticated', 'authenticated'),

  ('b0000003-0000-0000-0000-000000000003','riya@eventos.dev',
   crypt('part123',gen_salt('bf')), NOW(),
   '{"name":"Riya Patel","role":"PARTICIPANT"}'::jsonb,
   NOW()-INTERVAL '7 days', NOW(), 'authenticated', 'authenticated'),

  ('b0000004-0000-0000-0000-000000000004','arjun@eventos.dev',
   crypt('part123',gen_salt('bf')), NOW(),
   '{"name":"Arjun Mehta","role":"PARTICIPANT"}'::jsonb,
   NOW()-INTERVAL '6 days', NOW(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Profiles are auto-created by trg_on_auth_user_created.
-- If you need to insert them manually (e.g. trigger didn't fire):
INSERT INTO public.profiles (id, email, name, role, created_at) VALUES
  ('a0000001-0000-0000-0000-000000000001','organizer@eventos.dev','Alex Organizer','ORGANIZER', NOW()-INTERVAL '30 days'),
  ('a0000002-0000-0000-0000-000000000002','priya@eventos.dev',    'Priya Shah',    'ORGANIZER', NOW()-INTERVAL '20 days'),
  ('b0000001-0000-0000-0000-000000000001','participant@eventos.dev','Jamie Dev',   'PARTICIPANT',NOW()-INTERVAL '10 days'),
  ('b0000002-0000-0000-0000-000000000002','sam@eventos.dev',       'Sam Builder',  'PARTICIPANT',NOW()-INTERVAL '8 days'),
  ('b0000003-0000-0000-0000-000000000003','riya@eventos.dev',      'Riya Patel',   'PARTICIPANT',NOW()-INTERVAL '7 days'),
  ('b0000004-0000-0000-0000-000000000004','arjun@eventos.dev',     'Arjun Mehta',  'PARTICIPANT',NOW()-INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- Events
INSERT INTO public.events
  (id, title, description, type, status, start_date, end_date, location,
   max_participants, min_team_size, max_team_size, registration_deadline,
   tags, created_by, created_at, updated_at)
VALUES
  (
    'c0000001-0000-0000-0000-000000000001',
    'HackFest 2025',
    'A 48-hour hackathon focused on building AI-powered solutions for real-world problems. Open to all skill levels.',
    'TEAM', 'PUBLISHED',
    NOW()+INTERVAL '7 days',  NOW()+INTERVAL '9 days',
    'Mumbai, India', 200, 2, 4,
    NOW()+INTERVAL '5 days',
    ARRAY['AI','Hackathon','Open Source'],
    'a0000001-0000-0000-0000-000000000001',
    NOW()-INTERVAL '10 days', NOW()-INTERVAL '2 days'
  ),
  (
    'c0000002-0000-0000-0000-000000000002',
    'Design Sprint Challenge',
    'A 24-hour individual design challenge where participants solve UX problems for emerging startups.',
    'INDIVIDUAL', 'PUBLISHED',
    NOW()+INTERVAL '14 days', NOW()+INTERVAL '15 days',
    'Bangalore, India', 100, NULL, NULL,
    NOW()+INTERVAL '12 days',
    ARRAY['Design','UX','Sprint'],
    'a0000002-0000-0000-0000-000000000002',
    NOW()-INTERVAL '5 days',  NOW()-INTERVAL '1 day'
  ),
  (
    'c0000003-0000-0000-0000-000000000003',
    'Open Source Summit',
    'Celebrating open source contributions with workshops and talks from industry leaders.',
    'INDIVIDUAL', 'ONGOING',
    NOW()-INTERVAL '1 day',   NOW()+INTERVAL '2 days',
    'Delhi, India', 500, NULL, NULL,
    NOW()-INTERVAL '2 days',
    ARRAY['Open Source','Community'],
    'a0000001-0000-0000-0000-000000000001',
    NOW()-INTERVAL '20 days', NOW()-INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- Teams (trigger inserts leader into team_members automatically)
INSERT INTO public.teams
  (id, event_id, name, description, status, leader_id, skills, max_size, created_at, updated_at)
VALUES
  (
    'd0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001',
    'Neural Ninjas',
    'Building an AI tool for accessibility. Looking for a designer and a backend dev.',
    'FORMING',
    'b0000002-0000-0000-0000-000000000002',  -- Sam Builder
    ARRAY['React','Python','ML','UI/UX'], 4,
    NOW()-INTERVAL '2 days', NOW()-INTERVAL '1 day'
  ),
  (
    'd0000002-0000-0000-0000-000000000002',
    'c0000001-0000-0000-0000-000000000001',
    'CodeCraft',
    'Web3 project for decentralized identity. Strong in Solidity and React.',
    'FORMING',
    'b0000004-0000-0000-0000-000000000004',  -- Arjun Mehta
    ARRAY['Solidity','React','Web3','Node.js'], 4,
    NOW()-INTERVAL '1 day',  NOW()-INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- Riya joins Neural Ninjas as MEMBER (leader already inserted by trigger)
INSERT INTO public.team_members (team_id, user_id, role, joined_at)
VALUES (
  'd0000001-0000-0000-0000-000000000001',
  'b0000003-0000-0000-0000-000000000003',   -- Riya Patel
  'MEMBER',
  NOW()-INTERVAL '1 day'
)
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Registrations
INSERT INTO public.registrations
  (id, event_id, user_id, status, qr_token, team_id, checked_in, checked_in_at, created_at)
VALUES
  -- Jamie → HackFest (no team yet)
  ('e0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000001',
   'b0000001-0000-0000-0000-000000000001',
   'CONFIRMED', 'QR-EVT1-USR1-A7K2', NULL, FALSE, NULL,
   NOW()-INTERVAL '3 days'),

  -- Sam → HackFest (Neural Ninjas)
  ('e0000002-0000-0000-0000-000000000002',
   'c0000001-0000-0000-0000-000000000001',
   'b0000002-0000-0000-0000-000000000002',
   'CONFIRMED', 'QR-EVT1-USR2-C3P8',
   'd0000001-0000-0000-0000-000000000001',
   FALSE, NULL, NOW()-INTERVAL '2 days'),

  -- Riya → HackFest (Neural Ninjas)
  ('e0000003-0000-0000-0000-000000000003',
   'c0000001-0000-0000-0000-000000000001',
   'b0000003-0000-0000-0000-000000000003',
   'CONFIRMED', 'QR-EVT1-USR3-D4Q1',
   'd0000001-0000-0000-0000-000000000001',
   FALSE, NULL, NOW()-INTERVAL '2 days'),

  -- Arjun → HackFest (CodeCraft)
  ('e0000004-0000-0000-0000-000000000004',
   'c0000001-0000-0000-0000-000000000001',
   'b0000004-0000-0000-0000-000000000004',
   'CONFIRMED', 'QR-EVT1-USR4-E5R9',
   'd0000002-0000-0000-0000-000000000002',
   FALSE, NULL, NOW()-INTERVAL '1 day'),

  -- Jamie → Open Source Summit (checked in)
  ('e0000005-0000-0000-0000-000000000005',
   'c0000003-0000-0000-0000-000000000003',
   'b0000001-0000-0000-0000-000000000001',
   'CONFIRMED', 'QR-EVT3-USR1-B9M4', NULL, TRUE,
   NOW()-INTERVAL '1 day',
   NOW()-INTERVAL '15 days')
ON CONFLICT (id) DO NOTHING;

-- Check-in record for Jamie at Open Source Summit
INSERT INTO public.check_ins
  (id, registration_id, event_id, checked_in_by, checked_in_at)
VALUES (
  'f0000001-0000-0000-0000-000000000001',
  'e0000005-0000-0000-0000-000000000005',
  'c0000003-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000001',   -- Alex checked them in
  NOW()-INTERVAL '1 day'
)
ON CONFLICT (registration_id) DO NOTHING;

-- Join request: Jamie → CodeCraft (PENDING)
INSERT INTO public.team_join_requests
  (id, team_id, user_id, status, message, created_at, updated_at)
VALUES (
  'g0000001-0000-0000-0000-000000000001',
  'd0000002-0000-0000-0000-000000000002',   -- CodeCraft
  'b0000001-0000-0000-0000-000000000001',   -- Jamie Dev
  'PENDING',
  'Hi! I''m a full-stack dev with React and Node.js experience. Would love to join CodeCraft!',
  NOW()-INTERVAL '1 hour', NOW()-INTERVAL '1 hour'
)
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Notifications
INSERT INTO public.notifications
  (id, user_id, title, message, type, category, read, action_url, created_at)
VALUES
  (
    'h0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000001',   -- Jamie
    'Registration Confirmed',
    'Your registration for HackFest 2025 is confirmed.',
    'SUCCESS', 'REGISTRATION', FALSE, '/participant',
    NOW()-INTERVAL '3 days'
  ),
  (
    'h0000002-0000-0000-0000-000000000002',
    'b0000002-0000-0000-0000-000000000002',   -- Sam (leader of Neural Ninjas)
    'Join Request Received',
    'Jamie Dev wants to join CodeCraft.',
    'INFO', 'TEAM', FALSE, '/participant/team',
    NOW()-INTERVAL '1 hour'
  )
ON CONFLICT (id) DO NOTHING;

── To here ──────────────────────────────────────────────────────────────────*/


-- =============================================================================
-- END OF SCHEMA
-- Everything above is idempotent and can be re-run safely.
-- =============================================================================
