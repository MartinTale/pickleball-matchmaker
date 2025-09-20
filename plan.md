# SPEC-1-Pickleball-Session-App

## Background

Pickleball is a fast-growing sport where casual players often need a quick and fair way to organize matches. Currently, it is cumbersome for players to manage sessions manually, keep track of who is playing, and create balanced teams. The proposed app will streamline this by allowing players to create sessions, dynamically add or remove players, and automatically generate matches.

The app will:

- Let a session owner (or group) manage players.
- Enable multiple matches to be played in parallel.
- Initially create teams randomly, with room to expand toward more advanced matchmaking logic in the future.

---

## Requirements

**Must Have**

- Users can create a pickleball session.
- Users can join or leave a session.
- Session owner can add or remove players at any time.
- Users can generate a new round inside a session.
- When a round is generated, the system forms 2 vs 2 matches from the current player pool.
- Players already assigned to an active match are unavailable until that match ends.
- Multiple matches can run simultaneously in the same session.

**Should Have**

- Ability to mark a match as completed so players return to the available pool.
- Session persists in Supabase (real-time updates across clients).
- Basic player identifiers (name, maybe avatar).

**Could Have**

- More sophisticated matchmaking logic (based on skill, past matches, or fairness).
- Session chat or notes.
- Push notifications for match readiness.

---

## Method

### High-Level Architecture

- **React Native App**: UI for creating sessions, adding/removing players, generating rounds, viewing matches.
- **Supabase Backend**: Manages persistence (Postgres), realtime sync (Supabase Realtime), and lightweight auth (anonymous).
- **Matchmaking Logic**: Runs in the client (for MVP) to randomly generate teams.

---

### Database Schema (Supabase / Postgres)

#### `sessions`

| column     | type      | notes             |
| ---------- | --------- | ----------------- |
| id (PK)    | uuid      | unique session id |
| name       | text      | session name      |
| created_at | timestamp | default now()     |

#### `players`

| column       | type      | notes                          |
| ------------ | --------- | ------------------------------ |
| id (PK)      | uuid      | player id                      |
| session_id   | uuid (FK) | belongs to a session           |
| name         | text      | player name                    |
| is_available | boolean   | true if not in an active match |

#### `matches`

| column       | type      | notes                        |
| ------------ | --------- | ---------------------------- |
| id (PK)      | uuid      | match id                     |
| session_id   | uuid (FK) | belongs to a session         |
| round_number | int       | round index inside a session |
| status       | text      | "active" or "completed"      |
| created_at   | timestamp |                              |

#### `match_players`

| column         | type | notes               |
| -------------- | ---- | ------------------- |
| id (PK)        | uuid | unique id           |
| match_id (FK)  | uuid | belongs to a match  |
| player_id (FK) | uuid | belongs to a player |
| team           | int  | 1 or 2              |

---

### Matchmaking Algorithm (MVP)

1. Query all **available players** in the session.
2. Randomly shuffle them.
3. Take 4 players at a time → create a match.
4. Assign 2 to team A, 2 to team B.
5. Set those players’ `is_available = false`.
6. Repeat until fewer than 4 players remain.

---

## Implementation

1. **Project Setup**

   - Initialize React Native project (`expo` recommended for speed).
   - Add Supabase JS client (`@supabase/supabase-js`).
   - Configure Supabase URL + anon key.

2. **Database Setup (Supabase)**

   - Create tables: `sessions`, `players`, `matches`, `match_players`.
   - Add foreign key constraints (`session_id`, `player_id`).
   - Enable **Realtime** on these tables.

3. **Core Features**

   - **Create Session**: Insert new row in `sessions`.
   - **Join Session**: Insert into `players`.
   - **Add / Remove Players**: Insert/delete in `players`.
   - **Generate Round**:
     - Client fetches all available players.
     - Runs matchmaking algorithm.
     - Inserts into `matches` + `match_players`.
     - Updates `players.is_available=false` for selected players.
   - **Complete Match**:
     - Update `matches.status="completed"`.
     - Set `players.is_available=true`.

4. **Realtime Sync**

   - Subscribe to `players` and `matches` tables.
   - Auto-refresh UI when changes occur.

5. **UI Components**

   - **Session List Screen**: View/create sessions.
   - **Session Detail Screen**: Player list + match list.
   - **Match Detail Screen**: View teams and mark as complete.
   - **Floating Action Button**: Generate new round.

6. **UI Library**
   - Use **NatievWind**.

---

## Milestones

**✅ Milestone 1 – Setup & Foundations** _(COMPLETED)_

- ✅ Initialize React Native (Expo) project.
- ✅ Integrate Supabase client.
- ✅ Set up database schema in Supabase (`sessions`, `players`, `matches`, `match_players`).
- ✅ Enable Supabase Realtime.

**✅ Milestone 2 – Session Management** _(COMPLETED)_

- ✅ Create session.
- ✅ Join session (add players).
- ✅ Remove players.
- ✅ Display player list with realtime sync.

**✅ Milestone 3 – Matchmaking MVP** _(COMPLETED)_

