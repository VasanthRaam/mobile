import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, Animated, StatusBar, Image,
  ActivityIndicator
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../utils/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import apiClient from '../api/apiClient';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { getCache, setCache } from '../utils/cacheManager';
import * as ImagePicker from 'expo-image-picker';

WebBrowser.maybeCompleteAuthSession();

// ─── Role options ─────────────────────────────────────────────────────────────
const ROLES = [
  { label: 'Student', value: 'student', icon: '🎒', desc: 'I am enrolled in a class' },
  { label: 'Teacher', value: 'teacher', icon: '👩‍🏫', desc: 'I teach here' },
];

// ─── Validators ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{7,}$/;

function validateAll({ fullName, email, phone, password, confirmPassword, role, selectedBatches, isGoogle }) {
  if (!fullName.trim() || fullName.trim().length < 2)
    return 'Full name must be at least 2 characters.';
  if (!email.trim() || !EMAIL_RE.test(email.trim()))
    return 'Please enter a valid email address.';
  if (phone && !PHONE_RE.test(phone.trim()))
    return 'Phone number is not valid.';
  
  if (!isGoogle) {
    if (password.length < 6)
      return 'Password must be at least 6 characters.';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      return 'Password must contain at least one letter and one number.';
    if (password !== confirmPassword)
      return 'Passwords do not match.';
  }

  if (!role)
    return 'Please select your role.';
  if (selectedBatches.length === 0)
    return 'Please select at least one batch.';
  return null; 
}

