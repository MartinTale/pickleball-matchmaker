# Pickleball Matchmaker

A React Native app for managing pickleball sessions, players, and generating balanced 2v2 matches with intelligent matchmaking algorithms.

## Features

### Session Management
- Create sessions with configurable court counts
- Soft delete with session history preservation
- Real-time updates across devices
- Comprehensive session statistics

### Player Management
- Add/remove players dynamically with soft delete
- Restore removed players back to active status
- Weighted priority system based on match participation
- Visual weight indicators (green=low, yellow=mid, red=high)
- Track match history and last played round

### Intelligent Matchmaking
- Weighted player selection prioritizes those who've played less
- Global optimization across all courts simultaneously
- Partnership/opponent history tracking to maximize variety
- Penalty system: 4x weight for repeated partnerships, 1x for opponents
- Support for multiple simultaneous matches (multiple courts)
- Partial round generation when insufficient players available

### Match Management
- Generate balanced 2v2 matches
- Round-based organization with grouped display
- Match completion workflow
- Weight updates on round generation (not completion)

## Tech Stack

- React Native with Expo
- Supabase (PostgreSQL + Realtime)
- NativeWind for styling
- TypeScript

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Fill in your Supabase credentials in `.env`

### 3. Run Database Migrations

If you want to use a local Supabase instance for development:

```bash
npx supabase start
```

For production, apply the migration to your Supabase project:

```bash
npx supabase db push
```

### 4. Start the App

```bash
npm start
```

## Database Schema

The app uses five main tables:

- `sessions`: Session management with `court_count` and soft delete
- `players`: Player management with `matches_played` (NUMERIC), `is_available`, `last_match_round`, and soft delete
- `matches`: Match tracking with `round_number` and `status`
- `match_players`: Many-to-many relationship for match assignments with team numbers
- `player_history`: Partnership/opponent tracking with counts and last round

## Weight System

**Weight Calculation:** `weight = matches_played × 100`

**Weight Updates on Round Generation:**
- Selected players: +1 match
- Removed players: +`(matches_created / total_courts)` matches
- Available but not selected: No change (maintains priority)

**New Player Initial Weight:** Set to minimum weight across all players (including removed)

## Usage

1. **Create a Session**: Start by creating a new pickleball session and specify number of courts
2. **Add Players**: Add players to the session (manually or via demo button)
3. **Manage Players**: View weights, remove/restore players as needed
4. **Generate Matches**: Click "Generate Round" to create optimized 2v2 matches
   - Requires 4+ available players (or shows partial round warning)
   - Creates matches for all courts when possible
5. **Complete Matches**: Mark matches as complete to return players to the available pool
6. **Repeat**: Generate new rounds - weights automatically update to prioritize those who've played less

## Development

### Generate TypeScript Types

After making schema changes:

```bash
npx supabase gen types typescript --local > lib/database.types.ts
```

### Local Development

The app supports local Supabase development. Make sure Docker is running and use:

```bash
npx supabase start
npx supabase stop
```