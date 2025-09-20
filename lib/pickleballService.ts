import { supabase } from "./supabaseClient";
import { Database } from "./database.types";

type Tables = Database['public']['Tables'];
type Session = Tables['sessions']['Row'];
type Player = Tables['players']['Row'];
type Match = Tables['matches']['Row'];
type MatchPlayer = Tables['match_players']['Row'];

export interface MatchWithPlayers {
  match: Match;
  players: MatchPlayer[];
}

export async function createSession(): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({})
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addPlayer(sessionId: string, name: string): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .insert({ session_id: sessionId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removePlayer(playerId: string): Promise<void> {
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId);

  if (error) throw error;
}

export async function completeMatch(matchId: string): Promise<void> {
  // Update match status
  const { error: matchError } = await supabase
    .from("matches")
    .update({ status: "completed" })
    .eq("id", matchId);

  if (matchError) throw matchError;

  // Get players in this match
  const { data: matchPlayers, error: playersError } = await supabase
    .from("match_players")
    .select("player_id")
    .eq("match_id", matchId);

  if (playersError) throw playersError;

  // Mark players as available
  const playerIds = matchPlayers
    .map(mp => mp.player_id)
    .filter((id): id is string => id !== null);

  if (playerIds.length > 0) {
    const { error: updateError } = await supabase
      .from("players")
      .update({ is_available: true })
      .in("id", playerIds);

    if (updateError) throw updateError;
  }
}

export async function generateRound(sessionId: string, roundNumber: number): Promise<MatchWithPlayers[]> {
  // Fetch available players
  const { data: players, error: fetchError } = await supabase
    .from("players")
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_available", true);

  if (fetchError) throw fetchError;

  if (!players || players.length < 4) {
    throw new Error("Not enough players to start a match. Need at least 4 players.");
  }

  // Shuffle players randomly
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const createdMatches: MatchWithPlayers[] = [];

  // Create matches in groups of 4
  for (let i = 0; i + 3 < shuffledPlayers.length; i += 4) {
    const group = shuffledPlayers.slice(i, i + 4);

    // Create match
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        session_id: sessionId,
        round_number: roundNumber,
        status: "active"
      })
      .select()
      .single();

    if (matchError) throw matchError;

    // Create match player assignments
    const matchPlayerInserts = [
      { match_id: match.id, player_id: group[0].id, team: 1 },
      { match_id: match.id, player_id: group[1].id, team: 1 },
      { match_id: match.id, player_id: group[2].id, team: 2 },
      { match_id: match.id, player_id: group[3].id, team: 2 },
    ];

    const { data: matchPlayers, error: mpError } = await supabase
      .from("match_players")
      .insert(matchPlayerInserts)
      .select();

    if (mpError) throw mpError;

    // Mark players as unavailable
    const playerIds = group.map(p => p.id);
    const { error: updateError } = await supabase
      .from("players")
      .update({ is_available: false })
      .in("id", playerIds);

    if (updateError) throw updateError;

    createdMatches.push({
      match,
      players: matchPlayers || []
    });
  }

  return createdMatches;
}