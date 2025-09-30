import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, Button, SectionList, TextInput, Modal } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Trash2, Plus, Minus } from "lucide-react-native";
import * as Sentry from "@sentry/react-native";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabaseClient";
import { createSession, deleteSession } from "../lib/pickleballService";
import { Database } from "../lib/database.types";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type NavigationProp = StackNavigationProp<RootStackParamList, "SessionList">;

interface SessionWithStats extends Session {
	activePlayerCount: number;
	inactivePlayerCount: number;
	activeMatchCount: number;
	completedMatchCount: number;
}

interface SessionSection {
	title: string;
	data: SessionWithStats[];
}

export default function SessionListScreen() {
	const navigation = useNavigation<NavigationProp>();
	const [sessionSections, setSessionSections] = useState<SessionSection[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCourtModal, setShowCourtModal] = useState(false);
	const [courtCount, setCourtCount] = useState("1");

	useEffect(() => {
		fetchSessions();

		// Subscribe to session changes
		const subscription = supabase
			.channel("sessions-list")
			.on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, (payload) => {
				console.log("Session change detected:", payload);
				fetchSessions();
			})
			.subscribe((status) => {
				console.log("Sessions subscription status:", status);
			});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	// Refetch sessions when screen comes into focus
	useFocusEffect(
		React.useCallback(() => {
			fetchSessions();
		}, [])
	);

	const fetchSessions = async () => {
		try {
			// Fetch sessions with player and match counts (excluding soft-deleted)
			const { data: sessionsData, error } = await supabase
				.from("sessions")
				.select(
					`
					*,
					players:players(count),
					matches:matches(count)
				`
				)
				.is("deleted_at", null)
				.order("created_at", { ascending: false });

			if (error) throw error;

			// Process sessions with statistics
			const sessionsWithStats: SessionWithStats[] = [];

			for (const session of sessionsData || []) {
				// Count active players (non-deleted)
				const { data: activePlayerData, error: activePlayerError } = await supabase
					.from("players")
					.select("id", { count: "exact" })
					.eq("session_id", session.id)
					.is("deleted_at", null);

				if (activePlayerError) throw activePlayerError;

				// Count inactive players (soft-deleted)
				const { data: inactivePlayerData, error: inactivePlayerError } = await supabase
					.from("players")
					.select("id", { count: "exact" })
					.eq("session_id", session.id)
					.not("deleted_at", "is", null);

				if (inactivePlayerError) throw inactivePlayerError;

				// Count active matches
				const { data: activeMatchData, error: activeMatchError } = await supabase
					.from("matches")
					.select("id", { count: "exact" })
					.eq("session_id", session.id)
					.eq("status", "active");

				if (activeMatchError) throw activeMatchError;

				// Count completed matches
				const { data: completedMatchData, error: completedMatchError } = await supabase
					.from("matches")
					.select("id", { count: "exact" })
					.eq("session_id", session.id)
					.eq("status", "completed");

				if (completedMatchError) throw completedMatchError;

				sessionsWithStats.push({
					...session,
					activePlayerCount: activePlayerData?.length || 0,
					inactivePlayerCount: inactivePlayerData?.length || 0,
					activeMatchCount: activeMatchData?.length || 0,
					completedMatchCount: completedMatchData?.length || 0,
				});
			}

			organizeSessions(sessionsWithStats);
		} catch (error) {
			console.error("Error fetching sessions:", error);
			Alert.alert("Error", "Failed to fetch sessions");
		} finally {
			setLoading(false);
		}
	};

	const organizeSessions = (sessions: SessionWithStats[]) => {
		const today = new Date();
		const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

		const todaySessions: SessionWithStats[] = [];
		const olderSessions: SessionWithStats[] = [];

		sessions.forEach(session => {
			const sessionDate = new Date(session.created_at || "");
			if (sessionDate >= todayStart) {
				todaySessions.push(session);
			} else {
				olderSessions.push(session);
			}
		});

		const sections: SessionSection[] = [];

		if (todaySessions.length > 0) {
			sections.push({
				title: "Today",
				data: todaySessions
			});
		}

		if (olderSessions.length > 0) {
			sections.push({
				title: "Previous Sessions",
				data: olderSessions
			});
		}

		setSessionSections(sections);
	};

	const handleCreateSession = async () => {
		setShowCourtModal(true);
	};

	const handleConfirmCreateSession = async () => {
		try {
			const count = parseInt(courtCount, 10);
			if (isNaN(count) || count < 1) {
				Alert.alert("Invalid Input", "Please enter a valid number of courts (minimum 1)");
				return;
			}

			setShowCourtModal(false);
			const session = await createSession(count);
			setCourtCount("1"); // Reset for next time
			navigation.navigate("SessionDetail", { sessionId: session.id });
		} catch (error) {
			console.error("Error creating session:", error);
			Alert.alert("Error", "Failed to create session");
		}
	};

	const handleDeleteSession = async (sessionId: string, sessionName: string) => {
		Alert.alert(
			"Delete Session",
			`Are you sure you want to delete "${sessionName}"? This action cannot be undone.`,
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await deleteSession(sessionId);

							// Force refetch to ensure consistency
							await fetchSessions();
						} catch (error) {
							console.error("Error deleting session:", error);
							Alert.alert("Error", "Failed to delete session");
							// Refetch to restore correct state on error
							await fetchSessions();
						}
					},
				},
			]
		);
	};

	const renderSession = ({ item }: { item: SessionWithStats }) => {
		const createdDate = new Date(item.created_at || "");
		const sessionName = createdDate.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});

		return (
			<TouchableOpacity
				className='bg-white p-4 m-2 rounded-lg shadow-sm border border-gray-200'
				onPress={() => navigation.navigate("SessionDetail", { sessionId: item.id })}
			>
				<View className='flex-row justify-between items-start mb-2'>
					<Text className='text-lg font-semibold text-gray-800 flex-1'>{sessionName}</Text>
					<TouchableOpacity
						className='bg-red-500 p-1 rounded'
						onPress={(e) => {
							e.stopPropagation();
							handleDeleteSession(item.id, sessionName);
						}}
					>
						<Trash2 size={16} color='white' />
					</TouchableOpacity>
				</View>
				<View className='flex-row justify-between'>
					<View className='flex-row items-center flex-wrap'>
						<View className='bg-blue-100 px-2 py-1 rounded mr-2 mb-1'>
							<Text className='text-blue-700 text-xs font-medium'>
								{item.activePlayerCount + item.inactivePlayerCount} Players
							</Text>
						</View>
						<View className='bg-green-100 px-2 py-1 rounded mb-1'>
							<Text className='text-green-700 text-xs font-medium'>
								{item.activeMatchCount + item.completedMatchCount} Matches
							</Text>
						</View>
					</View>
				</View>
			</TouchableOpacity>
		);
	};

	const renderSectionHeader = ({ section: { title } }: { section: SessionSection }) => (
		<View className='px-2 py-2 bg-gray-50'>
			<Text className='text-lg font-semibold text-gray-800'>{title}</Text>
		</View>
	);

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
				{sessionSections.length === 0 ? (
					<View className='flex-1 justify-center items-center'>
						<Text className='text-gray-500 text-center'>
							No sessions yet.{"\n"}Start your first session above!
						</Text>
					</View>
				) : (
					<SectionList
						sections={sessionSections}
						keyExtractor={(item) => item.id}
						renderItem={renderSession}
						renderSectionHeader={renderSectionHeader}
						showsVerticalScrollIndicator={false}
						stickySectionHeadersEnabled={false}
					/>
				)}
			</View>

			<Modal
				visible={showCourtModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowCourtModal(false)}
			>
				<View className='flex-1 justify-center items-center bg-black/50'>
					<View className='bg-white p-6 rounded-lg m-4 w-80'>
						<Text className='text-xl font-semibold mb-4 text-gray-800'>Number of Courts</Text>
						<View className='flex-row items-center justify-center mb-4 gap-3'>
							<TouchableOpacity
								className='bg-gray-200 p-3 rounded-lg'
								onPress={() => {
									const current = parseInt(courtCount, 10) || 1;
									if (current > 1) {
										setCourtCount((current - 1).toString());
									}
								}}
							>
								<Minus size={24} color='#374151' />
							</TouchableOpacity>
							<TextInput
								className='border border-gray-300 rounded-lg px-4 py-3 text-lg text-center w-24'
								value={courtCount}
								onChangeText={setCourtCount}
								keyboardType="number-pad"
								placeholder="1"
							/>
							<TouchableOpacity
								className='bg-gray-200 p-3 rounded-lg'
								onPress={() => {
									const current = parseInt(courtCount, 10) || 1;
									setCourtCount((current + 1).toString());
								}}
							>
								<Plus size={24} color='#374151' />
							</TouchableOpacity>
						</View>
						<View className='flex-row gap-2'>
							<TouchableOpacity
								className='flex-1 bg-gray-300 px-4 py-3 rounded-lg'
								onPress={() => {
									setShowCourtModal(false);
									setCourtCount("1");
								}}
							>
								<Text className='text-gray-800 font-semibold text-center'>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className='flex-1 bg-blue-500 px-4 py-3 rounded-lg'
								onPress={handleConfirmCreateSession}
							>
								<Text className='text-white font-semibold text-center'>Create</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}
