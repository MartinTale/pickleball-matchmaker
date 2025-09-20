# Pickleball Matchmaker

A React Native app for managing pickleball sessions, players, and generating balanced 2v2 matches.

## Features

- Create and manage pickleball sessions
- Add/remove players dynamically
- Generate balanced random matches (2v2)
- Real-time updates across devices
- Player availability tracking
- Match completion tracking

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

The app uses four main tables:

- `sessions`: Session management
- `players`: Player management with availability tracking
- `matches`: Match tracking with round numbers
- `match_players`: Many-to-many relationship for match assignments

## Usage

1. **Create a Session**: Start by creating a new pickleball session
2. **Add Players**: Add players to the session
3. **Generate Matches**: Click "Generate Round" to create balanced 2v2 matches from available players
4. **Complete Matches**: Mark matches as complete to return players to the available pool
5. **Repeat**: Generate new rounds as needed

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