import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Search,
  Wrench,
} from 'lucide-react-native';

import { ActionButton, Badge, Card, SearchBar } from '@/components/ui';
import { BottomTabInset, Radii, Shadows } from '@/constants/theme';
import { formatDate, sampleServices } from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import { PaymentStatus, ServiceType } from '@/types';

type StatusFilter = 'All' | 'Completed' | 'Pending' | 'Maintenance' | 'Filter Change' | 'Repair';

const FILTER_PILLS: StatusFilter[] = [
  'All',
  'Completed',
  'Pending',
  'Maintenance',
  'Filter Change',
  'Repair',
];

export default function ServicesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>('All');

  // Filtered services
  const filteredServices = useMemo(() => {
    return sampleServices.filter((service) => {
      // Status & type filtering
      let matchesFilter = true;
      if (selectedFilter === 'Completed') {
        matchesFilter = service.paymentStatus === 'Paid';
      } else if (selectedFilter === 'Pending') {
        matchesFilter = service.paymentStatus === 'Pending' || service.paymentStatus === 'Partial';
      } else if (selectedFilter !== 'All') {
        matchesFilter = service.serviceType === selectedFilter;
      }

      if (!matchesFilter) return false;

      // Query search match
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        service.customerName.toLowerCase().includes(query) ||
        service.serviceType.toLowerCase().includes(query) ||
        service.roBrand.toLowerCase().includes(query) ||
        service.roModel.toLowerCase().includes(query) ||
        service.workPerformed.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, selectedFilter]);

  // Aggregate statistics
  const totalAmount = useMemo(() => {
    return filteredServices.reduce((sum, s) => sum + s.serviceCharge, 0);
  }, [filteredServices]);

  const getServiceTypeBadge = (type: ServiceType) => {
    switch (type) {
      case 'Installation':
        return <Badge label={type} variant="info" size="xs" />;
      case 'Maintenance':
        return <Badge label={type} variant="aqua" size="xs" />;
      case 'Repair':
        return <Badge label={type} variant="danger" size="xs" />;
      case 'Filter Change':
        return <Badge label={type} variant="warning" size="xs" />;
      case 'AMC Service':
        return <Badge label={type} variant="success" size="xs" />;
      default:
        return <Badge label={type} variant="default" size="xs" />;
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return <Badge label="Paid" variant="success" size="xs" />;
      case 'Pending':
        return <Badge label="Payment Pending" variant="danger" size="xs" />;
      case 'Partial':
        return <Badge label="Partial Payment" variant="warning" size="xs" />;
      default:
        return <Badge label={status} variant="default" size="xs" />;
    }
  };

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
              <Text style={[styles.screenTitle, { color: theme.text }]}>Service Log</Text>
              <View style={[styles.countBadge, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.countBadgeText, { color: '#0369A1' }]}>
                  {filteredServices.length}
                </Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Installation, Filter & Repair Dispatch Records
            </Text>
          </View>

          {/* Prominent Header Action (Non-overlapping) */}
          <Pressable
            onPress={() => router.push('/services/add' as any)}
            style={[styles.headerAddBtn, { backgroundColor: theme.primary }]}
            hitSlop={8}
            accessibilityLabel="Record Service Visit"
            accessibilityRole="button"
          >
            <Wrench size={15} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.headerAddBtnText}>Record Service</Text>
          </Pressable>
        </View>

        {/* Search */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by client, machine, or work..."
          style={styles.searchBar}
          onClear={() => setSearchQuery('')}
        />

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {FILTER_PILLS.map((pill) => {
            const isSelected = selectedFilter === pill;
            return (
              <Pressable
                key={pill}
                onPress={() => setSelectedFilter(pill)}
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
                  {pill}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Aggregate Revenue Banner */}
      <View style={styles.revenueBanner}>
        <View style={styles.revenueLeft}>
          <Text style={[styles.revenueLabel, { color: theme.textSecondary }]}>
            Filtered Revenue Volume
          </Text>
          <Text style={[styles.revenueValue, { color: theme.text }]}>
            ₹{totalAmount.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={[styles.revenueRightBadge, { backgroundColor: '#ECFEFF' }]}>
          <CheckCircle2 size={13} color="#0E7490" strokeWidth={2.2} style={styles.checkIcon} />
          <Text style={[styles.revenueRightText, { color: '#0E7490' }]}>
            {filteredServices.length} jobs matched
          </Text>
        </View>
      </View>

      {/* Service Entries List */}
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
        {filteredServices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Search size={28} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No service logs found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery
                ? `No service visits match "${searchQuery}". Try adjusting your filters.`
                : 'No services match this filter category.'}
            </Text>
            <ActionButton
              title="Reset Filters"
              variant="outline"
              size="sm"
              onPress={() => {
                setSearchQuery('');
                setSelectedFilter('All');
              }}
              style={styles.emptyActionBtn}
            />
          </View>
        ) : (
          filteredServices.map((service) => (
            <Card key={service.id} style={styles.serviceCard} variant="default">
              {/* Top Row: Customer & Charge */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerInfoCol}>
                  <Text style={[styles.customerName, { color: theme.text }]} numberOfLines={1}>
                    {service.customerName}
                  </Text>
                  <View style={styles.machineRow}>
                    <Droplets size={12} color={theme.primary} strokeWidth={2} style={styles.dropletIcon} />
                    <Text style={[styles.machineText, { color: theme.textSecondary }]} numberOfLines={1}>
                      {service.roBrand} {service.roModel}
                    </Text>
                  </View>
                </View>

                <View style={styles.chargeBadgeGroup}>
                  <Text style={[styles.chargeText, { color: '#0E7490' }]}>
                    {service.serviceCharge > 0 ? `₹${service.serviceCharge.toLocaleString('en-IN')}` : 'Free / AMC'}
                  </Text>
                  {getPaymentStatusBadge(service.paymentStatus)}
                </View>
              </View>

              {/* Work Snippet */}
              <View style={styles.workBox}>
                <Text style={[styles.workText, { color: theme.text }]}>
                  {service.workPerformed}
                </Text>
                {service.partsReplaced && service.partsReplaced !== 'None' ? (
                  <Text style={[styles.partsText, { color: theme.textSecondary }]}>
                    Parts: {service.partsReplaced}
                  </Text>
                ) : null}
              </View>

              {/* Bottom Details Row */}
              <View style={styles.cardBottomRow}>
                <View style={styles.dateInfoGroup}>
                  <Calendar size={12} color={theme.textSecondary} strokeWidth={2} style={styles.dateIcon} />
                  <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                    Serviced: {formatDate(service.serviceDate)}
                  </Text>
                </View>

                <View style={styles.badgeGroup}>
                  {getServiceTypeBadge(service.serviceType)}
                  <Pressable
                    onPress={() => router.push(`/customers/${service.customerId}` as any)}
                    style={styles.detailsLink}
                  >
                    <ChevronRight size={16} color={theme.textSecondary} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
            </Card>
          ))
        )}

        {filteredServices.length > 0 && (
          <View style={styles.listFooter}>
            <ActionButton
              title="+ Record Another Service"
              variant="outline"
              icon={<Wrench size={15} color={theme.primary} strokeWidth={2.2} />}
              onPress={() => router.push('/services/add' as any)}
              size="md"
              fullWidth
            />
          </View>
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
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    ...Shadows.sm,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
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
  revenueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  revenueLeft: {},
  revenueLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  revenueValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  revenueRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  checkIcon: {
    marginRight: 4,
  },
  revenueRightText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  serviceCard: {
    padding: 14,
    borderRadius: Radii.lg,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerInfoCol: {
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
  chargeBadgeGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chargeText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  workBox: {
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: Radii.md,
    marginBottom: 10,
  },
  workText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  partsText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    marginRight: 4,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailsLink: {
    padding: 2,
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
    marginBottom: 16,
  },
  emptyActionBtn: {
    marginTop: 8,
  },
  listFooter: {
    marginTop: 10,
    marginBottom: 6,
  },
});
