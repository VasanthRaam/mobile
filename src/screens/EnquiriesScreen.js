import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Linking, RefreshControl,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import apiClient from '../api/apiClient';

export default function EnquiriesScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchEnquiries = async () => {
    try {
      const response = await apiClient.get('/enquiry/');
      setEnquiries(response.data);
      setFilteredEnquiries(response.data);
    } catch (error) {
      console.error('Failed to fetch enquiries:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEnquiries();
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text) {
      setFilteredEnquiries(enquiries);
      return;
    }
    const cleanText = text.toLowerCase();
    const filtered = enquiries.filter((item) => {
      const fullName = `${item.firstName} ${item.lastName}`.toLowerCase();
      const phone = item.phone.toLowerCase();
      const course = item.course.toLowerCase();
      return (
        fullName.includes(cleanText) ||
        phone.includes(cleanText) ||
        course.includes(cleanText)
      );
    });
    setFilteredEnquiries(filtered);
  };

  const handleDialCall = (phone) => {
    Linking.openURL(`tel:${phone}`).catch((err) =>
      console.warn('Failed to open dialer:', err)
    );
  };

  const renderEnquiryItem = ({ item }) => {
    const dateStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarText}>
                {item.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.userName, { color: theme.text }]}>
                {item.firstName} {item.lastName}
              </Text>
              <Text style={[styles.dateText, { color: theme.muted }]}>
                {dateStr}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: theme.chipBg }]}
            onPress={() => handleDialCall(item.phone)}
          >
            <Ionicons name="call" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.subText }]}>Course: </Text>
            <Text style={[styles.value, { color: theme.text }]}>{item.course}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: theme.subText }]}>Batch: </Text>
            <Text style={[styles.value, { color: theme.text, textTransform: 'capitalize' }]}>
              {item.batch}
            </Text>
          </View>
          {item.message ? (
            <View style={styles.messageBox}>
              <Text style={[styles.label, { color: theme.subText, marginBottom: 4 }]}>Message:</Text>
              <Text style={[styles.messageText, { color: theme.text }]}>{item.message}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Website Enquiries</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="search" size={20} color={theme.muted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search by name, phone, or course..."
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={handleSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color={theme.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredEnquiries}
          keyExtractor={(item) => item.id}
          renderItem={renderEnquiryItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                No website enquiries found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
    marginTop: 2,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    width: 70,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  messageBox: {
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 10,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
