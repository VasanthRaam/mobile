import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} text
 * @property {boolean} isUser
 */

const ChatScreen = ({ navigation }) => {
  const { theme, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const cacheKey = user?.id ? `chat_history_${user.id}` : 'chat_history';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);

  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const activeSpeakingIdRef = useRef(null);

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const playVoice = async (id, englishText, hindiText) => {
    try {
      if (speakingMessageId === id) {
        await Speech.stop();
        setSpeakingMessageId(null);
        activeSpeakingIdRef.current = null;
        return;
      }
      
      setSpeakingMessageId(id);
      activeSpeakingIdRef.current = id;
      await Speech.stop();
      
      Speech.speak(englishText, {
        language: 'en',
        onDone: () => {
          if (activeSpeakingIdRef.current === id) {
            Speech.speak(hindiText, {
              language: 'hi',
              onDone: () => {
                if (activeSpeakingIdRef.current === id) {
                  setSpeakingMessageId(null);
                  activeSpeakingIdRef.current = null;
                }
              },
              onError: () => {
                if (activeSpeakingIdRef.current === id) {
                  setSpeakingMessageId(null);
                  activeSpeakingIdRef.current = null;
                }
              }
            });
          }
        },
        onError: () => {
          if (activeSpeakingIdRef.current === id) {
            setSpeakingMessageId(null);
            activeSpeakingIdRef.current = null;
          }
        }
      });
    } catch (error) {
      console.error('Speech synthesis error:', error);
      setSpeakingMessageId(null);
      activeSpeakingIdRef.current = null;
    }
  };

  // Initialize messages from cache when cacheKey (user) changes
  useEffect(() => {
    const cached = getCache(cacheKey);
    if (cached && cached.length > 0) {
      setMessages(cached);
    } else {
      setMessages([
        { id: 'initial-msg', text: 'Namaste! I am the Academy AI Teacher. How can I help you today?', isUser: false }
      ]);
    }
  }, [cacheKey]);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsFetchingHistory(true);
      try {
        const response = await apiClient.get('/chat/');
        if (response.data && response.data.length > 0) {
          const formatted = response.data.map(msg => ({
            id: msg.id,
            text: msg.content,
            isUser: msg.role === 'user'
          }));
          setMessages(formatted);
          setCache(cacheKey, formatted);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsFetchingHistory(false);
      }
    };
    fetchHistory();
  }, [cacheKey]);

  useEffect(() => {
    const scrollTimeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(scrollTimeout);
  }, [messages]);


  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessageText = inputText.trim();
    const newUserMsg = {
      id: Date.now().toString() + '-user',
      text: userMessageText,
      isUser: true,
    };

    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setCache(cacheKey, updatedMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/chat/', { message: userMessageText });
      
      const botMessage = {
        id: Date.now().toString() + '-bot',
        text: response.data.answer,
        isUser: false,
      };

      const finalMessages = [...updatedMessages, botMessage];
      setMessages(finalMessages);
      setCache(cacheKey, finalMessages);
    } catch (error) {
      console.error('Chat API Error:', error);
      const serverErrorMessage = error.response?.data?.detail || "I'm sorry, I encountered an error connecting to the academy systems. Please try again later.";
      const errorMsg = {
        id: Date.now().toString() + '-error',
        text: serverErrorMessage,
        isUser: false,
      };
      const finalErrorMessages = [...updatedMessages, errorMsg];
      setMessages(finalErrorMessages);
      setCache(cacheKey, finalErrorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    let parsedTranslation = null;
    if (!item.isUser) {
      try {
        parsedTranslation = JSON.parse(item.text);
      } catch (e) {
        // Not valid JSON, treat as legacy message
      }
    }

    const isSpeaking = speakingMessageId === item.id;

    return (
      <View style={[
        styles.messageWrapper,
        item.isUser ? styles.messageWrapperUser : styles.messageWrapperBot
      ]}>
        <View style={[
          styles.messageBubble,
          item.isUser 
            ? [styles.messageBubbleUser, { backgroundColor: theme.accent }] 
            : [styles.messageBubbleBot, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]
        ]}>
          {parsedTranslation ? (
            <View style={styles.translationContainer}>
              <View style={styles.translationTextContainer}>
                {parsedTranslation.english && (
                  <View style={styles.phraseSection}>
                    <Text style={[styles.sectionLabel, { color: theme.subText }]}>English</Text>
                    <Text style={[styles.englishText, { color: theme.text }]}>{parsedTranslation.english}</Text>
                  </View>
                )}
                {parsedTranslation.hindi_script && (
                  <View style={styles.phraseSection}>
                    <Text style={[styles.sectionLabel, { color: theme.subText }]}>Hindi Script</Text>
                    <Text style={[styles.hindiScriptText, { color: theme.accent }]}>{parsedTranslation.hindi_script}</Text>
                  </View>
                )}
                {parsedTranslation.hindi_romanized && (
                  <View style={styles.phraseSection}>
                    <Text style={[styles.sectionLabel, { color: theme.subText }]}>Pronunciation</Text>
                    <Text style={[styles.romanizedText, { color: theme.textMid }]}>{parsedTranslation.hindi_romanized}</Text>
                  </View>
                )}
              </View>
              
              <TouchableOpacity 
                style={[
                  styles.voiceButton, 
                  { 
                    backgroundColor: isSpeaking ? theme.accent : theme.accentLight,
                    borderColor: theme.accent,
                    borderWidth: 1
                  }
                ]}
                onPress={() => playVoice(item.id, parsedTranslation.english || "", parsedTranslation.hindi_script || "")}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name={isSpeaking ? "volume-high" : "volume-medium"} 
                  size={20} 
                  color={isSpeaking ? "#ffffff" : theme.accent} 
                />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[
              styles.messageText,
              item.isUser 
                ? [styles.messageTextUser, { color: '#ffffff' }] 
                : [styles.messageTextBot, { color: theme.text }]
            ]}>
              {item.text}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 80, default: 0 })}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.chatList, { backgroundColor: theme.bg }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.subText }]}>AI Teacher is typing...</Text>
          </View>
        )}

        <View style={[
          styles.inputContainer, 
          { 
            backgroundColor: theme.card, 
            borderTopColor: theme.border,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 12)
          }
        ]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor={theme.muted}
            multiline
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              { backgroundColor: theme.accent },
              (!inputText.trim() || isLoading) && { backgroundColor: theme.muted }
            ]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            <MaterialCommunityIcons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  chatList: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperBot: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  messageBubbleUser: {
    backgroundColor: '#6200EE',
    borderBottomRightRadius: 4,
  },
  messageBubbleBot: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTextBot: {
    color: '#1E293B',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 0,
  },
  loadingText: {
    marginLeft: 8,
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: '#1E293B',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#6200EE',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  translationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minWidth: 220,
    paddingVertical: 4,
  },
  translationTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  phraseSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  englishText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  hindiScriptText: {
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 30,
    marginTop: 2,
  },
  romanizedText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default ChatScreen;
