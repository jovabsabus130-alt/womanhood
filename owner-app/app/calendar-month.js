import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMonthOrders } from '../src/api';
import { COLORS, SHADOWS } from '../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_WIDTH = Math.floor(SCREEN_WIDTH / 7);

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COLORS = {
  material_collected:    '#CDA595',
  cutting:               '#E8976A',
  stitching_in_progress: '#7EB8D4',
  ready_to_collect:      '#6DBF8A',
};

const STATUS_LABELS = {
  material_collected:    'Mat.',
  cutting:               'Cut',
  stitching_in_progress: 'Stitch',
  ready_to_collect:      'Ready',
};

/** Convert any date value → local 'YYYY-MM-DD' */
const toLocalKey = (dateVal) => {
  const d = new Date(dateVal);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const todayKey = () => toLocalKey(new Date());

export default function CalendarMonthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const fromDate =
    params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)
      ? params.from
      : todayKey();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const [y, m] = fromDate.split('-');
    return { year: parseInt(y, 10), month: parseInt(m, 10) };
  });

  // { 'YYYY-MM-DD': [ { _id, customerName, serialNumber, status }, ... ] }
  const [monthOrders, setMonthOrders] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch ALL non-collected orders grouped by local date for current month
  const fetchMonthOrders = useCallback(async (year, month) => {
    setLoading(true);
    try {
      const res = await getMonthOrders(year, month);
      setMonthOrders(res.data.orders || {});
    } catch (err) {
      if (err.response?.status === 401) {
        await AsyncStorage.removeItem('token');
        router.replace('/');
      }
      setMonthOrders({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthOrders(currentMonth.year, currentMonth.month);
  }, [currentMonth]);

  const goToPrev = () =>
    setCurrentMonth((p) =>
      p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 }
    );

  const goToNext = () =>
    setCurrentMonth((p) =>
      p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 }
    );

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
          goToPrev();
        } else if (dx <= -THRESHOLD) {
          goToNext();
        }
      },
    })
  ).current;

  // Build calendar grid (Monday-first)
  const buildGrid = () => {
    const { year, month } = currentMonth;
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = firstDow === 0 ? 6 : firstDow - 1; // Mon=0
    const cells = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const dayKey = (day) => {
    if (!day) return null;
    const { year, month } = currentMonth;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const today = todayKey();
  const weeks = buildGrid();

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToPrev} style={styles.arrowBtn} activeOpacity={0.7}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
        </Text>
        <TouchableOpacity onPress={goToNext} style={styles.arrowBtn} activeOpacity={0.7}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Day-of-week labels ── */}
      <View style={styles.dowRow}>
        {DAY_HEADERS.map((d, i) => (
          <View key={d} style={styles.dowCell}>
            <Text style={[styles.dowText, i === 6 && styles.dowSun]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* ── Calendar grid ── */}
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((day, di) => {
                  const key = dayKey(day);
                  const orders = key ? (monthOrders[key] || []) : [];
                  const isToday = key === today;
                  const hasOrders = orders.length > 0;

                  return (
                    <TouchableOpacity
                      key={di}
                      style={[
                        styles.cell,
                        di === 6 && styles.cellSunday,
                        isToday && styles.cellToday,
                        hasOrders && styles.cellHasOrders,
                      ]}
                      onPress={() => day && router.replace(`/calendar?date=${key}`)}
                      activeOpacity={day ? 0.75 : 1}
                      disabled={!day}
                    >
                      {day ? (
                        <>
                          {/* Day number */}
                          <View style={[styles.dayNumWrap, isToday && styles.dayNumWrapToday]}>
                            <Text style={[styles.dayNum, isToday && styles.dayNumToday, di === 6 && styles.dayNumSun]}>
                              {day}
                            </Text>
                          </View>

                          {/* Order chips — show up to 3 */}
                          {orders.slice(0, 3).map((order, oi) => (
                            <View
                              key={oi}
                              style={[styles.chip, { backgroundColor: STATUS_COLORS[order.status] || COLORS.primary }]}
                            >
                              <Text style={styles.chipText} numberOfLines={1}>
                                {order.customerName}
                              </Text>
                            </View>
                          ))}

                          {/* Overflow badge */}
                          {orders.length > 3 && (
                            <View style={styles.moreBadge}>
                              <Text style={styles.moreText}>+{orders.length - 3} more</Text>
                            </View>
                          )}
                        </>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Legend ── */}
      <View style={styles.legend}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{STATUS_LABELS[status]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 10, gap: 4,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.card, marginRight: 4,
  },
  backArrow: { fontSize: 20, color: COLORS.white, fontWeight: '800' },
  arrowBtn: { padding: 8 },
  arrowText: { fontSize: 26, color: COLORS.primaryDark, fontWeight: '800' },
  monthTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: 'Inter_800ExtraBold', fontSize: 17, color: COLORS.textMain,
  },

  // Day-of-week row
  dowRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryDark,
  },
  dowCell: {
    width: CELL_WIDTH,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dowText: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 10,
    color: COLORS.white, letterSpacing: 0.4,
  },
  dowSun: { color: '#FFB3B3' },

  // Grid
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2d8d0',
  },
  cell: {
    width: CELL_WIDTH,
    minHeight: 90,           // taller cells so content fits
    borderRightWidth: 1,
    borderRightColor: '#e2d8d0',
    paddingBottom: 6,
    backgroundColor: COLORS.white,
  },
  cellSunday: {
    borderRightWidth: 0,
    backgroundColor: '#fdf9f7',
  },
  cellToday: {
    backgroundColor: '#fff3ef',
  },
  cellHasOrders: {
    // subtle left accent for days with orders
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },

  // Day number
  dayNumWrap: {
    alignSelf: 'flex-start', marginLeft: 3, marginTop: 3, marginBottom: 2,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNumWrapToday: { backgroundColor: COLORS.primary },
  dayNum: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.textMain,
  },
  dayNumToday: {
    fontFamily: 'Inter_800ExtraBold', color: COLORS.white, fontSize: 11,
  },
  dayNumSun: { color: '#C0392B' },

  // Chips
  chip: {
    marginHorizontal: 2, marginBottom: 2,
    borderRadius: 3, paddingHorizontal: 3, paddingVertical: 2,
  },
  chipText: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 8, color: COLORS.white,
  },
  moreBadge: {
    marginHorizontal: 2, marginTop: 1,
  },
  moreText: {
    fontFamily: 'Inter_400Regular', fontSize: 8, color: COLORS.primaryDark,
  },

  // Loader
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Legend
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: '#e2d8d0',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.textSub },
});
