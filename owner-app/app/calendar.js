import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrdersByDate } from '../src/api';
import { COLORS, SHADOWS } from '../src/theme';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert any Date/string to local 'YYYY-MM-DD' */
const toLocalKey = (dateVal) => {
  const d = new Date(dateVal);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Today as local 'YYYY-MM-DD' */
const todayKey = () => toLocalKey(new Date());

/** Step a YYYY-MM-DD key by delta days */
const stepDay = (key, delta) => {
  const [y, m, d] = key.split('-').map(Number);
  return toLocalKey(new Date(y, m - 1, d + delta));
};

/** "Monday, 8 May 2026" */
const formatDayDisplay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const STATUS_MAP = {
  material_collected: { label: 'Material Collected', icon: '🧵' },
  cutting:            { label: 'Cutting',             icon: '✂️' },
  stitching_in_progress: { label: 'Stitching',        icon: '🪡' },
  ready_to_collect:   { label: 'Ready',               icon: '👜' },
};

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CalendarDayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const initialDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayKey();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Swipe ────────────────────────────────────────────────────────────────
  const swipeX = useRef(0);
  const THRESHOLD = 60;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: (e) => { swipeX.current = e.nativeEvent.pageX; },
      onPanResponderRelease: (e, gs) => {
        const dx = gs.dx;
        if (dx >= THRESHOLD) {
          setSelectedDate((prev) => stepDay(prev, -1));
        } else if (dx <= -THRESHOLD) {
          setSelectedDate((prev) => stepDay(prev, 1));
        }
      },
    })
  ).current;

  // ── Fetch orders for specific local date ───────────────────────────────
  const fetchOrders = useCallback(async (dateKey) => {
    setLoading(true);
    try {
      const res = await getOrdersByDate(dateKey);
      setOrders(res.data.orders || []);
    } catch (err) {
      if (err.response?.status === 401) {
        await AsyncStorage.removeItem('token');
        router.replace('/');
      }
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(selectedDate); }, [selectedDate]);

  // ── Renderers ────────────────────────────────────────────────────────────
  const fmtShort = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => router.push(`/order/${item._id}`)}
      activeOpacity={0.85}
    >
      {item.clothPhoto ? (
        <Image source={{ uri: item.clothPhoto }} style={styles.orderImage} />
      ) : (
        <View style={styles.orderImagePlaceholder}>
          <Text style={{ fontSize: 28 }}>👗</Text>
        </View>
      )}
      <View style={styles.orderInfo}>
        <Text style={styles.orderName} numberOfLines={1}>{item.customerName}</Text>
        <Text style={styles.orderSerial}>Serial: {item.serialNumber}</Text>
        <Text style={styles.orderPhone}>📱 {item.phoneNumber}</Text>
        <Text style={styles.orderDate}>Due: {fmtShort(item.deliveryDueDate)}</Text>
        {item.status && STATUS_MAP[item.status] && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {STATUS_MAP[item.status].icon} {STATUS_MAP[item.status].label}
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
        <Text style={{ fontSize: 44, marginBottom: 10 }}>📭</Text>
        <Text style={styles.emptyTitle}>No Pending Orders</Text>
        <Text style={styles.emptyText}>No pending work due on this day.</Text>
      </View>
    );
  };

  const isToday = selectedDate === todayKey();

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.monthBtn}
          onPress={() => router.push(`/calendar-month?from=${selectedDate}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.monthBtnIcon}>📅</Text>
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateMain}>{formatDayDisplay(selectedDate)}</Text>
          {isToday && <Text style={styles.todayBadge}>TODAY</Text>}
        </View>
        <View style={{ width: 48 }} />
      </View>

      {/* Nav */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setSelectedDate((p) => stepDay(p, -1))} activeOpacity={0.8}>
          <Text style={styles.navBtnText}>‹ Prev</Text>
        </TouchableOpacity>
        {!isToday && (
          <TouchableOpacity style={styles.todayBtn} onPress={() => setSelectedDate(todayKey())} activeOpacity={0.8}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.navBtn} onPress={() => setSelectedDate((p) => stepDay(p, 1))} activeOpacity={0.8}>
          <Text style={styles.navBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {loading ? (
          <View style={styles.loaderWrapper}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={orders}
            renderItem={renderCard}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmpty}
          />
        )}
      </View>

      {/* Bottom Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbarTab} onPress={() => router.replace('/home')} activeOpacity={0.75}>
          <Text style={styles.navbarIcon}>🏠</Text>
          <Text style={styles.navbarLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navbarTab} onPress={() => setSelectedDate(todayKey())} activeOpacity={0.75}>
          <Text style={styles.navbarIcon}>📅</Text>
          <Text style={[styles.navbarLabel, styles.navbarLabelActive]}>Calendar</Text>
          <View style={styles.navbarActiveBar} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 10,
  },
  monthBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.card,
  },
  monthBtnIcon: { fontSize: 22 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateMain: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 15,
    color: COLORS.textMain, textAlign: 'center',
  },
  todayBadge: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: COLORS.white,
    backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginTop: 3, letterSpacing: 1,
  },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10, gap: 8,
  },
  navBtn: {
    backgroundColor: COLORS.white, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 10, ...SHADOWS.card,
  },
  navBtnText: { fontFamily: 'Inter_800ExtraBold', fontSize: 13, color: COLORS.primaryDark },
  todayBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 10, ...SHADOWS.btn,
  },
  todayBtnText: { fontFamily: 'Inter_800ExtraBold', fontSize: 13, color: COLORS.white },
  loaderWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },
  orderCard: {
    backgroundColor: COLORS.white, borderRadius: 14, ...SHADOWS.card,
    padding: 12, flexDirection: 'row', gap: 14, marginBottom: 14,
  },
  orderImage: { width: 88, height: 104, borderRadius: 12 },
  orderImagePlaceholder: {
    width: 88, height: 104, borderRadius: 12,
    backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  orderInfo: { flex: 1, justifyContent: 'center', gap: 3 },
  orderName: { fontFamily: 'Inter_800ExtraBold', fontSize: 15, color: COLORS.textMain },
  orderSerial: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.textSub },
  orderPhone: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.textSub },
  orderDate: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: {
    backgroundColor: COLORS.primary, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
    marginTop: 4, ...SHADOWS.btn,
  },
  statusBadgeText: { fontFamily: 'Inter_800ExtraBold', fontSize: 9, color: COLORS.white },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 17, color: COLORS.textMain, marginBottom: 6 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  navbar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: '#f0ebe6', height: 85, paddingBottom: 20, ...SHADOWS.card,
  },
  navbarTab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    position: 'relative', paddingBottom: 8,
  },
  navbarIcon: { fontSize: 22, marginBottom: 2 },
  navbarLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textMuted },
  navbarLabelActive: { fontFamily: 'Inter_800ExtraBold', color: COLORS.primaryDark },
  navbarActiveBar: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 3, borderRadius: 2, backgroundColor: COLORS.primary,
  },
});
