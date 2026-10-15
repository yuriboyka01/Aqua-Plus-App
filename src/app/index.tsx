import React, { useMemo } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  MessageCircle,
  Navigation,
  Phone,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react-native';

import { ActionButton, Badge, Card, StatCard, WaterWavesDecor } from '@/components/ui';
import { BottomTabInset, Gradients, Radii, Shadows } from '@/constants/theme';
import {
  defaultSettings,
  formatDate,
  sampleCustomers,
  sampleDashboardStats,
  sampleReminders,
  sampleServices,
  TODAY,
} from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import { ServiceType } from '@/types';
import { openRouteDirections } from '@/utils/map-utils';

export default function HomeDashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Upcoming service appointments in next 7 days
  const upcomingServices = useMemo(() => {
    const list = sampleReminders
      .filter((r) => r.daysUntilDue >= 0 && r.daysUntilDue <= 7)
      .map((r) => {
        const customer = sampleCustomers.find((c) => c.id === r.customerId);
        const lastService = sampleServices.find((s) => s.customerId === r.customerId);
        return {
          id: r.id,
          customerId: r.customerId,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          roModel: customer ? `${customer.roBrand} ${customer.roModel}` : 'RO Purifier',
          serviceType: (lastService?.serviceType ?? 'Maintenance') as ServiceType,
          date: r.nextServiceDate,
          daysUntilDue: r.daysUntilDue,
          isToday: r.daysUntilDue === 0,
        };
      });

    if (list.length === 0) {
      return sampleReminders.slice(0, 3).map((r) => {
        const customer = sampleCustomers.find((c) => c.id === r.customerId);
        const lastService = sampleServices.find((s) => s.customerId === r.customerId);
        return {
          id: r.id,
          customerId: r.customerId,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          roModel: customer ? `${customer.roBrand} ${customer.roModel}` : 'RO Purifier',
          serviceType: (lastService?.serviceType ?? 'Maintenance') as ServiceType,
          date: r.nextServiceDate,
          daysUntilDue: r.daysUntilDue,
          isToday: r.daysUntilDue === 0,
        };
      });
    }

    return list;
  }, []);

  // Last 5 completed services
  const recentServices = useMemo(() => {
    return [...sampleServices]
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
      .slice(0, 5);
  }, []);

  // Formatted date string for today
  const formattedToday = useMemo(() => {
    const [year, month, day] = TODAY.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Notice', 'Unable to place call on this device.');
    });
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const text = encodeURIComponent(
      `Hello ${name}, greetings from Aqua Plus RO Tech! We are reaching out regarding your water purifier service schedule.`
    );
    Linking.openURL(`https://wa.me/${fullPhone}?text=${text}`).catch(() => {
      Alert.alert('Notice', 'Unable to launch WhatsApp on this device.');
    });
  };

  const getServiceTypeBadge = (type: ServiceType) => {
    switch (type) {
      case 'Installation':
        return <Badge label={type} variant="info" size="xs" />;
      case 'Maintenance':
        return <Badge label={type} variant="aqua" size="xs" />;
      case 'Repair':
        return <Badge label={type} variant="danger" size="xs" />;
      case 'Filter Change':
        return <Badge label={type} variant="blue" size="xs" />;
      case 'AMC Service':
        return <Badge label={type} variant="info" size="xs" />;
      default:
        return <Badge label={type} variant="default" size="xs" />;
    }
  };

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: BottomTabInset + insets.bottom + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Location Pill */}
        <View style={styles.topLocationBar}>
          <View style={styles.locationPill}>
            <View style={styles.liveIndicator} />
            <Text style={styles.locationPillText}>
              Thirunagar, Madurai · Aqua Plus RO Tech Service Hub
            </Text>
          </View>
        </View>

        {/* Deep Ocean-Blue Gradient Hero Card (ONLY hero uses ocean blue gradient) */}
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <WaterWavesDecor width={320} height={130} opacity={0.22} />

          {/* Hero Top Identity */}
          <View style={styles.heroTopRow}>
            <View style={styles.brandBadge}>
              <View style={styles.brandIconBubble}>
                <Droplets size={16} color="#06B6D4" strokeWidth={2.5} />
              </View>
              <Text style={styles.brandText}>{defaultSettings.businessName}</Text>
            </View>

            <View style={styles.dateChip}>
              <Calendar size={13} color="#06B6D4" strokeWidth={2} style={styles.dateIcon} />
              <Text style={styles.dateChipText}>{formattedToday}</Text>
            </View>
          </View>

          {/* Welcome Message */}
          <View style={styles.heroMiddleSection}>
            <Text style={styles.heroGreeting}>
              Welcome back, {defaultSettings.ownerName}
            </Text>
            <Text style={styles.heroSubtext}>
              Madurai&apos;s trusted RO sales, installation & expert maintenance center.
            </Text>
          </View>

          {/* Operational Pulse Activity Indicator */}
          <View style={styles.heroPulseCard}>
            <View style={styles.pulseDotWrapper}>
              <View style={styles.pulseDot} />
              <View style={styles.pulseDotRing} />
            </View>
            <View style={styles.pulseTextContainer}>
              <Text style={styles.pulseTitle}>
                {sampleDashboardStats.dueToday + sampleDashboardStats.overdue} Service Action Items Today
              </Text>
              <Text style={styles.pulseSub}>
                {sampleDashboardStats.completedToday} jobs completed today · {sampleDashboardStats.overdue} overdue visits
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions Row */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.actionCol}>
            <ActionButton
              title="Add Customer"
              variant="primary"
              icon={<UserPlus size={16} color="#FFFFFF" strokeWidth={2.2} />}
              onPress={() => router.push('/customers/add' as any)}
              fullWidth
              size="md"
            />
          </View>
          <View style={styles.actionCol}>
            <ActionButton
              title="Record Service"
              variant="secondary"
              icon={<Wrench size={16} color="#FFFFFF" strokeWidth={2.2} />}
              onPress={() => router.push('/services/add' as any)}
              fullWidth
              size="md"
            />
          </View>
        </View>

        {/* Statistics Grid (Clean White Cards, No Green Backgrounds) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Service Overview</Text>
            <Pressable onPress={() => router.push('/services' as any)} hitSlop={8}>
              <Text style={[styles.sectionActionText, { color: theme.primary }]}>View Reports</Text>
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="Total Clients"
                value={sampleDashboardStats.totalCustomers}
                icon={<Users size={18} color="#0891B2" strokeWidth={2.2} />}
                accentColor="#0891B2"
                gradientColors={Gradients.statCyan}
                subtitle="Active"
                onPress={() => router.push('/customers' as any)}
                style={styles.statLeft}
              />
              <StatCard
                title="Completed Today"
                value={sampleDashboardStats.completedToday}
                icon={<CheckCircle2 size={18} color="#0369A1" strokeWidth={2.2} />}
                accentColor="#0369A1"
                gradientColors={Gradients.statBlue}
                subtitle="Done"
                onPress={() => router.push('/services' as any)}
              />
            </View>

            <View style={styles.statsRow}>
              <StatCard
                title="Due Today"
                value={sampleDashboardStats.dueToday}
                icon={<Clock size={18} color="#D97706" strokeWidth={2.2} />}
                accentColor="#D97706"
                gradientColors={Gradients.statAmber}
                subtitle="Priority"
                onPress={() => router.push('/reminders' as any)}
                style={styles.statLeft}
              />
              <StatCard
                title="Overdue Visits"
                value={sampleDashboardStats.overdue}
                icon={<AlertTriangle size={18} color="#DC2626" strokeWidth={2.2} />}
                accentColor="#DC2626"
                gradientColors={Gradients.statRed}
                subtitle="Action"
                onPress={() => router.push('/reminders' as any)}
              />
            </View>
          </View>
        </View>

        {/* Upcoming Visits Section (Clean White Cards with Refined Borders) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWithCount}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Visits</Text>
              <View style={[styles.counterPill, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.counterPillText, { color: '#0369A1' }]}>
                  {upcomingServices.length}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push('/reminders' as any)}
              hitSlop={8}
              style={styles.viewAllRow}
            >
              <Text style={[styles.sectionActionText, { color: theme.primary }]}>View All</Text>
              <ArrowRight size={14} color={theme.primary} strokeWidth={2.2} style={styles.arrowIcon} />
            </Pressable>
          </View>

          {upcomingServices.map((item) => (
            <Card key={item.id} style={styles.appointmentCard} variant="default">
              <View style={styles.appointmentMain}>
                <View style={styles.customerAvatarMini}>
                  <Text style={styles.customerInitial}>
                    {item.customerName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.appointmentDetails}>
                  <Text style={[styles.customerNameText, { color: theme.text }]} numberOfLines={1}>
                    {item.customerName}
                  </Text>
                  <Text style={[styles.machineModelText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.roModel}
                  </Text>
                  <View style={styles.appointmentBadgeRow}>
                    {getServiceTypeBadge(item.serviceType)}
                    {item.isToday ? (
                      <Badge label="Due Today" variant="warning" size="xs" />
                    ) : (
                      <View style={styles.dateSubChip}>
                        <Calendar size={11} color={theme.textSecondary} strokeWidth={2} style={styles.miniIcon} />
                        <Text style={[styles.dateSubText, { color: theme.textSecondary }]}>
                          {formatDate(item.date)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Quick Contact & Navigation Actions */}
                <View style={styles.contactActionsCol}>
                  <Pressable
                    onPress={() => {
                      const customer = sampleCustomers.find((c) => c.id === item.customerId);
                      if (customer) {
                        openRouteDirections(customer.address, customer.latitude, customer.longitude).catch(() => {});
                      }
                    }}
                    style={[styles.miniCircleBtn, { backgroundColor: '#ECFEFF', borderColor: 'rgba(8, 145, 178, 0.3)' }]}
                    hitSlop={6}
                    accessibilityLabel="Navigate route"
                  >
                    <Navigation size={13} color="#0891B2" strokeWidth={2.4} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleCall(item.customerPhone)}
                    style={[styles.miniCircleBtn, { backgroundColor: '#F0F9FF', borderColor: 'rgba(3, 105, 161, 0.2)' }]}
                    hitSlop={6}
                    accessibilityLabel="Call customer"
                  >
                    <Phone size={14} color="#0369A1" strokeWidth={2.2} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleWhatsApp(item.customerPhone, item.customerName)}
                    style={[styles.miniCircleBtn, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                    hitSlop={6}
                    accessibilityLabel="WhatsApp customer"
                  >
                    <MessageCircle size={14} color="#0E7490" strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Recent Activity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Service Activity</Text>
            <Pressable
              onPress={() => router.push('/services' as any)}
              hitSlop={8}
              style={styles.viewAllRow}
            >
              <Text style={[styles.sectionActionText, { color: theme.primary }]}>All Services</Text>
              <ArrowRight size={14} color={theme.primary} strokeWidth={2.2} style={styles.arrowIcon} />
            </Pressable>
          </View>

          {recentServices.map((service) => (
            <Card key={service.id} style={styles.recentActivityCard} variant="default">
              <View style={styles.recentTop}>
                <View style={styles.recentInfo}>
                  <Text style={[styles.recentCustomer, { color: theme.text }]} numberOfLines={1}>
                    {service.customerName}
                  </Text>
                  <Text style={[styles.recentMachine, { color: theme.textSecondary }]}>
                    {service.roBrand} {service.roModel}
                  </Text>
                </View>
                <View style={styles.chargeContainer}>
                  <Text style={[styles.chargeAmount, { color: theme.text }]}>
                    ₹{service.serviceCharge.toLocaleString('en-IN')}
                  </Text>
                  <Badge
                    label={service.paymentStatus}
                    variant={service.paymentStatus === 'Paid' ? 'success' : service.paymentStatus === 'Pending' ? 'danger' : 'warning'}
                    size="xs"
                  />
                </View>
              </View>

              <View style={styles.recentBottomDivider} />

              <View style={styles.recentBottom}>
                <View style={styles.typeBadgeRow}>
                  {getServiceTypeBadge(service.serviceType)}
                  <Text style={[styles.recentDateText, { color: theme.textSecondary }]}>
                    {formatDate(service.serviceDate)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push(`/customers/${service.customerId}` as any)}
                  style={styles.viewClientLink}
                >
                  <Text style={[styles.viewClientText, { color: theme.primary }]}>Client Profile</Text>
                  <ChevronRight size={13} color={theme.primary} strokeWidth={2.2} />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  topLocationBar: {
    alignItems: 'center',
    marginBottom: 10,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(8, 145, 178, 0.2)',
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0891B2',
    marginRight: 6,
  },
  locationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
    letterSpacing: 0.1,
  },
  heroCard: {
    borderRadius: Radii.xl,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.hero,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  brandIconBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  dateIcon: {
    marginRight: 5,
  },
  dateChipText: {
    color: '#CFFAFE',
    fontSize: 12,
    fontWeight: '600',
  },
  heroMiddleSection: {
    marginBottom: 16,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSubtext: {
    color: '#BAE6FD',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  heroPulseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  pulseDotWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06B6D4',
  },
  pulseDotRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.6)',
  },
  pulseTextContainer: {
    flex: 1,
  },
  pulseTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
  },
  pulseSub: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '400',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCol: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWithCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  counterPill: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  counterPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    marginLeft: 3,
  },
  statsGrid: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statLeft: {
    marginRight: 12,
  },
  appointmentCard: {
    marginBottom: 10,
    padding: 14,
    borderRadius: Radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  appointmentMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(8, 145, 178, 0.25)',
  },
  customerInitial: {
    color: '#0369A1',
    fontSize: 17,
    fontWeight: '800',
  },
  appointmentDetails: {
    flex: 1,
    marginRight: 8,
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  machineModelText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  appointmentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateSubChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniIcon: {
    marginRight: 4,
  },
  dateSubText: {
    fontSize: 11,
    fontWeight: '500',
  },
  contactActionsCol: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  miniCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  recentActivityCard: {
    marginBottom: 10,
    padding: 14,
    borderRadius: Radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recentInfo: {
    flex: 1,
    marginRight: 10,
  },
  recentCustomer: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  recentMachine: {
    fontSize: 12,
    fontWeight: '500',
  },
  chargeContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chargeAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  recentBottomDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  recentBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentDateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewClientLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewClientText: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 2,
  },
});
