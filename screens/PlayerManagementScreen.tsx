import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ScrollView } from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Trash2, RotateCcw } from "lucide-react-native";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabaseClient";
import { addPlayer, removePlayer, restorePlayer, calculatePlayerWeights } from "../lib/pickleballService";
import { Database } from "../lib/database.types";

type Player = Database["public"]["Tables"]["players"]["Row"];
type RouteProps = RouteProp<RootStackParamList, "PlayerManagement">;

export default function PlayerManagementScreen() {
	const route = useRoute<RouteProps>();
	const { sessionId } = route.params;

	const [players, setPlayers] = useState<Player[]>([]);
	const [deletedPlayers, setDeletedPlayers] = useState<Player[]>([]);
	const [playerWeights, setPlayerWeights] = useState<Map<string, number>>(new Map());
	const [newPlayerName, setNewPlayerName] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchPlayers();

		// Subscribe to player changes
		const playersSubscription = supabase
			.channel(`players-${sessionId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "players",
					filter: `session_id=eq.${sessionId}`,
				},
				(payload) => {
					console.log("Players change detected:", payload);
					fetchPlayers();
				}
			)
			.subscribe((status) => {
				console.log("Players subscription status:", status);
			});

		return () => {
			playersSubscription.unsubscribe();
		};
	}, [sessionId]);

	const fetchPlayers = async () => {
		try {
			// Fetch active players (excluding soft-deleted)
			const { data: playersData, error: playersError } = await supabase
				.from("players")
				.select("*")
				.eq("session_id", sessionId)
				.is("deleted_at", null)
				.order("created_at", { ascending: true });

			if (playersError) throw playersError;

			// Fetch soft-deleted players
			const { data: deletedPlayersData, error: deletedPlayersError } = await supabase
				.from("players")
				.select("*")
				.eq("session_id", sessionId)
				.not("deleted_at", "is", null)
				.order("deleted_at", { ascending: false });

			if (deletedPlayersError) throw deletedPlayersError;

			setPlayers(playersData || []);
			setDeletedPlayers(deletedPlayersData || []);

			// Calculate current round number
			const { data: matches } = await supabase
				.from("matches")
				.select("round_number")
				.eq("session_id", sessionId)
				.order("round_number", { ascending: false })
				.limit(1);

			const currentRound = (matches?.[0]?.round_number || 0) + 1;

			// Calculate player weights for all players (including unavailable) for display
			try {
				const weights = await calculatePlayerWeights(sessionId, true);
				const weightMap = new Map();
				weights.forEach(({ player, weight }) => {
					weightMap.set(player.id, weight);
				});
				setPlayerWeights(weightMap);
			} catch (weightError) {
				console.log("Could not calculate weights:", weightError);
				setPlayerWeights(new Map());
			}
		} catch (error) {
			console.error("Error fetching players:", error);
			Alert.alert("Error", "Failed to fetch players");
		} finally {
			setLoading(false);
		}
	};

	const handleAddPlayer = async () => {
		if (!newPlayerName.trim()) {
			Alert.alert("Error", "Please enter a player name");
			return;
		}

		try {
			await addPlayer(sessionId, newPlayerName.trim());
			setNewPlayerName("");
			// Force refetch to ensure consistency
			await fetchPlayers();
		} catch (error) {
			console.error("Error adding player:", error);
			Alert.alert("Error", "Failed to add player");
		}
	};

	const handleRemovePlayer = async (playerId: string) => {
		try {
			// Find the player being removed for optimistic update
			const playerToRemove = players.find((p) => p.id === playerId);

			// Optimistically remove from active players
			setPlayers((prev) => prev.filter((p) => p.id !== playerId));

			// Optimistically add to deleted players (if we found the player)
			if (playerToRemove) {
				setDeletedPlayers((prev) => [
					{ ...playerToRemove, deleted_at: new Date().toISOString() },
					...prev,
				]);
			}

			await removePlayer(playerId);

			// Force refetch to ensure consistency
			await fetchPlayers();
		} catch (error) {
			console.error("Error removing player:", error);
			Alert.alert("Error", "Failed to remove player");
			// Refetch to restore correct state on error
			await fetchPlayers();
		}
	};

	const handleAddDemoPlayer = async () => {
		// Find the next available demo player number
		const existingDemoPlayers = players.filter((p) => p.name.match(/^Player \d+$/));
		const existingNumbers = existingDemoPlayers.map((p) => parseInt(p.name.split(" ")[1]));
		const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

		const demoPlayerName = `Player ${nextNumber}`;

		try {
			await addPlayer(sessionId, demoPlayerName);
			// Force refetch to ensure consistency
			await fetchPlayers();
		} catch (error) {
			console.error("Error adding demo player:", error);
			Alert.alert("Error", "Failed to add demo player");
		}
	};

	const handleRestorePlayer = async (playerId: string) => {
		try {
			// Find the player being restored for optimistic update
			const playerToRestore = deletedPlayers.find((p) => p.id === playerId);

			// Optimistically remove from deleted players
			setDeletedPlayers((prev) => prev.filter((p) => p.id !== playerId));

			// Optimistically add to active players (if we found the player)
			if (playerToRestore) {
				setPlayers((prev) => [
					...prev,
					{ ...playerToRestore, deleted_at: null, is_available: true }
				]);
			}

			await restorePlayer(playerId);

			// Force refetch to ensure consistency
			await fetchPlayers();
		} catch (error) {
			console.error("Error restoring player:", error);
			Alert.alert("Error", "Failed to restore player");
			// Refetch to restore correct state on error
			await fetchPlayers();
		}
	};

	const renderPlayer = ({ item }: { item: Player }) => {
		const weight = playerWeights.get(item.id);

		return (
			<View className='flex-row items-center justify-between bg-white p-3 m-1 rounded-lg border border-gray-200'>
				<View className='flex-row items-center flex-1'>
					<View
						className={`w-3 h-3 rounded-full mr-3 ${
							item.is_available ? "bg-green-500" : "bg-red-500"
						}`}
					/>
					<View className='flex-1'>
						<Text className='text-gray-800 font-medium'>{item.name}</Text>
						{weight !== undefined && (
							<Text className='text-xs text-blue-600 mt-1'>
								Priority: {weight.toFixed(0)} • Matches: {(item.matches_played || 0).toFixed(2)} • Last: Round {item.last_match_round || 0}
							</Text>
						)}
					</View>
					{weight !== undefined && (
						<View className='bg-blue-100 px-2 py-1 rounded-full mr-2'>
							<Text className='text-blue-700 text-xs font-semibold'>{weight.toFixed(0)}</Text>
						</View>
					)}
				</View>
				<TouchableOpacity
					className='bg-red-500 p-1 rounded'
					onPress={() => handleRemovePlayer(item.id)}
				>
					<Trash2 size={16} color='white' />
				</TouchableOpacity>
			</View>
		);
	};

	const renderDeletedPlayer = ({ item }: { item: Player }) => {
		const deletedDate = new Date(item.deleted_at || "");
		const weight = playerWeights.get(item.id);

		return (
			<View className='flex-row items-center justify-between bg-gray-50 p-3 m-1 rounded-lg border border-gray-200'>
				<View className='flex-row items-center flex-1'>
					<View className='w-3 h-3 rounded-full mr-3 bg-gray-400' />
					<View className='flex-1'>
						<Text className='text-gray-600 font-medium'>{item.name}</Text>
						{weight !== undefined && (
							<Text className='text-xs text-gray-500 mt-1'>
								Priority: {weight.toFixed(0)} • Matches: {(item.matches_played || 0).toFixed(2)} • Last: Round {item.last_match_round || 0}
							</Text>
						)}
						<Text className='text-xs text-gray-400 mt-1'>
							Removed {deletedDate.toLocaleDateString()} at{" "}
							{deletedDate.toLocaleTimeString("en-US", {
								hour: "numeric",
								minute: "2-digit",
								hour12: true,
							})}
						</Text>
					</View>
					{weight !== undefined && (
						<View className='bg-gray-200 px-2 py-1 rounded-full mr-2'>
							<Text className='text-gray-600 text-xs font-semibold'>{weight.toFixed(0)}</Text>
						</View>
					)}
				</View>
				<TouchableOpacity
					className='bg-green-500 p-1 rounded'
					onPress={() => handleRestorePlayer(item.id)}
				>
					<RotateCcw size={16} color='white' />
				</TouchableOpacity>
			</View>
		);
	};

	if (loading) {
		return (
			<View className='flex-1 justify-center items-center bg-gray-50'>
				<Text className='text-gray-600'>Loading players...</Text>
			</View>
		);
	}

	const availablePlayers = players.filter((p) => p.is_available);

	return (
		<ScrollView className='flex-1 bg-gray-50'>
			{/* Add Player Section */}
			<View className='p-4 bg-white border-b border-gray-200'>
				<Text className='text-lg font-bold text-gray-800 mb-3'>Add Player</Text>
				<View className='flex-row gap-2'>
					<TextInput
						className='flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white'
						placeholder='Enter player name'
						value={newPlayerName}
						onChangeText={setNewPlayerName}
						onSubmitEditing={handleAddPlayer}
					/>
					<TouchableOpacity
						className='bg-green-500 px-4 py-2 rounded-lg justify-center'
						onPress={handleAddPlayer}
					>
						<Text className='text-white font-semibold'>Add</Text>
					</TouchableOpacity>
					<TouchableOpacity
						className='bg-purple-500 px-4 py-2 rounded-lg justify-center'
						onPress={handleAddDemoPlayer}
					>
						<Text className='text-white font-semibold'>Demo</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Players List */}
			<View className='p-4'>
				<Text className='text-lg font-bold text-gray-800 mb-3'>
					Active Players ({players.length}) - Available: {availablePlayers.length}
				</Text>

				{players.length === 0 ? (
					<Text className='text-gray-500 text-center py-4'>
						No players yet. Add some players above!
					</Text>
				) : (
					<FlatList
						data={players}
						keyExtractor={(item) => item.id}
						renderItem={renderPlayer}
						scrollEnabled={false}
					/>
				)}
			</View>

			{/* Removed Players Section */}
			{deletedPlayers.length > 0 && (
				<View className='p-4'>
					<Text className='text-lg font-bold text-gray-800 mb-3'>
						Removed Players ({deletedPlayers.length})
					</Text>
					<FlatList
						data={deletedPlayers}
						keyExtractor={(item) => item.id}
						renderItem={renderDeletedPlayer}
						scrollEnabled={false}
					/>
				</View>
			)}
		</ScrollView>
	);
}