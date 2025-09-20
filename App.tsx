import "./global.css";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SessionListScreen from "./screens/SessionListScreen";
import SessionDetailScreen from "./screens/SessionDetailScreen";
import { Database } from "./lib/database.types";

export type RootStackParamList = {
	SessionList: undefined;
	SessionDetail: { sessionId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
	return (
		<SafeAreaProvider>
			<NavigationContainer>
				<Stack.Navigator initialRouteName='SessionList'>
					<Stack.Screen
						name='SessionList'
						component={SessionListScreen}
						options={{ title: "Pickleball Sessions" }}
					/>
					<Stack.Screen
						name='SessionDetail'
						component={SessionDetailScreen}
						options={{ title: "Session Detail" }}
					/>
				</Stack.Navigator>
				<StatusBar style='auto' />
			</NavigationContainer>
		</SafeAreaProvider>
	);
}
