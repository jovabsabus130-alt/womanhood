import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchOrders } from '../src/api';
import { COLORS, SHADOWS } from '../src/theme';

const STATUS_MAP = {
  material_collected: { label: 'Material Collected', icon: '🧵' },
  cutting: { label: 'Cutting', icon: '✂️' },
  stitching_in_progress: { label: 'Stitching', icon: '🪡' },
  ready_to_collect: { label: 'Ready', icon: '👜' },
  collected: { label: 'Collected', icon: '✅' },
};

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchOrders = async (searchQuery = '', pageNum = 1, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    try {
      const res = await searchOrders(searchQuery, pageNum);
      const newOrders = res.data.orders || [];
      if (isLoadMore) {
        setOrders(prev => [...prev, ...newOrders]);
      } else {
        setOrders(newOrders);
      }
      setHasMore(res.data.hasMore);
      setPage(pageNum);
    } catch (err) {
      if (err.response?.status === 401) {
        await AsyncStorage.removeItem('token');
        router.replace('/');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders('', 1);
  }, []);

  // Debounced search
  useEffect(() => {
    // Skip first render since it's handled by mount effect
    if (loading && page === 1 && !query) return;
    const timer = setTimeout(() => {
      fetchOrders(query, 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders(query, 1);
  }, [query]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      fetchOrders(query, page + 1, true);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  };

  const renderOrderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => router.push(`/order/${item._id}`)}
      activeOpacity={0.85}
    >
      {item.clothPhoto ? (
        <Image source={{ uri: item.clothPhoto }} style={styles.orderImage} />
      ) : (
        <View style={styles.orderImagePlaceholder}>
          <Text style={{ fontSize: 32 }}>👗</Text>
        </View>
      )}
      <View style={styles.orderInfo}>
        <Text style={styles.orderName} numberOfLines={1}>
          {item.customerName}
        </Text>
        <Text style={styles.orderSerial}>Serial: {item.serialNumber}</Text>
        <Text style={styles.orderPhone}>📱 {item.phoneNumber}</Text>
        <Text style={styles.orderDate}>
          Due: {formatDate(item.deliveryDueDate)}
        </Text>
        {item.status && (
          <View
            style={[
              styles.statusBadge,
              item.status === 'collected' && styles.statusBadgeCollected,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {STATUS_MAP[item.status]?.icon} {STATUS_MAP[item.status]?.label}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>
          {query ? '🔍' : '📋'}
        </Text>
        <Text style={styles.emptyTitle}>
          {query ? 'No Orders Found' : 'No Orders Yet'}
        </Text>
        <Text style={styles.emptyText}>
          {query
            ? `No results for "${query}"`
            : 'Tap the + button to add your first order'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Gradient header */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.1)', 'transparent']}
        style={styles.gradient}
      />

      {/* Search bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchCard}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Name, Serial no, Phone no."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={{ fontSize: 16, color: COLORS.textMuted }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Order list */}
      <FlatList
        data={orders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} /> : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add-order')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Bottom Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navbarTab}
          activeOpacity={0.75}
          accessibilityLabel="Home tab, currently active"
        >
          <Text style={styles.navbarIcon}>🏠</Text>
          <Text style={[styles.navbarLabel, styles.navbarLabelActive]}>Home</Text>
          <View style={styles.navbarActiveBar} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navbarTab}
          onPress={() => router.push('/calendar')}
          activeOpacity={0.75}
          accessibilityLabel="Go to Calendar"
        >
          <Text style={styles.navbarIcon}>📅</Text>
          <Text style={styles.navbarLabel}>Calendar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 0,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    zIndex: 1,
  },
  searchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    ...SHADOWS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchIcon: {
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textMain,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 160,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    ...SHADOWS.card,
    padding: 12,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  orderImage: {
    width: 110,
    height: 130,
    borderRadius: 16,
  },
  orderImagePlaceholder: {
    width: 110,
    height: 130,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  orderName: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 15,
    color: COLORS.textMain,
  },
  orderSerial: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: COLORS.textSub,
  },
  orderPhone: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: COLORS.textSub,
  },
  orderDate: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
    ...SHADOWS.btn,
  },
  statusBadgeCollected: {
    backgroundColor: COLORS.primaryDark,
  },
  statusBadgeText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 9,
    color: COLORS.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 18,
    color: COLORS.textMain,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 86,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.btn,
  },
  fabText: {
    fontSize: 32,
    color: COLORS.white,
    fontWeight: '800',
    marginTop: -2,
  },
  // Bottom Navbar
  navbar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#f0ebe6',
    height: 85,
    paddingBottom: 20,
    ...SHADOWS.card,
  },
  navbarTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingBottom: 8,
  },
  navbarIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  navbarLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: COLORS.textMuted,
  },
  navbarLabelActive: {
    fontFamily: 'Inter_800ExtraBold',
    color: COLORS.primaryDark,
  },
  navbarActiveBar: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});
