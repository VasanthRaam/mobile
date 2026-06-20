import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/apiClient';

export default function ProfileSelectionScreen({ route, navigation }) {
  const { profiles, phone, otp } = route.params;
  const [loadingId, setLoadingId] = useState(null);
  const login = useAuthStore((state) => state.login);

  const handleSelectProfile = async (profileId) => {
    setLoadingId(profileId);
    try {
      const response = await apiClient.post('/auth/mobile-login-verify', {
        phone,
        otp,
        selected_profile_id: profileId,
      });

      if (response.data.type === 'login_success') {
        const { access_token, user: userData } = response.data;
        await login(access_token, userData);
        // Navigation is handled automatically by the auth state change
      } else {
        throw new Error('Unexpected response format.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to login with selected profile.');
      // If OTP expired during selection, go back to login
      if (error.response?.status === 400) {
        navigation.navigate('MobileLogin');
      }
    } finally {
      setLoadingId(null);
    }
  };

  const renderProfile = ({ item }) => {
    const isLoading = loadingId === item.id;
    return (
      <TouchableOpacity
        style={[styles.profileCard, isLoading && styles.profileCardLoading]}
        onPress={() => handleSelectProfile(item.id)}
        disabled={loadingId !== null}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{item.full_name}</Text>
          <Text style={styles.profileRole}>{item.role.charAt(0).toUpperCase() + item.role.slice(1)}</Text>
          <Text style={styles.profileEmail}>{item.email}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={isLoading ? "#94A3B8" : "#2563EB"} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgDecor1} />
      <View style={styles.bgDecor2} />

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} disabled={loadingId !== null}>
        <Ionicons name="arrow-back" size={24} color="#1E293B" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Who's Logging In?</Text>
          <Text style={styles.subtitle}>
            Multiple profiles are linked to {phone}. Please choose the profile you want to log into.
          </Text>
        </View>

        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={renderProfile}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bgDecor1: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#EEF2FF',
  },
  bgDecor2: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F0FDF4',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  content: {
    flex: 1,
    paddingTop: 120,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },
  listContainer: {
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  profileCardLoading: {
    opacity: 0.5,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 12,
    color: '#64748B',
  },
});
