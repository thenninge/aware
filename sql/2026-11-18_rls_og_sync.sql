-- =====================================================================
-- Aware: RLS på lagets tabeller + kolonner for rask synk
-- Kjøres én gang i Supabase → SQL Editor, FØR ny app-versjon deployes.
-- Trygt å kjøre flere ganger. Ingen data slettes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Del 1: Skru på RLS (Row Level Security)
--
-- Appens server bruker service role-nøkkelen, som går forbi RLS, så appen
-- påvirkes ikke. Uten policyer stenger dette ute alle som bare har den
-- offentlige anon-nøkkelen (som ligger i repoet).
-- Tabeller som ikke hører til Aware (scope_packs, spot_scenes, game_saves)
-- er ikke tatt med.
-- ---------------------------------------------------------------------
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.team_invitations enable row level security;
alter table public.posts            enable row level security;
alter table public.tracks           enable row level security;
alter table public.finds            enable row level security;
alter table public.observations     enable row level security;

-- ---------------------------------------------------------------------
-- Del 2: Synk-kolonner
--
-- updated_at: settes automatisk ved hver endring, så appen kan spørre
--             «hva er endret siden sist?» i stedet for å hente alt.
-- deleted_at: sletting blir et merke i stedet for at raden forsvinner,
--             så de andre telefonene på laget får vite om slettingen.
-- ---------------------------------------------------------------------
alter table public.posts        add column if not exists updated_at timestamptz not null default now();
alter table public.tracks       add column if not exists updated_at timestamptz not null default now();
alter table public.finds        add column if not exists updated_at timestamptz not null default now();
alter table public.observations add column if not exists updated_at timestamptz not null default now();

alter table public.posts        add column if not exists deleted_at timestamptz;
alter table public.tracks       add column if not exists deleted_at timestamptz;
alter table public.finds        add column if not exists deleted_at timestamptz;
alter table public.observations add column if not exists deleted_at timestamptz;

-- Eksisterende rader: bruk opprettelsestidspunktet (før triggeren lages)
update public.posts        set updated_at = coalesce(created_at, updated_at) where updated_at > created_at;
update public.tracks       set updated_at = coalesce(created_at, updated_at) where updated_at > created_at;
update public.finds        set updated_at = coalesce(created_at, updated_at) where updated_at > created_at;
update public.observations set updated_at = coalesce(created_at, updated_at) where updated_at > created_at;

-- Oppdater updated_at automatisk ved hver endring
create or replace function public.aware_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aware_touch_updated_at on public.posts;
create trigger aware_touch_updated_at before update on public.posts
  for each row execute function public.aware_touch_updated_at();

drop trigger if exists aware_touch_updated_at on public.tracks;
create trigger aware_touch_updated_at before update on public.tracks
  for each row execute function public.aware_touch_updated_at();

drop trigger if exists aware_touch_updated_at on public.finds;
create trigger aware_touch_updated_at before update on public.finds
  for each row execute function public.aware_touch_updated_at();

drop trigger if exists aware_touch_updated_at on public.observations;
create trigger aware_touch_updated_at before update on public.observations
  for each row execute function public.aware_touch_updated_at();

-- Raske oppslag på «lag + endret siden»
create index if not exists posts_team_updated_idx        on public.posts (teamid, updated_at);
create index if not exists tracks_team_updated_idx       on public.tracks (teamid, updated_at);
create index if not exists finds_team_updated_idx        on public.finds (teamid, updated_at);
create index if not exists observations_team_updated_idx on public.observations (teamid, updated_at);

-- ---------------------------------------------------------------------
-- Kontroll: alle Aware-tabellene skal vise rowsecurity = true,
-- og de fire synk-tabellene skal ha updated_at og deleted_at.
-- ---------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('teams','team_members','team_invitations','posts','tracks','finds','observations')
order by tablename;
