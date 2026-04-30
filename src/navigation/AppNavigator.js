import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
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

const Stack = createNativeStackNavigator();

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // ── Unauthenticated Stack ──────────────────────────────────
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
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
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
