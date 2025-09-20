import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabaseClient";
import { createSession } from "../lib/pickleballService";
import { Database } from "../lib/database.types";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type NavigationProp = StackNavigationProp<RootStackParamList, "SessionList">;

interface SessionWithStats extends Session {
	playerCount: number;
	removedPlayerCount: number;
	matchCount: number;
	dailyIndex: number;
}

export default function SessionListScreen() {
	const navigation = useNavigation<NavigationProp>();
	const [sessions, setSessions] = useState<SessionWithStats[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchSessions();

		// Subscribe to session changes
		const subscription = supabase
			.channel("sessions")
			.on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
				fetchSessions();
			})
			.subscribe();

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	const fetchSessions = async () => {
		try {
			// Fetch sessions with player and match counts
			const { data: sessionsData, error } = await supabase
				.from("sessions")
				.select(
					`
					*,
					players:players(count),
					matches:matches(count)
				`
				)
				.order("created_at", { ascending: false });

			if (error) throw error;

			// Sort sessions by creation time for proper daily indexing
			const sortedSessions = [...(sessionsData || [])].sort(
				(a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
			);

			// Calculate daily indices
			const dailyCounters: { [date: string]: number } = {};
			const sessionIndices: { [sessionId: string]: number } = {};

			for (const session of sortedSessions) {
				const createdDate = new Date(session.created_at || "").toDateString();
				if (!dailyCounters[createdDate]) {
					dailyCounters[createdDate] = 0;
				}
				dailyCounters[createdDate]++;
				sessionIndices[session.id] = dailyCounters[createdDate];
			}

			// Process sessions with statistics (back to descending order)
			const sessionsWithStats: SessionWithStats[] = [];

			for (const session of sessionsData || []) {
				// Count non-deleted players
				const { data: playerData, error: playerError } = await supabase
					.from("players")
					.select("id", { count: "exact" })
					.eq("session_id", session.id)
					.is("deleted_at", null);

				if (playerError) throw playerError;

				// Count removed players
				const { data: removedPlayerData, error: removedPlayerError } = await supabase
					.from("players")
					.select("id", { count: "exact" })
					.eq("session_id", session.id)
					.not("deleted_at", "is", null);

				if (removedPlayerError) throw removedPlayerError;

				// Count matches
				const { data: matchData, error: matchError } = await supabase
					.from("matches")
					.select("id", { count: "exact" })
					.eq("session_id", session.id);

				if (matchError) throw matchError;

				sessionsWithStats.push({
					...session,
					playerCount: playerData?.length || 0,
					removedPlayerCount: removedPlayerData?.length || 0,
					matchCount: matchData?.length || 0,
					dailyIndex: sessionIndices[session.id],
				});
			}

			setSessions(sessionsWithStats);
		} catch (error) {
			console.error("Error fetching sessions:", error);
			Alert.alert("Error", "Failed to fetch sessions");
		} finally {
			setLoading(false);
		}
	};

	const handleCreateSession = async () => {
		try {
			const session = await createSession();
			navigation.navigate("SessionDetail", { sessionId: session.id });
		} catch (error) {
			console.error("Error creating session:", error);
			Alert.alert("Error", "Failed to create session");
		}
	};

	const renderSession = ({ item }: { item: SessionWithStats }) => {
		const createdDate = new Date(item.created_at || "");
		const formattedDate = createdDate.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
		const sessionName = `${formattedDate}${item.dailyIndex > 1 ? ` (#${item.dailyIndex})` : ""}`;

		return (
			<TouchableOpacity
				className='bg-white p-4 m-2 rounded-lg shadow-sm border border-gray-200'
				onPress={() => navigation.navigate("SessionDetail", { sessionId: item.id })}
			>
				<View className='flex-row justify-between items-start mb-2'>
					<Text className='text-lg font-semibold text-gray-800 flex-1'>{sessionName}</Text>
					<Text className='text-xs text-gray-400'>
						{createdDate.toLocaleTimeString("en-US", {
							hour: "numeric",
							minute: "2-digit",
							hour12: true,
						})}
					</Text>
				</View>
				<View className='flex-row justify-between'>
					<View className='flex-row items-center flex-wrap'>
						<View className='bg-blue-100 px-2 py-1 rounded mr-2 mb-1'>
							<Text className='text-blue-700 text-xs font-medium'>{item.playerCount} Players</Text>
						</View>
						{item.removedPlayerCount > 0 && (
							<View className='bg-gray-100 px-2 py-1 rounded mr-2 mb-1'>
								<Text className='text-gray-600 text-xs font-medium'>
									{item.removedPlayerCount} Removed
								</Text>
							</View>
						)}
						<View className='bg-green-100 px-2 py-1 rounded mb-1'>
							<Text className='text-green-700 text-xs font-medium'>{item.matchCount} Matches</Text>
						</View>
					</View>
				</View>
			</TouchableOpacity>
		);
	};

	if (loading) {
		return (
			<View className='flex-1 justify-center items-center bg-gray-50'>
				<Text className='text-gray-600'>Loading sessions...</Text>
			</View>
		);
	}

	return (
		<View className='flex-1 bg-gray-50'>
			<View className='p-4 bg-white border-b border-gray-200'>
				<TouchableOpacity
					className='bg-blue-500 px-6 py-3 rounded-lg'
					onPress={handleCreateSession}
				>
					<Text className='text-white font-semibold text-center text-lg'>Start New Session</Text>
				</TouchableOpacity>
			</View>

			<View className='flex-1 p-2'>
				<Text className='text-lg font-semibold text-gray-800 mb-2 px-2'>Recent Sessions</Text>
				{sessions.length === 0 ? (
					<View className='flex-1 justify-center items-center'>
						<Text className='text-gray-500 text-center'>
							No sessions yet.{"\n"}Start your first session above!
						</Text>
					</View>
				) : (
					<FlatList
						data={sessions}
						keyExtractor={(item) => item.id}
						renderItem={renderSession}
						showsVerticalScrollIndicator={false}
					/>
				)}
			</View>
		</View>
	);
}
