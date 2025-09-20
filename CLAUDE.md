# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **production-ready** React Native pickleball session management app using Supabase for real-time data persistence. The app provides complete session management with player tracking, matchmaking, and comprehensive session history.

## Current Status

**✅ PRODUCTION READY** - All features implemented and polished:
- Session creation and management with soft delete
- Comprehensive player management (add/remove/restore players)
- Random matchmaking algorithm (2v2) with one match per round
- Match completion workflow with real-time updates
- Professional UI with Lucide icons and NativeWind styling
- Separate player management screen for better UX
- Complete session statistics and history tracking

## Architecture

**Tech Stack:**
- React Native with Expo (SDK 54)
- Supabase (PostgreSQL + Realtime)
- NativeWind v4 for styling
- TypeScript with generated database types
- React Navigation (Stack Navigator)
- Lucide React Native (for professional icons)

**Project Structure:**
```
├── lib/
│   ├── supabaseClient.ts         # Configured Supabase client
│   ├── database.types.ts         # Generated TypeScript types
│   └── pickleballService.ts      # Core business logic with soft deletes
├── screens/
│   ├── SessionListScreen.tsx     # View/create/delete sessions with stats
│   ├── SessionDetailScreen.tsx   # Session overview and match management
│   └── PlayerManagementScreen.tsx # Dedicated player management
├── supabase/
│   └── migrations/               # Database schema migrations with soft deletes
├── App.tsx                       # Main app with navigation
└── global.css                    # NativeWind styles
```

**Database Schema (with Soft Deletes):**
- `sessions`: Session management with soft delete (id, created_at, deleted_at)
- `players`: Player management with soft delete and availability (id, session_id, name, is_available, deleted_at)
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

All business logic is implemented with proper TypeScript typing and soft deletes:
- `createSession()`: Creates new pickleball session with timestamp naming
- `deleteSession(sessionId: string)`: Soft deletes session (preserves history)
- `addPlayer(sessionId: string, name: string)`: Adds player to session
- `removePlayer(playerId: string)`: Soft deletes player (preserves match history)
- `restorePlayer(playerId: string)`: Restores soft-deleted player as available
- `generateRound(sessionId: string, roundNumber: number)`: Creates one 2v2 match from 4 available players
- `completeMatch(matchId: string)`: Marks match complete and frees players

## UI Components

**SessionListScreen:**
- View all active sessions with comprehensive statistics
- Date/time-based session naming (e.g., "Dec 20, 2:30 PM")
- Session statistics: total players and total matches
- Delete sessions with confirmation dialog
- Real-time updates with focus refresh

**SessionDetailScreen (Session Overview):**
- Session overview with player count metrics (total/available)
- "Manage Players" button navigating to dedicated screen
- Round generation (requires 4 available players)
- Match display and completion workflow
- Real-time updates across all data changes

**PlayerManagementScreen (Dedicated Player Management):**
- Add players manually or via demo button with numbered names
- Remove players with immediate UI feedback
- Restore removed players back to active status
- View active and removed players separately
- Real-time synchronization with session overview

## Real-time Features

**Supabase Subscriptions:**
- Live session list updates with automatic refresh on focus
- Real-time player management synchronization between screens
- Instant match creation/completion sync across devices
- Automatic UI refresh on all data changes

**Subscription Channels (with unique naming):**
- `sessions-list` for session list updates
- `players-${sessionId}` for player management screen
- `session-players-${sessionId}` for session detail screen
- `session-matches-${sessionId}` for match updates
- `session-match-players-${sessionId}` for match player assignments

## Key Implementation Features

**Soft Delete System:**
- Sessions and players use soft deletes (deleted_at timestamp)
- Preserves complete historical data for matches and participation
- Allows restoration of accidentally removed items
- Maintains referential integrity across all relationships

**Advanced UI/UX:**
- Optimistic UI updates for immediate feedback
- Professional Lucide icons throughout the interface
- Focus-based refresh ensuring data consistency on screen transitions
- Comprehensive error handling with user-friendly messages
- Confirmation dialogs for destructive actions

**Session Management:**
- Automatic timestamp-based session naming
- Comprehensive session statistics (players/matches)
- One match per round generation (prevents over-scheduling)
- Separated concerns: overview vs detailed management

## Testing & Development

**Local Testing:**
- Use local Supabase instance for development
- Test real-time features with multiple browser tabs/devices
- Supabase Studio available at `http://127.0.0.1:54323`

**Production Deployment:**
- Set up production Supabase project
- Update `.env` with production credentials
- Build with `npx expo build` or EAS Build