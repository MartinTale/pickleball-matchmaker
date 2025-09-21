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

export interface PlayerWeight {
  player: Player;
  weight: number;
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

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) throw error;
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
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", playerId);

  if (error) throw error;
}

export async function restorePlayer(playerId: string): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update({
      deleted_at: null,
      is_available: true // Restore as available player
    })
    .eq("id", playerId);

  if (error) throw error;
}

export async function completeMatch(matchId: string): Promise<void> {
  // Get match details and players
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*, match_players(*)")
    .eq("id", matchId)
    .single();

  if (matchError) throw matchError;

  // Update match status
  const { error: updateError } = await supabase
    .from("matches")
    .update({ status: "completed" })
    .eq("id", matchId);

  if (updateError) throw updateError;

  // Get players in this match
  const matchPlayers = match.match_players as MatchPlayer[];
  const playerIds = matchPlayers
    .map(mp => mp.player_id)
    .filter((id): id is string => id !== null);

  if (playerIds.length > 0) {
    // Mark players as available and update their match history
    for (const playerId of playerIds) {
      const { data: player } = await supabase
        .from("players")
        .select("matches_played")
        .eq("id", playerId)
        .single();

      const { error: updateError } = await supabase
        .from("players")
        .update({
          is_available: true,
          last_match_round: match.round_number,
          matches_played: (player?.matches_played || 0) + 1
        })
        .eq("id", playerId)
        .is("deleted_at", null);

      if (updateError) throw updateError;
    }

    // Update player history for partnerships and opponents
    await updatePlayerHistory(match.session_id!, matchPlayers, match.round_number);
  }
}

async function updatePlayerHistory(sessionId: string, matchPlayers: MatchPlayer[], roundNumber: number): Promise<void> {
  const team1 = matchPlayers.filter(mp => mp.team === 1);
  const team2 = matchPlayers.filter(mp => mp.team === 2);

  // Track partnerships (same team)
  const partnerships = [
    [team1[0], team1[1]],
    [team2[0], team2[1]]
  ];

  // Track opponents (different teams)
  const opponents = [];
  for (const t1Player of team1) {
    for (const t2Player of team2) {
      opponents.push([t1Player, t2Player]);
    }
  }

  // Insert/update partnership history
  for (const [p1, p2] of partnerships) {
    if (p1?.player_id && p2?.player_id) {
      await upsertPlayerHistory(sessionId, p1.player_id, p2.player_id, 'partner', roundNumber);
      await upsertPlayerHistory(sessionId, p2.player_id, p1.player_id, 'partner', roundNumber);
    }
  }

  // Insert/update opponent history
  for (const [p1, p2] of opponents) {
    if (p1?.player_id && p2?.player_id) {
      await upsertPlayerHistory(sessionId, p1.player_id, p2.player_id, 'opponent', roundNumber);
      await upsertPlayerHistory(sessionId, p2.player_id, p1.player_id, 'opponent', roundNumber);
    }
  }
}

async function upsertPlayerHistory(
  sessionId: string,
  playerId: string,
  otherPlayerId: string,
  relationshipType: 'partner' | 'opponent',
  roundNumber: number
): Promise<void> {
  // Check if record exists
  const { data: existing } = await supabase
    .from("player_history")
    .select("count")
    .eq("session_id", sessionId)
    .eq("player_id", playerId)
    .eq("other_player_id", otherPlayerId)
    .eq("relationship_type", relationshipType)
    .single();

  const { error } = await supabase
    .from("player_history")
    .upsert({
      session_id: sessionId,
      player_id: playerId,
      other_player_id: otherPlayerId,
      relationship_type: relationshipType,
      last_round: roundNumber,
      count: (existing?.count || 0) + 1,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'session_id,player_id,other_player_id,relationship_type'
    });

  if (error) throw error;
}

async function calculatePlayerWeights(sessionId: string, currentRound: number): Promise<PlayerWeight[]> {
  // Get all available players
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_available", true)
    .is("deleted_at", null);

  if (playersError) throw playersError;
  if (!players) return [];

  // Get player history for partnerships and opponents
  const { data: history, error: historyError } = await supabase
    .from("player_history")
    .select("*")
    .eq("session_id", sessionId);

  if (historyError) throw historyError;

  const playerWeights: PlayerWeight[] = [];

  for (const player of players) {
    let weight = 100; // Base weight

    // Weight based on rounds since last match (higher = longer wait)
    const roundsSinceLastMatch = currentRound - (player.last_match_round || 0);
    weight += roundsSinceLastMatch * 20;

    // Weight based on total matches played (lower = fewer games)
    const matchesPlayed = player.matches_played || 0;
    weight += Math.max(0, 5 - matchesPlayed) * 10;

    playerWeights.push({ player, weight });
  }

  return playerWeights.sort((a, b) => b.weight - a.weight);
}

