# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **completed MVP** React Native pickleball session management app using Supabase for real-time data persistence. The app allows users to create pickleball sessions, manage players dynamically, and generate balanced 2v2 matches.

## Current Status

**✅ MVP COMPLETE** - All core features implemented and working:
- Session creation and management
- Player addition/removal with real-time sync
- Random matchmaking algorithm (2v2)
- Match completion workflow
- Professional UI with NativeWind styling (fully configured and working)

## Architecture

**Tech Stack:**
- React Native with Expo (SDK 54)
- Supabase (PostgreSQL + Realtime)
- NativeWind v4 for styling
- TypeScript with generated database types
- React Navigation (Stack Navigator)

**Project Structure:**
```
├── lib/
│   ├── supabaseClient.ts       # Configured Supabase client
│   ├── database.types.ts       # Generated TypeScript types
│   └── pickleballService.ts    # Core business logic
├── screens/
│   ├── SessionListScreen.tsx   # View/create sessions
│   └── SessionDetailScreen.tsx # Manage players & matches
├── supabase/
│   └── migrations/             # Database schema migrations
├── App.tsx                     # Main app with navigation
└── global.css                  # NativeWind styles
```

**Database Schema:**
- `sessions`: Session management (id, name, created_at)
- `players`: Player management with availability tracking (id, session_id, name, is_available)
- `matches`: Match tracking with round numbers (id, session_id, round_number, status)
- `match_players`: Many-to-many relationship for match assignments (match_id, player_id, team)

## Development Setup

**Requirements:**
- Node.js and npm
- Docker (for local Supabase)
- Expo CLI

**Commands:**
- `npm install` - Install dependencies
- `npx supabase start` - Start local Supabase (requires Docker)
- `npm start` - Start Expo development server
- `npx supabase gen types typescript --local > lib/database.types.ts` - Regenerate types

**Environment:**
- Copy `.env.example` to `.env` and configure Supabase credentials
- Local development uses `http://127.0.0.1:54321` for Supabase URL
- **NativeWind is fully configured** - requires `babel-preset-expo` and proper babel.config.js

## Core Service Layer (`lib/pickleballService.ts`)

All business logic is implemented with proper TypeScript typing:
- `createSession(name: string)`: Creates new pickleball session
- `addPlayer(sessionId: string, name: string)`: Adds player to session
- `removePlayer(playerId: string)`: Removes player from session
- `generateRound(sessionId: string, roundNumber: number)`: Creates matches from available players
- `completeMatch(matchId: string)`: Marks match complete and frees players

## UI Components

**SessionListScreen:**
- View all sessions with real-time updates
- Create new sessions
- Navigate to session details

**SessionDetailScreen:**
- Add/remove players with live status indicators
- Generate rounds with available players
- View active/completed matches
- Complete matches to free players

## Real-time Features

**Supabase Subscriptions:**
- Live player list updates across devices
- Instant match creation/completion sync
- Automatic UI refresh on data changes

**Subscription Channels:**
- `players` table changes filtered by session_id
- `matches` table changes filtered by session_id
- `match_players` table changes for match assignments

## Key Implementation Notes

**Current Limitations to Address:**
- Race condition handling for concurrent round generation
- Error handling for edge cases
- Performance optimization for large player counts

**Working Features:**
- Player availability state management
- Real-time updates across multiple devices
- Minimum 4 players validation for match generation
- Multiple concurrent matches per session

## Testing & Development

**Local Testing:**
- Use local Supabase instance for development
- Test real-time features with multiple browser tabs/devices
- Supabase Studio available at `http://127.0.0.1:54323`

**Production Deployment:**
- Set up production Supabase project
- Update `.env` with production credentials
- Build with `npx expo build` or EAS Build