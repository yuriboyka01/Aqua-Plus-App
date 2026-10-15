import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Droplets,
  MessageCircle,
  Navigation,
  Phone,
} from 'lucide-react-native';

import { Badge, Card, SearchBar } from '@/components/ui';
import { BottomTabInset, Radii } from '@/constants/theme';
import {
  formatDate,
  getCustomerById,
  sampleReminders,
} from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import { ReminderItem } from '@/types';
import { openRouteDirections } from '@/utils/map-utils';

type FilterType = 'all' | 'due_today' | 'overdue' | 'upcoming';

export default function RemindersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [reminders, setReminders] = useState<ReminderItem[]>(sampleReminders);
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => {
    return {
      all: reminders.length,
      due_today: reminders.filter((r) => r.status === 'due_today').length,
      overdue: reminders.filter((r) => r.status === 'overdue').length,
      upcoming: reminders.filter((r) => r.status === 'upcoming').length,
    };
  }, [reminders]);

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      const matchesFilter = selectedFilter === 'all' || r.status === selectedFilter;
      if (!matchesFilter) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      return (
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [reminders, selectedFilter, searchQuery]);

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Notice', `Unable to initiate phone call on this device.`);
    });
  };

  const handleWhatsApp = (item: ReminderItem) => {
    const cleanPhone = item.customerPhone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const message = encodeURIComponent(
      `Hello ${item.customerName}, this is a maintenance reminder from Aqua Plus RO Tech. Your RO water purifier is scheduled for service on ${formatDate(
        item.nextServiceDate
      )}. Please let us know a convenient time for the service technician visit.`
    );
    const url = `https://wa.me/${waPhone}?text=${message}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Could not open WhatsApp on this device.');
    });

    // Mark as sent locally
    setReminders((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, reminderSent: true } : r))
    );
  };

  const toggleSentStatus = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, reminderSent: !r.reminderSent } : r))
    );
  };

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All Reminders', count: counts.all },
    { key: 'due_today', label: 'Due Today', count: counts.due_today },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
  ];

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: Math.max(insets.top, 14),
            backgroundColor: '#FFFFFF',
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View>
            <View style={styles.headerTitleGroup}>
              <Text style={[styles.screenTitle, { color: theme.text }]}>Reminders</Text>
              <View style={[styles.countBadge, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.countBadgeText, { color: '#0369A1' }]}>
                  {counts.due_today + counts.overdue} Urgent
                </Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Scheduled Periodic Filter & Membrane Visits
            </Text>
          </View>
        </View>

        {/* Search */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filter reminders by client name..."
          style={styles.searchBar}
          onClear={() => setSearchQuery('')}
        />

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {filterTabs.map((tab) => {
            const isSelected = selectedFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setSelectedFilter(tab.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? theme.primary : '#F1F5F9',
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {tab.label} ({tab.count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Reminders List */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: BottomTabInset + insets.bottom + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredReminders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <CheckCircle2 size={30} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No pending reminders</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery
                ? `No client reminders matching "${searchQuery}".`
                : 'All customers in this category are up to date.'}
            </Text>
          </View>
        ) : (
          filteredReminders.map((item) => {
            const customer = getCustomerById(item.customerId);
            const isOverdue = item.status === 'overdue';
            const isDueToday = item.status === 'due_today';

            return (
              <Card
                key={item.id}
                style={[
                  styles.reminderCard,
                  isOverdue && styles.overdueBorder,
                ]}
                variant="default"
              >
                <View style={styles.cardTop}>
                  <View style={styles.customerInfo}>
                    <Text style={[styles.customerName, { color: theme.text }]} numberOfLines={1}>
                      {item.customerName}
                    </Text>
                    {customer ? (
                      <View style={styles.machineRow}>
                        <Droplets size={12} color={theme.primary} strokeWidth={2} style={styles.dropletIcon} />
                        <Text style={[styles.machineText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {customer.roBrand} {customer.roModel}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.statusBadgeCol}>
                    {isOverdue ? (
                      <Badge
                        label={`Overdue ${Math.abs(item.daysUntilDue)}d`}
                        variant="danger"
                        size="sm"
                      />
                    ) : isDueToday ? (
                      <Badge label="Due Today" variant="warning" size="sm" />
                    ) : (
                      <Badge
                        label={`Due in ${item.daysUntilDue}d`}
                        variant="info"
                        size="sm"
                      />
                    )}
                  </View>
                </View>

                {/* Service Schedule Details */}
                <View style={styles.datesGrid}>
                  <View style={styles.dateCol}>
                    <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
                      Last Serviced
                    </Text>
                    <Text style={[styles.dateValue, { color: theme.text }]}>
                      {formatDate(item.lastServiceDate)} ({item.daysSinceService}d ago)
                    </Text>
                  </View>

                  <View style={styles.dateCol}>
                    <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
                      Next Due Date
                    </Text>
                    <Text
                      style={[
                        styles.dateValue,
                        { color: isOverdue ? theme.danger : '#0369A1' },
                      ]}
                    >
                      {formatDate(item.nextServiceDate)}
                    </Text>
                  </View>
                </View>

                {/* Dispatch & Contact Actions */}
                <View style={styles.actionsFooterRow}>
                  {/* Sent toggle */}
                  <Pressable
                    onPress={() => toggleSentStatus(item.id)}
                    style={styles.sentToggleRow}
                    hitSlop={6}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: item.reminderSent ? theme.primary : '#FFFFFF',
                          borderColor: item.reminderSent ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      {item.reminderSent && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={[styles.sentStatusText, { color: item.reminderSent ? '#0E7490' : theme.textSecondary }]}>
                      {item.reminderSent ? 'Notice Dispatched' : 'Pending Notice'}
                    </Text>
                  </Pressable>

                  {/* Call, WhatsApp & Route Buttons */}
                  <View style={styles.buttonsGroup}>
                    {customer ? (
                      <Pressable
                        onPress={() => {
                          openRouteDirections(customer.address, customer.latitude, customer.longitude).catch(() => {});
                        }}
                        style={[styles.actionIconBtn, { backgroundColor: '#ECFEFF' }]}
                        hitSlop={8}
                        accessibilityLabel="Navigate route"
                      >
                        <Navigation size={13} color="#0891B2" strokeWidth={2.2} />
                        <Text style={[styles.btnText, { color: '#0E7490' }]}>Route</Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={() => handleCall(item.customerPhone)}
                      style={[styles.actionIconBtn, { backgroundColor: '#F0F9FF' }]}
                      hitSlop={8}
                    >
                      <Phone size={14} color="#0369A1" strokeWidth={2.2} />
                      <Text style={[styles.btnText, { color: '#0369A1' }]}>Call</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleWhatsApp(item)}
                      style={[styles.actionIconBtn, { backgroundColor: '#F1F5F9' }]}
                      hitSlop={8}
                    >
                      <MessageCircle size={14} color="#0E7490" strokeWidth={2.2} />
                      <Text style={[styles.btnText, { color: '#0E7490' }]}>WhatsApp</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => router.push(`/customers/${item.customerId}` as any)}
                      style={[styles.viewProfileBtn, { borderColor: theme.border }]}
                    >
                      <ChevronRight size={16} color={theme.textSecondary} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  searchBar: {
    marginTop: 2,
    marginBottom: 10,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  reminderCard: {
    padding: 14,
    borderRadius: Radii.lg,
    marginBottom: 10,
  },
  overdueBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customerInfo: {
    flex: 1,
    marginRight: 10,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropletIcon: {
    marginRight: 4,
  },
  machineText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadgeCol: {
    alignItems: 'flex-end',
  },
  datesGrid: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: Radii.md,
    marginBottom: 12,
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  sentStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  viewProfileBtn: {
    padding: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
});