function selectWeightedPlayers(playerWeights: PlayerWeight[], count: number = 4): Player[] {
  if (playerWeights.length < count) {
    return playerWeights.map(pw => pw.player);
  }

  const selected: Player[] = [];
  const available = [...playerWeights];

  for (let i = 0; i < count; i++) {
    // Use weighted random selection
    const totalWeight = available.reduce((sum, pw) => sum + pw.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedIndex = 0;
    for (let j = 0; j < available.length; j++) {
      random -= available[j].weight;
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }

    selected.push(available[selectedIndex].player);
    available.splice(selectedIndex, 1);
  }

  return selected;
}

async function optimizeTeams(
  players: Player[],
  sessionId: string
): Promise<{ team1: Player[]; team2: Player[] }> {
  // Get partnership/opponent history for these players
  const playerIds = players.map(p => p.id);
  const { data: history, error } = await supabase
    .from("player_history")
    .select("*")
    .eq("session_id", sessionId)
    .in("player_id", playerIds)
    .in("other_player_id", playerIds);

  if (error) throw error;

  const historyMap = new Map<string, { partners: number; opponents: number }>();

  // Build history matrix
  for (const p1 of players) {
    for (const p2 of players) {
      if (p1.id !== p2.id) {
        const key = `${p1.id}-${p2.id}`;
        const partnerHistory = history?.find(h =>
          h.player_id === p1.id &&
          h.other_player_id === p2.id &&
          h.relationship_type === 'partner'
        );
        const opponentHistory = history?.find(h =>
          h.player_id === p1.id &&
          h.other_player_id === p2.id &&
          h.relationship_type === 'opponent'
        );

        historyMap.set(key, {
          partners: partnerHistory?.count || 0,
          opponents: opponentHistory?.count || 0
        });
      }
    }
  }

  // Try different team combinations and score them
  const combinations = [
    { team1: [players[0], players[1]], team2: [players[2], players[3]] },
    { team1: [players[0], players[2]], team2: [players[1], players[3]] },
    { team1: [players[0], players[3]], team2: [players[1], players[2]] }
  ];

  let bestCombination = combinations[0];
  let bestScore = -Infinity;

  for (const combo of combinations) {
    let score = 0;

    // Score partnerships (lower previous partnerships = better)
    for (const team of [combo.team1, combo.team2]) {
      const history = historyMap.get(`${team[0].id}-${team[1].id}`);
      score -= (history?.partners || 0) * 10;
    }

    // Score opponents (lower previous opponent matches = better)
    for (const t1Player of combo.team1) {
      for (const t2Player of combo.team2) {
        const history = historyMap.get(`${t1Player.id}-${t2Player.id}`);
        score -= (history?.opponents || 0) * 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCombination = combo;
    }
  }

  return bestCombination;
}

export async function generateRound(sessionId: string, roundNumber: number): Promise<MatchWithPlayers[]> {
  // Calculate player weights and select players using weighted system
  const playerWeights = await calculatePlayerWeights(sessionId, roundNumber);

  if (playerWeights.length < 4) {
    throw new Error("Not enough players to start a match. Need at least 4 players.");
  }

  // Select 4 players using weighted selection
  const selectedPlayers = selectWeightedPlayers(playerWeights, 4);

  // Optimize team assignments based on partnership/opponent history
  const { team1, team2 } = await optimizeTeams(selectedPlayers, sessionId);

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

  // Create match player assignments with optimized teams
  const matchPlayerInserts = [
    { match_id: match.id, player_id: team1[0].id, team: 1 },
    { match_id: match.id, player_id: team1[1].id, team: 1 },
    { match_id: match.id, player_id: team2[0].id, team: 2 },
    { match_id: match.id, player_id: team2[1].id, team: 2 },
  ];

  const { data: matchPlayers, error: mpError } = await supabase
    .from("match_players")
    .insert(matchPlayerInserts)
    .select();

  if (mpError) throw mpError;

  // Mark selected players as unavailable
  const playerIds = selectedPlayers.map(p => p.id);
  const { error: updateError } = await supabase
    .from("players")
    .update({ is_available: false })
    .in("id", playerIds);

  if (updateError) throw updateError;

  return [{
    match,
    players: matchPlayers || []
  }];
}