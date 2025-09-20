import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useRoute, RouteProp, useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabaseClient";
import { generateRound, completeMatch } from "../lib/pickleballService";
import { Database } from "../lib/database.types";

type Player = Database["public"]["Tables"]["players"]["Row"];
type Match = Database["public"]["Tables"]["matches"]["Row"];
type MatchPlayer = Database["public"]["Tables"]["match_players"]["Row"];
type RouteProps = RouteProp<RootStackParamList, "SessionDetail">;
type NavigationProp = StackNavigationProp<RootStackParamList, "SessionDetail">;

interface MatchWithDetails extends Match {
	match_players: (MatchPlayer & {
		players: Pick<Player, "id" | "name"> | null;
	})[];
}

export default function SessionDetailScreen() {
	const route = useRoute<RouteProps>();
	const navigation = useNavigation<NavigationProp>();
	const { sessionId } = route.params;

	const [players, setPlayers] = useState<Player[]>([]);
	const [matches, setMatches] = useState<MatchWithDetails[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentRound, setCurrentRound] = useState(1);

	useEffect(() => {
		fetchSessionData();

		// Subscribe to changes for players, matches and match players
		const playersSubscription = supabase
			.channel(`session-players-${sessionId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "players",
					filter: `session_id=eq.${sessionId}`,
				},
				() => {
					fetchSessionData();
				}
			)
			.subscribe();

		const matchesSubscription = supabase
			.channel(`session-matches-${sessionId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "matches",
					filter: `session_id=eq.${sessionId}`,
				},
				() => {
					fetchSessionData();
				}
			)
			.subscribe();

		const matchPlayersSubscription = supabase
			.channel(`session-match-players-${sessionId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "match_players",
				},
				() => {
					fetchSessionData();
				}
			)
			.subscribe();

		return () => {
			playersSubscription.unsubscribe();
			matchesSubscription.unsubscribe();
			matchPlayersSubscription.unsubscribe();
		};
	}, [sessionId]);

	// Refetch session data when screen comes into focus
	useFocusEffect(
		React.useCallback(() => {
			fetchSessionData();
		}, [])
	);

	const fetchSessionData = async () => {
		try {
			// Fetch active players (excluding soft-deleted) for counts only
			const { data: playersData, error: playersError } = await supabase
				.from("players")
				.select("*")
				.eq("session_id", sessionId)
				.is("deleted_at", null)
				.order("created_at", { ascending: true });

			if (playersError) throw playersError;

			// Fetch matches with players
			const { data: matchesData, error: matchesError } = await supabase
				.from("matches")
				.select(`
          *,
          match_players(
            *,
            players(id, name)
          )
        `)
				.eq("session_id", sessionId)
				.order("created_at", { ascending: false });

			if (matchesError) throw matchesError;

			setPlayers(playersData || []);
			setMatches((matchesData as MatchWithDetails[]) || []);

			// Calculate next round number
			const maxRound = Math.max(0, ...(matchesData || []).map((m) => m.round_number));
			setCurrentRound(maxRound + 1);
		} catch (error) {
			console.error("Error fetching session data:", error);
			Alert.alert("Error", "Failed to fetch session data");
		} finally {
			setLoading(false);
		}
	};

	const handleGenerateRound = async () => {
		const availablePlayers = players.filter((p) => p.is_available);
		if (availablePlayers.length < 4) {
			Alert.alert("Error", "Need at least 4 available players to generate matches");
			return;
		}

		try {
			await generateRound(sessionId, currentRound);
		} catch (error) {
			console.error("Error generating round:", error);
			Alert.alert("Error", "Failed to generate round");
		}
	};

	const handleCompleteMatch = async (matchId: string) => {
		try {
			await completeMatch(matchId);
		} catch (error) {
			console.error("Error completing match:", error);
			Alert.alert("Error", "Failed to complete match");
		}
	};

	const renderMatch = ({ item }: { item: MatchWithDetails }) => {
		const team1 = item.match_players.filter((mp) => mp.team === 1);
		const team2 = item.match_players.filter((mp) => mp.team === 2);

		return (
			<View className='bg-white p-4 m-2 rounded-lg border border-gray-200'>
				<View className='flex-row justify-between items-center mb-3'>
					<Text className='text-lg font-semibold'>Round {item.round_number}</Text>
					<View
						className={`px-2 py-1 rounded ${
							item.status === "active" ? "bg-green-100" : "bg-gray-100"
						}`}
					>
						<Text
							className={`text-sm font-medium ${
								item.status === "active" ? "text-green-800" : "text-gray-600"
							}`}
						>
							{item.status}
						</Text>
					</View>
				</View>

				<View className='flex-row justify-between'>
					<View className='flex-1 mr-2'>
						<Text className='font-medium text-blue-600 mb-1'>Team 1</Text>
						{team1.map((mp) => (
							<Text key={mp.id} className='text-gray-700'>
								{mp.players?.name || "Unknown"}
							</Text>
						))}
					</View>

					<Text className='text-gray-400 font-bold text-lg self-center'>VS</Text>

					<View className='flex-1 ml-2'>
						<Text className='font-medium text-red-600 mb-1'>Team 2</Text>
						{team2.map((mp) => (
							<Text key={mp.id} className='text-gray-700'>
								{mp.players?.name || "Unknown"}
							</Text>
						))}
					</View>
				</View>

				{item.status === "active" && (
					<TouchableOpacity
						className='bg-blue-500 p-2 rounded mt-3'
						onPress={() => handleCompleteMatch(item.id)}
					>
						<Text className='text-white text-center font-medium'>Complete Match</Text>
					</TouchableOpacity>
				)}
			</View>
		);
	};

	if (loading) {
		return (
			<View className='flex-1 justify-center items-center bg-gray-50'>
				<Text className='text-gray-600'>Loading session...</Text>
			</View>
		);
	}

	const availablePlayers = players.filter((p) => p.is_available);

	return (
		<ScrollView className='flex-1 bg-gray-50'>
			{/* Session Overview */}
			<View className='p-4 bg-white border-b border-gray-200'>
				<Text className='text-xl font-bold text-gray-800 mb-4'>Session Overview</Text>

				<View className='flex-row justify-between mb-4'>
					<View className='bg-blue-100 px-4 py-3 rounded-lg flex-1 mr-2'>
						<Text className='text-blue-700 text-lg font-bold'>{players.length}</Text>
						<Text className='text-blue-600 text-sm'>Total Players</Text>
					</View>
					<View className='bg-green-100 px-4 py-3 rounded-lg flex-1 ml-2'>
						<Text className='text-green-700 text-lg font-bold'>{availablePlayers.length}</Text>
						<Text className='text-green-600 text-sm'>Available</Text>
					</View>
				</View>

				<TouchableOpacity
					className='bg-purple-500 px-6 py-3 rounded-lg'
					onPress={() => navigation.navigate("PlayerManagement", { sessionId })}
				>
					<Text className='text-white font-semibold text-center text-lg'>Manage Players</Text>
				</TouchableOpacity>
			</View>

			{/* Generate Round Section */}
			<View className='p-4 bg-white border-b border-gray-200 mt-2'>
				<Text className='text-lg font-bold text-gray-800 mb-3'>Round Management</Text>
				<TouchableOpacity
					className={`px-6 py-3 rounded-lg ${
						availablePlayers.length >= 4 ? "bg-blue-500" : "bg-gray-400"
					}`}
					onPress={handleGenerateRound}
					disabled={availablePlayers.length < 4}
				>
					<Text className='text-white font-semibold text-center text-lg'>
						Generate Round {currentRound}
					</Text>
				</TouchableOpacity>
				{availablePlayers.length < 4 && (
					<Text className='text-gray-500 text-center text-sm mt-2'>
						Need at least 4 available players to generate matches
					</Text>
				)}
			</View>

			{/* Matches Section */}
			{matches.length > 0 && (
				<View className='p-4'>
					<Text className='text-lg font-bold text-gray-800 mb-3'>Matches</Text>
					<FlatList
						data={matches}
						keyExtractor={(item) => item.id}
						renderItem={renderMatch}
						scrollEnabled={false}
					/>
				</View>
			)}
		</ScrollView>
	);
}