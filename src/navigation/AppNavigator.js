import React from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import MobileLoginScreen from '../screens/MobileLoginScreen';
import MobileOTPVerifyScreen from '../screens/MobileOTPVerifyScreen';
import ProfileSelectionScreen from '../screens/ProfileSelectionScreen';
import UnlockScreen from '../screens/UnlockScreen';
import EmailLoginScreen from '../screens/EmailLoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import QuizListScreen from '../screens/QuizListScreen';
import QuizScreen from '../screens/QuizScreen';
import QuizResultsScreen from '../screens/QuizResultsScreen';
import CreateQuizScreen from '../screens/CreateQuizScreen';
import NotificationHeader from '../components/NotificationHeader';
import SubmissionDetailScreen from '../screens/SubmissionDetailScreen';
import AssignHomeworkScreen from '../screens/AssignHomeworkScreen';
import HomeworkListScreen from '../screens/HomeworkListScreen';
import MyCoursesScreen from '../screens/MyCoursesScreen';
import PendingApprovalsScreen from '../screens/PendingApprovalsScreen';
import FeesScreen from '../screens/FeesScreen';
import RevenueScreen from '../screens/RevenueScreen';
import ChatScreen from '../screens/ChatScreen';
import AdminScreen from '../screens/AdminScreen';
import EnquiriesScreen from '../screens/EnquiriesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TeacherProfileScreen from '../screens/TeacherProfileScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';

function DashboardProfileIcon({ navigation }) {
  const { user } = useAuthStore();
  const { isDark } = useThemeStore();
  const role = user?.role;

  if (!user) return null;

  return (
    <TouchableOpacity
      style={{ marginLeft: Platform.OS === 'ios' ? 0 : 4, marginRight: 12, position: 'relative' }}
      onPress={() => {
        if (role === 'teacher') navigation.navigate('TeacherProfile');
        else if (role === 'student') navigation.navigate('Profile');
      }}
      activeOpacity={0.8}
    >
      {user.profile_picture ? (
        <Image
          source={{ uri: user.profile_picture }}
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#6366F1' }}
        />
      ) : (
        <View style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: isDark ? '#334155' : '#E0E7FF',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: '#6366F1',
        }}>
          <Text style={{
            fontSize: 13,
            fontWeight: '800',
            color: isDark ? '#A5B4FC' : '#4F46E5',
          }}>
            {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </Text>
        </View>
      )}
      <View style={{
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10B981',
        borderWidth: 1.5,
        borderColor: isDark ? '#1E293B' : '#FFFFFF',
      }} />
    </TouchableOpacity>
  );
}

const Stack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const requiresUnlock = useAuthStore((state) => state.requiresUnlock);
  const { isDark, theme } = useThemeStore();

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const customTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: theme.bg,
      card: theme.headerBg,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={customTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {requiresUnlock ? (
          // ── Unlock Stack ───────────────────────────────────────────
          <Stack.Screen name="Unlock" component={UnlockScreen} />
        ) : !isAuthenticated ? (
          // ── Unauthenticated Stack ──────────────────────────────────
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="MobileLogin" component={MobileLoginScreen} />
            <Stack.Screen name="MobileOTPVerify" component={MobileOTPVerifyScreen} />
            <Stack.Screen name="ProfileSelection" component={ProfileSelectionScreen} />
          </>
        ) : (
          // ── Authenticated Stack ────────────────────────────────────
          <Stack.Group screenOptions={{
            headerShown: true,
            headerRight: () => <NotificationHeader />,
          }}>
            <Stack.Screen 
              name="Dashboard" 
              component={DashboardScreen} 
              options={({ navigation }) => ({
                headerTitle: "VHA Edutech",
                headerLeft: () => <DashboardProfileIcon navigation={navigation} />,
              })}
            />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="QuizList" component={QuizListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Quiz" component={QuizScreen} options={{ headerShown: false }} />
            <Stack.Screen name="QuizResults" component={QuizResultsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreateQuiz" component={CreateQuizScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SubmissionDetail" component={SubmissionDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AssignHomework" component={AssignHomeworkScreen} options={{ headerShown: false }} />
            <Stack.Screen name="HomeworkList" component={HomeworkListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MyCourses" component={MyCoursesScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="PendingApprovals"
              component={PendingApprovalsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Fees" component={FeesScreen} options={{ title: 'Fees & Payments' }} />
            <Stack.Screen name="Revenue" component={RevenueScreen} options={{ title: 'Revenue Tracker' }} />
            <Stack.Screen name="Enquiries" component={EnquiriesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Academy AI Teacher' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TeacherProfile" component={TeacherProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
