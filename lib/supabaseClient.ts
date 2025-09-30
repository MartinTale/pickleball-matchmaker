import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { Database } from "./database.types";

// Platform-specific Supabase URL for local development
const getSupabaseUrl = () => {
	const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";

	// If it's a production URL (https), use it directly
	if (envUrl.startsWith("https://")) {
		return envUrl;
	}

	// For local development, use platform-specific URLs
	if (Platform.OS === "android") {
		// Android emulator uses the host machine's IP
		return process.env.EXPO_PUBLIC_SUPABASE_URL_ANDROID || envUrl;
	}

	// iOS uses localhost
	return process.env.EXPO_PUBLIC_SUPABASE_URL_IOS || envUrl;
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
	console.error("Missing Supabase environment variables!");
	console.error("EXPO_PUBLIC_SUPABASE_URL:", supabaseUrl ? "SET" : "MISSING");
	console.error("EXPO_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "SET" : "MISSING");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
