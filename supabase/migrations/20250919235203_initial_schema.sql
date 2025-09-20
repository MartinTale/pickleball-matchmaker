-- Sessions table
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

-- Players table
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  name text not null,
  is_available boolean not null default true,
  created_at timestamp with time zone default now()
);

-- Matches table
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  round_number int not null,
  status text not null default 'active', -- 'active' or 'completed'
  created_at timestamp with time zone default now()
);

-- Match Players table
create table if not exists match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  team int not null check (team in (1, 2))
);

-- Indexes for faster queries
create index if not exists idx_players_session_id on players(session_id);
create index if not exists idx_matches_session_id on matches(session_id);
create index if not exists idx_match_players_match_id on match_players(match_id);

-- Enable Realtime on key tables
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_players;