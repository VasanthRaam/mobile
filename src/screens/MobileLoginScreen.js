import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export default function MobileLoginScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.bgDecor1, { backgroundColor: isDark ? theme.accentLight : '#EEF2FF' }]} />
      <View style={[styles.bgDecor2, { backgroundColor: isDark ? theme.successLight : '#F0FDF4' }]} />

      <View style={styles.keyboardView}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.card }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.card }]}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>BuddyBloom</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>Nurturing Minds, Together.</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.card }]}>
          <View style={styles.iconWrapper}>
            <Text style={styles.wipIcon}>🚧</Text>
          </View>
          <Text style={[styles.formTitle, { color: theme.text }]}>Coming Soon</Text>
          <Text style={[styles.formSubtitle, { color: theme.subText }]}>
            Mobile number login is currently under development and will be available in a future update.
          </Text>
          <View style={[styles.infoBox, { backgroundColor: isDark ? theme.chipBg : '#FEF9C3', borderColor: isDark ? theme.border : '#FDE047' }]}>
            <Ionicons name="information-circle-outline" size={18} color={isDark ? theme.subText : '#854D0E'} />
            <Text style={[styles.infoText, { color: isDark ? theme.subText : '#854D0E' }]}>
              In the meantime, please use Google or Email to sign in.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>Go Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
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
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    marginBottom: 20,
  },
  logoImage: {
    width: '65%',
    height: '65%',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 20,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 16,
  },
  wipIcon: {
    fontSize: 56,
    textAlign: 'center',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    gap: 10,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: '#854D0E',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
