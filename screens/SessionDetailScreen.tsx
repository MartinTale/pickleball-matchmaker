import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabaseClient';
import { addPlayer, removePlayer, generateRound, completeMatch } from '../lib/pickleballService';
import { Database } from '../lib/database.types';

type Player = Database['public']['Tables']['players']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];
type MatchPlayer = Database['public']['Tables']['match_players']['Row'];
type RouteProps = RouteProp<RootStackParamList, 'SessionDetail'>;

interface MatchWithDetails extends Match {
  match_players: (MatchPlayer & {
    players: Pick<Player, 'id' | 'name'> | null;
  })[];
}

export default function SessionDetailScreen() {
  const route = useRoute<RouteProps>();
  const { sessionId } = route.params;

  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);

  useEffect(() => {
    fetchSessionData();

    // Subscribe to changes
    const playersSubscription = supabase
      .channel('players')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${sessionId}`
      }, () => {
        fetchSessionData();
      })
      .subscribe();

    const matchesSubscription = supabase
      .channel('matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `session_id=eq.${sessionId}`
      }, () => {
        fetchSessionData();
      })
      .subscribe();

    return () => {
      playersSubscription.unsubscribe();
      matchesSubscription.unsubscribe();
    };
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (playersError) throw playersError;

      // Fetch matches with players
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          *,
          match_players(
            *,
            players(id, name)
          )
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (matchesError) throw matchesError;

      setPlayers(playersData || []);
      setMatches(matchesData as MatchWithDetails[] || []);

      // Calculate next round number
      const maxRound = Math.max(0, ...(matchesData || []).map(m => m.round_number));
      setCurrentRound(maxRound + 1);
    } catch (error) {
      console.error('Error fetching session data:', error);
      Alert.alert('Error', 'Failed to fetch session data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      Alert.alert('Error', 'Please enter a player name');
      return;
    }

    try {
      await addPlayer(sessionId, newPlayerName.trim());
      setNewPlayerName('');
    } catch (error) {
      console.error('Error adding player:', error);
      Alert.alert('Error', 'Failed to add player');
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    try {
      await removePlayer(playerId);
    } catch (error) {
      console.error('Error removing player:', error);
      Alert.alert('Error', 'Failed to remove player');
    }
  };

  const handleGenerateRound = async () => {
    const availablePlayers = players.filter(p => p.is_available);
    if (availablePlayers.length < 4) {
      Alert.alert('Error', 'Need at least 4 available players to generate matches');
      return;
    }

    try {
      await generateRound(sessionId, currentRound);
    } catch (error) {
      console.error('Error generating round:', error);
      Alert.alert('Error', 'Failed to generate round');
    }
  };

  const handleCompleteMatch = async (matchId: string) => {
    try {
      await completeMatch(matchId);
    } catch (error) {
      console.error('Error completing match:', error);
      Alert.alert('Error', 'Failed to complete match');
    }
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <View className="flex-row items-center justify-between bg-white p-3 m-1 rounded-lg border border-gray-200">
      <View className="flex-row items-center">
        <View className={`w-3 h-3 rounded-full mr-3 ${item.is_available ? 'bg-green-500' : 'bg-red-500'}`} />
        <Text className="text-gray-800 font-medium">{item.name}</Text>
      </View>
      <TouchableOpacity
        className="bg-red-500 px-3 py-1 rounded"
        onPress={() => handleRemovePlayer(item.id)}
      >
        <Text className="text-white text-sm">Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMatch = ({ item }: { item: MatchWithDetails }) => {
    const team1 = item.match_players.filter(mp => mp.team === 1);
    const team2 = item.match_players.filter(mp => mp.team === 2);

    return (
      <View className="bg-white p-4 m-2 rounded-lg border border-gray-200">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold">Round {item.round_number}</Text>
          <View className={`px-2 py-1 rounded ${item.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Text className={`text-sm font-medium ${item.status === 'active' ? 'text-green-800' : 'text-gray-600'}`}>
              {item.status}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between">
          <View className="flex-1 mr-2">
            <Text className="font-medium text-blue-600 mb-1">Team 1</Text>
            {team1.map(mp => (
              <Text key={mp.id} className="text-gray-700">
                {mp.players?.name || 'Unknown'}
              </Text>
            ))}
          </View>

          <Text className="text-gray-400 font-bold text-lg self-center">VS</Text>

          <View className="flex-1 ml-2">
            <Text className="font-medium text-red-600 mb-1">Team 2</Text>
            {team2.map(mp => (
              <Text key={mp.id} className="text-gray-700">
                {mp.players?.name || 'Unknown'}
              </Text>
            ))}
          </View>
        </View>

        {item.status === 'active' && (
          <TouchableOpacity
            className="bg-blue-500 p-2 rounded mt-3"
            onPress={() => handleCompleteMatch(item.id)}
          >
            <Text className="text-white text-center font-medium">Complete Match</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading session...</Text>
      </View>
    );
  }

  const availablePlayers = players.filter(p => p.is_available);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
      {/* Add Player Section */}
      <View className="p-4 bg-white border-b border-gray-200">
        <Text className="text-lg font-bold text-gray-800 mb-3">Add Player</Text>
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white"
            placeholder="Enter player name"
            value={newPlayerName}
            onChangeText={setNewPlayerName}
            onSubmitEditing={handleAddPlayer}
          />
          <TouchableOpacity
            className="bg-green-500 px-4 py-2 rounded-lg justify-center"
            onPress={handleAddPlayer}
          >
            <Text className="text-white font-semibold">Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Players List */}
      <View className="p-4">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-bold text-gray-800">
            Players ({players.length}) - Available: {availablePlayers.length}
          </Text>
          <TouchableOpacity
            className={`px-4 py-2 rounded-lg ${availablePlayers.length >= 4 ? 'bg-blue-500' : 'bg-gray-400'}`}
            onPress={handleGenerateRound}
            disabled={availablePlayers.length < 4}
          >
            <Text className="text-white font-semibold">
              Generate Round {currentRound}
            </Text>
          </TouchableOpacity>
        </View>

        {players.length === 0 ? (
          <Text className="text-gray-500 text-center py-4">No players yet. Add some players above!</Text>
        ) : (
          <FlatList
            data={players}
            keyExtractor={(item) => item.id}
            renderItem={renderPlayer}
            scrollEnabled={false}
          />
        )}
      </View>

      {/* Matches Section */}
      {matches.length > 0 && (
        <View className="p-4">
          <Text className="text-lg font-bold text-gray-800 mb-3">Matches</Text>
          <FlatList
            data={matches}
            keyExtractor={(item) => item.id}
            renderItem={renderMatch}
            scrollEnabled={false}
          />
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}