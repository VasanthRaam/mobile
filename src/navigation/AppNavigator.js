import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';

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

const Stack = createNativeStackNavigator();

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const requiresUnlock = useAuthStore((state) => state.requiresUnlock);

  return (
    <NavigationContainer ref={navigationRef}>
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
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="QuizList" component={QuizListScreen} />
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
            <Stack.Screen name="Fees" component={FeesScreen} options={{ title: 'Fees & Payments' }} />
            <Stack.Screen name="Revenue" component={RevenueScreen} options={{ title: 'Revenue Tracker' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Academy AI Teacher' }} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
