import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ChevronRight,
  Droplets,
  MapPin,
  Navigation,
  Phone,
  Search,
  UserPlus,
} from 'lucide-react-native';

import { ActionButton, Badge, Card, SearchBar } from '@/components/ui';
import { BottomTabInset, Radii, Shadows } from '@/constants/theme';
import { sampleCustomers, sampleServices } from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import { Customer } from '@/types';
import { openRouteDirections } from '@/utils/map-utils';

export default function CustomersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [customers, setCustomers] = useState<Customer[]>(sampleCustomers);
  const [searchQuery, setSearchQuery] = useState('');

  // Refresh customer list whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setCustomers([...sampleCustomers]);
    }, [])
  );

  // Real-time case-insensitive filter by name, phone, RO brand, or address
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) => {
      const nameMatch = customer.name.toLowerCase().includes(query);
      const phoneMatch = customer.phone.toLowerCase().includes(query);
      const brandMatch = customer.roBrand.toLowerCase().includes(query);
      const modelMatch = customer.roModel.toLowerCase().includes(query);
      const addressMatch = customer.address.toLowerCase().includes(query);
      return nameMatch || phoneMatch || brandMatch || modelMatch || addressMatch;
    });
  }, [customers, searchQuery]);

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.background }]}>
      {/* Top Header with Clean White Background & Subtle Border */}
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: theme.border,
            backgroundColor: '#FFFFFF',
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View>
            <View style={styles.headerTitleGroup}>
              <Text style={[styles.screenTitle, { color: theme.text }]}>Customers</Text>
              <View style={[styles.countBadge, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.countBadgeText, { color: '#0369A1' }]}>
                  {filteredCustomers.length}
                </Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              RO Purifier Client Directory · Madurai Territory
            </Text>
          </View>

          {/* Prominent Header Action (Non-overlapping) */}
          <Pressable
            onPress={() => router.push('/customers/add' as any)}
            style={[styles.headerAddBtn, { backgroundColor: theme.primary }]}
            hitSlop={8}
            accessibilityLabel="Add New Customer"
            accessibilityRole="button"
          >
            <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.headerAddBtnText}>Add Client</Text>
          </Pressable>
        </View>

        {/* Search Input */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filter by name, phone, or RO model..."
          style={styles.searchBar}
          onClear={() => setSearchQuery('')}
        />
      </View>

      {/* Customer Directory List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: BottomTabInset + insets.bottom + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredCustomers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Search size={28} color="#0891B2" strokeWidth={2} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No customers found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery
                ? `No clients match "${searchQuery}". Check the name or phone number.`
                : 'No customers recorded yet. Tap "+ Add Client" to create your first record.'}
            </Text>
            {searchQuery ? (
              <ActionButton
                title="Clear Search"
                variant="outline"
                size="sm"
                onPress={() => setSearchQuery('')}
                style={styles.emptyActionBtn}
              />
            ) : null}
          </View>
        ) : (
          filteredCustomers.map((customer) => {
            const customerServices = sampleServices.filter((s) => s.customerId === customer.id);
            const totalRecorded = customerServices.length;

            return (
              <Pressable
                key={customer.id}
                onPress={() => router.push(`/customers/${customer.id}` as any)}
                style={({ pressed }) => [
                  styles.cardPressable,
                  pressed && styles.cardPressed,
                ]}
              >
                <Card style={styles.customerCard} variant="default">
                  <View style={styles.cardHeaderRow}>
                    {/* Customer Initials Bubble in Ocean Blue / Sky */}
                    <View style={styles.avatarBubble}>
                      <Text style={styles.avatarLetter}>
                        {customer.name.charAt(0)}
                      </Text>
                    </View>

                    {/* Core Identity */}
                    <View style={styles.identityCol}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.customerName, { color: theme.text }]} numberOfLines={1}>
                          {customer.name}
                        </Text>
                      </View>
                      <View style={styles.phoneRow}>
                        <Phone size={12} color={theme.textSecondary} strokeWidth={2} style={styles.phoneIcon} />
                        <Text style={[styles.phoneNumber, { color: theme.textSecondary }]}>
                          +91 {customer.phone}
                        </Text>
                      </View>
                    </View>

                    <ChevronRight size={18} color={theme.textSecondary} strokeWidth={2} />
                  </View>

                  {/* Machine & Location Row */}
                  <View style={styles.machineTagRow}>
                    <View style={[styles.modelTag, { backgroundColor: '#ECFEFF' }]}>
                      <Droplets size={12} color="#0E7490" strokeWidth={2} style={styles.tagIcon} />
                      <Text style={[styles.modelTagText, { color: '#0E7490' }]}>
                        {customer.roBrand} {customer.roModel}
                      </Text>
                    </View>
                    <View style={styles.badgeGroup}>
                      {customer.area ? (
                        <View style={styles.areaMiniPill}>
                          <Text style={styles.areaMiniText}>{customer.area}</Text>
                        </View>
                      ) : null}
                      <Badge
                        label={`${totalRecorded} ${totalRecorded === 1 ? 'service' : 'services'}`}
                        variant="blue"
                        size="xs"
                      />
                    </View>
                  </View>

                  {/* Address Snippet & Quick Route Action */}
                  <View style={styles.addressAndRouteRow}>
                    <View style={styles.addressLeftCol}>
                      <MapPin size={12} color="#0891B2" strokeWidth={2} style={styles.addressIcon} />
                      <Text style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {customer.address}
                      </Text>
                    </View>

                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        openRouteDirections(customer.address, customer.latitude, customer.longitude).catch(() => {});
                      }}
                      style={styles.cardRouteBtn}
                      hitSlop={6}
                      accessibilityLabel={`Get directions to ${customer.name}`}
                    >
                      <Navigation size={11} color="#0369A1" strokeWidth={2.4} style={styles.cardRouteIcon} />
                      <Text style={styles.cardRouteText}>Route</Text>
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}

        {filteredCustomers.length > 0 && (
          <View style={styles.listFooter}>
            <ActionButton
              title="+ Add Another Client"
              variant="outline"
              icon={<UserPlus size={15} color={theme.primary} strokeWidth={2.2} />}
              onPress={() => router.push('/customers/add' as any)}
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
    paddingBottom: 14,
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  cardPressable: {
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  customerCard: {
    padding: 14,
    borderRadius: Radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(8, 145, 178, 0.25)',
  },
  avatarLetter: {
    color: '#0369A1',
    fontSize: 18,
    fontWeight: '800',
  },
  identityCol: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneIcon: {
    marginRight: 4,
  },
  phoneNumber: {
    fontSize: 13,
    fontWeight: '500',
  },
  machineTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
    maxWidth: '75%',
  },
  tagIcon: {
    marginRight: 5,
  },
  modelTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  areaMiniPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  areaMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  addressAndRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  addressLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  addressIcon: {
    marginRight: 5,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
  },
  cardRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  cardRouteIcon: {
    marginRight: 3,
  },
  cardRouteText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
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