export default function RegisterScreen({ navigation, route }) {
  const { email: initialEmail, full_name: initialName, isGoogle: initialIsGoogle, supabaseUid: initialSupabaseUid } = route.params || {};

  const { theme, isDark } = useThemeStore();

  const [isGoogleAuth, setIsGoogleAuth] = useState(initialIsGoogle || false);
  const [supabaseUid, setSupabaseUid] = useState(initialSupabaseUid || null);
  const [authMethod, setAuthMethod] = useState(initialIsGoogle ? 'google' : null);
  const [fullName, setFullName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(initialIsGoogle ? 'GOOGLE_AUTH_PLACEHOLDER' : '');
  const [confirmPassword, setConfirmPassword] = useState(initialIsGoogle ? 'GOOGLE_AUTH_PLACEHOLDER' : '');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Extra fields
  const [motherName, setMotherName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [parentPhoneNumber, setParentPhoneNumber] = useState('');
  const [dob, setDob] = useState('');
  const [educationQualification, setEducationQualification] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const login = useAuthStore((state) => state.login);

  // Courses & Batches Data
  const cachedData = getCache('courses_batches') || [];
  const [availableData, setAvailableData] = useState(cachedData);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [fetchingData, setFetchingData] = useState(cachedData.length === 0);

  const [errors, setErrors] = useState({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [pushToken, setPushToken] = useState(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchCoursesBatches();
    registerForPushNotificationsAsync().then(token => {
      if (token) setPushToken(token);
    });

    if (Platform.OS === 'web') {
      const hash = window.location.hash || window.location.search;
      if (hash) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token) {
          window.history.replaceState(null, null, ' ');
          handleGoogleCallback(access_token, refresh_token);
        }
      }
    }
  }, []);

  const fetchCoursesBatches = async () => {
    try {
      const res = await apiClient.get('/auth/courses-batches');
      setAvailableData(res.data);
      setCache('courses_batches', res.data);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load courses and batches.');
    } finally {
      setFetchingData(false);
    }
  };

  const toggleCourse = (courseId) => {
    if (selectedCourses.includes(courseId)) {
      setSelectedCourses(selectedCourses.filter(id => id !== courseId));
      const course = availableData.find(c => c.id === courseId);
      const batchIdsToRemove = course.batches.map(b => b.id);
      setSelectedBatches(selectedBatches.filter(id => !batchIdsToRemove.includes(id)));
    } else {
      setSelectedCourses([...selectedCourses, courseId]);
    }
  };

  const toggleBatch = (batchId) => {
    if (selectedBatches.includes(batchId)) {
      setSelectedBatches(selectedBatches.filter(id => id !== batchId));
    } else {
      setSelectedBatches([...selectedBatches, batchId]);
    }
  };

  // Separate state to track the initial Google OAuth loading (before form is shown)
  const [googleCallbackLoading, setGoogleCallbackLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    
    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfilePicture(base64Img);
    }
  };

  const handleGoogleCallback = async (access_token, refresh_token) => {
    setGoogleCallbackLoading(true);
    let user = null;
    try {
      if (access_token && refresh_token) {
        try {
          const { data: sessionData, error: userError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!userError && sessionData?.user) {
            user = sessionData.user;
          }
        } catch (sessErr) {
          console.warn("[GOOGLE-REG] Supabase setSession error, falling back:", sessErr);
        }
      }

      if (!user) {
        const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser(access_token);
        if (userError) throw userError;
        user = supabaseUser;
      }

      if (!user) {
        throw new Error("No user profile returned from Supabase session.");
      }

      const userEmail = user.email || '';
      const userFullName = user.user_metadata?.full_name || user.user_metadata?.name || userEmail.split('@')[0] || 'Google User';

      try {
        const backendRes = await apiClient.post('/auth/google-sync', {
          access_token,
          email: userEmail,
          full_name: userFullName,
        });
        // If success, they are already registered and approved! Log them in.
        const { user: userData } = backendRes.data;
        await login(access_token, userData);
      } catch (backendError) {
        if (backendError.response?.status === 404) {
           // New user, populate fields and show the registration form
           setEmail(userEmail);
           setFullName(userFullName);
           setIsGoogleAuth(true);
           setAuthMethod('google');
           setPassword('GOOGLE_AUTH_PLACEHOLDER');
           setConfirmPassword('GOOGLE_AUTH_PLACEHOLDER');
           setSupabaseUid(user.id);
        } else {
           throw backendError;
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Google Registration Failed', error.message);
    } finally {
      setGoogleCallbackLoading(false);
    }
  };

  const handleGoogleRegistration = async () => {
    setGoogleCallbackLoading(true);
    try {
      const redirectUri = Platform.OS === 'web' 
        ? window.location.origin
        : makeRedirectUri({
            scheme: 'buddybloom',
            path: 'auth-callback',
          });

      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
          },
        });
        if (error) throw error;
        return; // Redirects automatically on Web
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (!data || !data.url) {
        throw new Error('No authentication URL was returned from the authentication server.');
      }

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (res.type === 'success') {
        const { url } = res;
        
        // Robust parameter parser that extracts both access_token and code from search and hash params
        const params = {};
        const regex = /[?&#]([^=#]+)=([^&#]*)/g;
        let match;
        while ((match = regex.exec(url)) !== null) {
          params[match[1]] = decodeURIComponent(match[2]);
        }

        let access_token = params.access_token || null;
        let refresh_token = params.refresh_token || null;
        const code = params.code || null;

        if (code) {
          // Exchange PKCE authorization code for session
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          access_token = exchangeData.session?.access_token || null;
          refresh_token = exchangeData.session?.refresh_token || null;
        }

        if (access_token) {
          await handleGoogleCallback(access_token, refresh_token);
        } else {
          Alert.alert('Authentication Failed', 'No access token or authorization code found in redirect URL.');
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Google Registration Failed', error.message);
    } finally {
      setGoogleCallbackLoading(false);
    }
  };

  const handleRegister = async () => {
    const err = validateAll({ fullName, email, phone, password, confirmPassword, role, selectedBatches, isGoogle: isGoogleAuth });
    if (err) {
      Alert.alert('Incomplete Form', err);
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/register', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        password,
        role,
        course_ids: selectedCourses,
        batch_ids: selectedBatches,
        push_token: pushToken,
        supabase_uid: supabaseUid,
        mother_name: role === 'student' ? motherName.trim() : null,
        father_name: role === 'student' ? fatherName.trim() : null,
        parent_phone_number: role === 'student' ? parentPhoneNumber.trim() : null,
        dob: dob.trim() || null,
        education_qualification: educationQualification.trim() || null,
        profile_picture: profilePicture,
      });
      setSubmitted(true);
    } catch (error) {
      const detail = error.response?.data?.detail || 'Registration failed.';
      Alert.alert('Registration Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  // Full-screen loading overlay while Google OAuth is in progress
  if (googleCallbackLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.fullScreenLoader}>
          <View style={[styles.loaderCard, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loaderTitle, { color: theme.text }]}>Signing in with Google</Text>
            <Text style={[styles.loaderSubtitle, { color: theme.subText }]}>Please wait while we verify your account...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={[styles.successContainer, { backgroundColor: theme.bg }]}>
        <Animated.View style={[styles.successCard, { opacity: fadeAnim, backgroundColor: theme.card }]}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={[styles.successTitle, { color: theme.text }]}>Request Submitted!</Text>
          <Text style={[styles.successMsg, { color: theme.subText }]}>
            Your registration is being reviewed by an admin. You will be able to login once approved.
          </Text>
          <TouchableOpacity style={[styles.backToLoginBtn, { backgroundColor: theme.accent }]} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: theme.accent }]}>← Back to Login</Text>
          </TouchableOpacity>

          <View style={styles.heading}>
            <View style={[styles.logoCircle, { backgroundColor: theme.card }]}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.logoImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>Fill in your details to join VHA EduTech</Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {authMethod === null ? (
              <View style={styles.choiceContainer}>
                <TouchableOpacity
                  style={[styles.googleBtnLarge, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={handleGoogleRegistration}
                  activeOpacity={0.7}
                >
                  <Image 
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} 
                    style={styles.googleIconLarge} 
                  />
                  <Text style={[styles.googleBtnTextLarge, { color: theme.text }]}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  <Text style={[styles.dividerText, { color: theme.muted }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                </View>

                <TouchableOpacity
                  style={[styles.emailBtnLarge, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
                  onPress={() => setAuthMethod('email')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.emailBtnTextLarge, { color: theme.text }]}>Continue with Email</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>

            <Text style={[styles.sectionLabel, { color: theme.text }]}>Select Your Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.roleChip, 
                    { backgroundColor: theme.chipBg, borderColor: theme.border },
                    role === r.value && { backgroundColor: theme.accentLight, borderColor: theme.accent }
                  ]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={styles.roleChipIcon}>{r.icon}</Text>
                  <Text style={[
                    styles.roleChipLabel, 
                    { color: theme.subText },
                    role === r.value && { color: theme.accent, fontWeight: '700' }
                  ]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Profile Picture */}
            <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
              <TouchableOpacity onPress={pickImage} style={[styles.avatarPicker, { backgroundColor: theme.chipBg, borderColor: theme.border }]}>
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 32 }}>📸</Text>
                    <Text style={{ color: theme.subText, fontSize: 12, marginTop: 4 }}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Enter your full name" editable={true} />
            
            {role === 'student' && (
              <>
                <Field label="Mother's Name" value={motherName} onChangeText={setMotherName} placeholder="Enter mother's name" />
                <Field label="Father's Name" value={fatherName} onChangeText={setFatherName} placeholder="Enter father's name" />
                <Field label="Parent's Phone Number" value={parentPhoneNumber} onChangeText={setParentPhoneNumber} placeholder="Enter parent's phone number" keyboardType="phone-pad" />
              </>
            )}
            
            <Field label="Date of Birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" type="date" />
            <Field label="Educational Qualification" value={educationQualification} onChangeText={setEducationQualification} placeholder="e.g. 5th std, B.Sc" />

            <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" editable={authMethod !== 'google'} isReadOnly={authMethod === 'google'} />
            <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 9876543210" keyboardType="phone-pad" />
            
            {/* Courses & Batches Selection */}
            <Text style={[styles.sectionLabel, { marginTop: 10, color: theme.text }]}>Select Courses & Batches</Text>
            {fetchingData ? (
              <Text style={{ marginVertical: 10, color: theme.accent, fontWeight: '600' }}>Loading courses & batches...</Text>
            ) : (
              <View style={styles.selectionArea}>
                {availableData.map(course => (
                  <View key={course.id} style={[styles.courseBlock, { borderColor: theme.border }]}>
                    <TouchableOpacity 
                      style={[
                        styles.courseHeader, 
                        { backgroundColor: theme.bg },
                        selectedCourses.includes(course.id) && { backgroundColor: theme.accentLight }
                      ]}
                      onPress={() => toggleCourse(course.id)}
                    >
                      <Text style={[
                        styles.courseName, 
                        { color: theme.text },
                        selectedCourses.includes(course.id) && { color: theme.accent }
                      ]}>{course.name}</Text>
                      <Text style={styles.checkIcon}>{selectedCourses.includes(course.id) ? '✅' : '⬜'}</Text>
                    </TouchableOpacity>
                    
                    {selectedCourses.includes(course.id) && (
                      <View style={[styles.batchList, { backgroundColor: theme.card }]}>
                        {course.batches.map(batch => (
                          <TouchableOpacity 
                            key={batch.id} 
                            style={[
                              styles.batchChip, 
                              { backgroundColor: theme.chipBg, borderColor: theme.border },
                              selectedBatches.includes(batch.id) && { backgroundColor: theme.accent, borderColor: theme.accent }
                            ]}
                            onPress={() => toggleBatch(batch.id)}
                          >
                            <Text style={[
                              styles.batchText, 
                              { color: theme.subText },
                              selectedBatches.includes(batch.id) && { color: '#fff' }
                            ]}>{batch.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Hide password fields for Google users */}
            {authMethod === 'email' && (
              <>
                <Field label="Password" value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry={!showPassword} />
                <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" secureTextEntry={!showConfirmPassword} />
              </>
            )}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.accent }, loading && styles.submitBtnDisabled]} onPress={handleRegister} disabled={loading}>
              <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit Registration Request'}</Text>
            </TouchableOpacity>
            </>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, isReadOnly, type, ...props }) {
  const { theme } = useThemeStore();
  const isWebDate = Platform.OS === 'web' && type === 'date';
  
  return (
    <View style={styles.fieldWrapper}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 0 }]}>{label}</Text>
        {isReadOnly && (
          <View style={[styles.readOnlyBadge, { backgroundColor: theme.chipBg, borderColor: theme.border }]}>
            <Text style={[styles.readOnlyText, { color: theme.muted }]}>🔒 auto-filled</Text>
          </View>
        )}
      </View>
      {isWebDate ? (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={placeholder}
          style={{
            height: 50,
            backgroundColor: theme.inputBg,
            borderColor: theme.border,
            color: theme.text,
            borderWidth: 1,
            borderStyle: 'solid',
            borderRadius: 12,
            paddingLeft: 16,
            paddingRight: 16,
            fontSize: 14,
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'System',
          }}
        />
      ) : (
        <TextInput 
          style={[
            styles.input, 
            { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
            isReadOnly && { backgroundColor: theme.chipBg, color: theme.muted }
          ]} 
          value={value} 
          onChangeText={onChangeText} 
          placeholder={placeholder} 
          placeholderTextColor={theme.muted} 
          {...props} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  backBtn: { marginTop: 20, marginBottom: 20 },
  backBtnText: { color: '#6366F1', fontWeight: '700' },
  heading: { marginBottom: 24, alignItems: 'center' },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10, marginBottom: 20 },
  logoImage: { width: '65%', height: '65%' },
  title: { fontSize: 28, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  googleBtnLarge: { flexDirection: 'row', backgroundColor: '#fff', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  googleIconLarge: { width: 24, height: 24, marginRight: 12 },
  googleBtnTextLarge: { color: '#1E293B', fontSize: 16, fontWeight: '700' },
  emailBtnLarge: { backgroundColor: '#F8FAFC', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emailBtnTextLarge: { color: '#475569', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { marginHorizontal: 10, color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleChip: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  roleChipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  roleChipIcon: { fontSize: 20, marginBottom: 4 },
  roleChipLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  roleChipLabelActive: { color: '#6366F1' },
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B' },
  avatarPicker: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderStyle: 'dashed' },
  avatarImage: { width: '100%', height: '100%' },
  selectionArea: { marginBottom: 20 },
  courseBlock: { marginBottom: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#F8FAFC' },
  courseHeaderActive: { backgroundColor: '#EEF2FF' },
  courseName: { fontSize: 15, fontWeight: '700', color: '#475569' },
  courseNameActive: { color: '#6366F1' },
  checkIcon: { fontSize: 16 },
  batchList: { padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#fff' },
  batchChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  batchChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  batchText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  batchTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#6366F1', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  successCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', elevation: 10 },
  successIcon: { fontSize: 50, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginBottom: 12 },
  successMsg: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  backToLoginBtn: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backToLoginText: { color: '#fff', fontWeight: '700' },
  // Full-screen loader
  fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loaderCard: { backgroundColor: '#fff', borderRadius: 28, padding: 40, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  loaderTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginTop: 20, marginBottom: 10, textAlign: 'center' },
  loaderSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  // Read-only badge for auto-filled fields
  readOnlyBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  readOnlyText: { fontSize: 10, fontWeight: '600' },
});
