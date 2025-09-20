import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabaseClient';
import { createSession } from '../lib/pickleballService';
import { Database } from '../lib/database.types';

type Session = Database['public']['Tables']['sessions']['Row'];
type NavigationProp = StackNavigationProp<RootStackParamList, 'SessionList'>;

export default function SessionListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();

    // Subscribe to session changes
    const subscription = supabase
      .channel('sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      Alert.alert('Error', 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) {
      Alert.alert('Error', 'Please enter a session name');
      return;
    }

    try {
      const session = await createSession(newSessionName.trim());
      setNewSessionName('');
      navigation.navigate('SessionDetail', { sessionId: session.id });
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create session');
    }
  };

  const renderSession = ({ item }: { item: Session }) => (
    <TouchableOpacity
      className="bg-white p-4 m-2 rounded-lg shadow-sm border border-gray-200"
      onPress={() => navigation.navigate('SessionDetail', { sessionId: item.id })}
    >
      <Text className="text-lg font-semibold text-gray-800">{item.name}</Text>
      <Text className="text-sm text-gray-500 mt-1">
        Created {new Date(item.created_at || '').toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading sessions...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <Text className="text-xl font-bold text-gray-800 mb-4">Create New Session</Text>
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white"
            placeholder="Enter session name"
            value={newSessionName}
            onChangeText={setNewSessionName}
            onSubmitEditing={handleCreateSession}
          />
          <TouchableOpacity
            className="bg-blue-500 px-4 py-2 rounded-lg justify-center"
            onPress={handleCreateSession}
          >
            <Text className="text-white font-semibold">Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1 p-2">
        <Text className="text-lg font-semibold text-gray-800 mb-2 px-2">Recent Sessions</Text>
        {sessions.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500 text-center">
              No sessions yet.{'\n'}Create your first session above!
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