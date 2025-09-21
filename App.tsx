import "./global.css";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SessionListScreen from "./screens/SessionListScreen";
import SessionDetailScreen from "./screens/SessionDetailScreen";
import PlayerManagementScreen from "./screens/PlayerManagementScreen";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://50b0f2f84b3850728b263f21df231366@o299012.ingest.us.sentry.io/4510056685830144',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export type RootStackParamList = {
	SessionList: undefined;
	SessionDetail: { sessionId: string };
	PlayerManagement: { sessionId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default Sentry.wrap(function App() {
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
						options={{
							title: "Session Detail",
							headerBackTitle: "Back"
						}}
					/>
					<Stack.Screen
						name='PlayerManagement'
						component={PlayerManagementScreen}
						options={{
							title: "Manage Players",
							headerBackTitle: "Back"
						}}
					/>
				</Stack.Navigator>
				<StatusBar style='auto' />
			</NavigationContainer>
		</SafeAreaProvider>
	);
});