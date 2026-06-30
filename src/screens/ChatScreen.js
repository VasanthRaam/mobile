import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  const user = useAuthStore((state) => state.user);
  const cacheKey = user?.id ? `chat_history_${user.id}` : 'chat_history';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);

  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

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

  const renderMessage = ({ item }) => (
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
        <Text style={[
          styles.messageText,
          item.isUser 
            ? [styles.messageTextUser, { color: '#ffffff' }] 
            : [styles.messageTextBot, { color: theme.text }]
        ]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
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

        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
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
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
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
});

export default ChatScreen;