- ✅ Implement client-side random team generation.
- ✅ Insert match + match_players into Supabase.
- ✅ Mark players as unavailable when assigned.
- ✅ Allow multiple matches in parallel.

**✅ Milestone 4 – Match Completion Flow** _(COMPLETED)_

- ✅ Mark match as completed.
- ✅ Return players to available pool.
- ✅ Update UI in realtime.

**✅ Milestone 5 – UI Polish** _(COMPLETED)_

- ✅ Add navigation structure (session list → session detail).
- ✅ Integrate UI library (NativeWind).
- ✅ Basic styling (session cards, player chips, match list).

**✅ Milestone 6 – Advanced Features & Polish** _(COMPLETED)_

- ✅ Soft delete system for sessions and players
- ✅ Professional UI with Lucide icons
- ✅ Separate player management screen
- ✅ Player restore functionality
- ✅ Session statistics and history tracking
- ✅ Optimistic UI updates and focus refresh

**🔄 Milestone 7 – Testing & Deployment** _(READY)_

- ✅ Multi-device testing with realtime sync
- ✅ Race condition prevention (one match per round)
- ⏳ Deploy app build via Expo Go or TestFlight/Play Store

---

## Current Implementation Status

### ✅ **COMPLETED FEATURES**

**Core Infrastructure:**
- ✅ React Native Expo project with TypeScript
- ✅ Supabase client configured with generated types
- ✅ NativeWind styling system with Lucide icons
- ✅ React Navigation with Stack Navigator (3 screens)
- ✅ Database schema with soft delete migrations
- ✅ Local Supabase development environment

**Business Logic (`lib/pickleballService.ts`):**
- ✅ `createSession()` - Create sessions with timestamp naming
- ✅ `deleteSession()` - Soft delete sessions (preserves history)
- ✅ `addPlayer()` - Add players to sessions
- ✅ `removePlayer()` - Soft delete players (preserves match history)
- ✅ `restorePlayer()` - Restore soft-deleted players
- ✅ `generateRound()` - Create one 2v2 match per round (prevents over-scheduling)
- ✅ `completeMatch()` - Mark matches complete and free players

**UI Screens:**
- ✅ `SessionListScreen` - View/create/delete sessions with comprehensive stats
- ✅ `SessionDetailScreen` - Session overview with player metrics and match management
- ✅ `PlayerManagementScreen` - Dedicated player management with restore functionality

**Advanced Features:**
- ✅ Soft delete system preserving complete historical data
- ✅ Professional Lucide icons throughout interface
- ✅ Optimistic UI updates for immediate feedback
- ✅ Focus-based refresh ensuring data consistency
- ✅ Comprehensive session statistics (total players/matches)
- ✅ Player restoration from removed status
- ✅ Real-time synchronization across all screens
- ✅ Confirmation dialogs for destructive actions

**Real-time Features:**
- ✅ Live session list updates with focus refresh
- ✅ Real-time player management sync between screens
- ✅ Instant match creation/completion updates
- ✅ Cross-device synchronization with unique channel naming

### ⏳ **REMAINING TASKS**

**Production Deployment:**
- ⏳ Production Supabase project setup
- ⏳ Environment configuration for production
- ⏳ Expo build configuration (EAS Build)
- ⏳ App store deployment preparation

**Future Enhancements (Optional):**
- ⏳ Session joining via codes/links
- ⏳ Player skill levels or ratings
- ⏳ Push notifications for match readiness
- ⏳ Advanced statistics and analytics
- ⏳ Export session data functionality

---

## Gathering Results

To verify that the system meets the requirements, we will focus on functional validation and user experience feedback:

**Functional Validation**

- ✅ Users can create sessions with automatic timestamp naming
- ✅ Sessions can be soft-deleted with confirmation dialog
- ✅ Players can be added/removed/restored dynamically with realtime sync
- ✅ Generating rounds creates exactly one 2v2 match per round
- ✅ Players in active matches are unavailable until match completion
- ✅ Match completion returns players to available pool
- ✅ Comprehensive session statistics display correctly
- ✅ Player management separated into dedicated screen

**User Experience Checks**

- ✅ UI updates seamlessly with optimistic updates and focus refresh
- ✅ Professional icon design throughout the interface
- ✅ Immediate feedback on all user actions
- ✅ Clear separation between session overview and detailed management
- ✅ Confirmation dialogs prevent accidental destructive actions
- ✅ Intuitive navigation flow between screens

**Performance & Reliability**

- ✅ Supabase realtime handles updates across multiple clients
- ✅ Race condition prevention (one match per round generation)
- ✅ Soft delete system preserves complete historical data
- ✅ Focus-based refresh ensures data consistency on navigation
- ✅ Unique subscription channels prevent conflicts
- ✅ App works reliably with comprehensive error handling

**Feedback Loop**

- Conduct test sessions with small groups (4–12 players).
- Gather feedback on ease of use, clarity of UI, and fairness of random team assignments.
- Use findings to prioritize future enhancements (e.g., smarter matchmaking, chat, notifications).
