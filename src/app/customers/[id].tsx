import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Droplets,
  Edit3,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Wrench,
} from 'lucide-react-native';

import { ActionButton, Badge, Card, CustomerMapCard } from '@/components/ui';
import { BottomTabInset, Radii, Shadows } from '@/constants/theme';
import {
  calculateNextServiceDate,
  formatDate,
  getCustomerById,
  getServicesByCustomerId,
  TODAY,
} from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import { Customer, Service } from '@/types';

export default function CustomerDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [customer, setCustomer] = useState<Customer | undefined>(() =>
    id ? getCustomerById(id) : undefined
  );
  const [services, setServices] = useState<Service[]>(() =>
    id ? getServicesByCustomerId(id) : []
  );

  // Refresh customer info & services on screen focus
  useFocusEffect(
    useCallback(() => {
      if (id) {
        setCustomer(getCustomerById(id));
        const customerServices = getServicesByCustomerId(id);
        // Sort newest first
        setServices(
          [...customerServices].sort(
            (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
          )
        );
      }
    }, [id])
  );

  const handleCall = () => {
    if (!customer?.phone) return;
    const cleanPhone = customer.phone.replace(/\D/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Notice', 'Unable to initiate call on this device.');
    });
  };

  const handleWhatsApp = () => {
    if (!customer?.phone) return;
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91')
      ? cleanPhone
      : `91${cleanPhone}`;
    const message = encodeURIComponent(
      `Hello ${customer.name}, greetings from Aqua Plus RO Tech! Regarding your ${customer.roBrand} ${customer.roModel} water purifier service:`
    );
    Linking.openURL(`https://wa.me/${phoneWithCountry}?text=${message}`).catch(() => {
      Alert.alert('Notice', 'Unable to launch WhatsApp on this device.');
    });
  };

  const handleEdit = () => {
    if (!customer) return;
    router.push({
      pathname: '/customers/edit',
      params: { id: customer.id },
    });
  };

  const handleRecordService = () => {
    if (!customer) return;
    router.push({
      pathname: '/services/add',
      params: { customerId: customer.id },
    });
  };

  if (!customer) {
    return (
      <View
        style={[
          styles.screenContainer,
          {
            backgroundColor: theme.background,
            paddingTop: Math.max(insets.top, 20),
          },
        ]}
      >
        <View style={styles.notFoundContainer}>
          <AlertCircle size={40} color={theme.warning} strokeWidth={2} />
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>Customer Not Found</Text>
          <Text style={[styles.notFoundSub, { color: theme.textSecondary }]}>
            The customer record could not be loaded or may have been removed.
          </Text>
          <ActionButton
            title="Go Back"
            variant="primary"
            onPress={() => router.back()}
            style={styles.notFoundButton}
          />
        </View>
      </View>
    );
  }

  const latestService = services[0];
  const nextDueDate = latestService
    ? latestService.nextServiceDate
    : calculateNextServiceDate(customer.installDate, 90);

  const isDueOrOverdue = nextDueDate <= TODAY;

  const getPaymentVariant = (status: Service['paymentStatus']) => {
    switch (status) {
      case 'Paid':
        return 'success';
      case 'Pending':
        return 'danger';
      case 'Partial':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.background }]}>
      {/* Top App Bar */}
      <View
        style={[
          styles.topAppBar,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: '#FFFFFF',
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          accessibilityLabel="Go Back"
        >
          <ArrowLeft size={20} color={theme.text} strokeWidth={2.2} />
        </Pressable>

        <Text style={[styles.appBarTitle, { color: theme.text }]}>Client Profile</Text>

        <Pressable
          onPress={handleEdit}
          style={styles.editShortcutBtn}
          hitSlop={10}
          accessibilityLabel="Edit Customer"
        >
          <Edit3 size={18} color={theme.primary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: BottomTabInset + insets.bottom + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Identity Card */}
        <Card style={styles.profileCard} variant="default">
          <View style={styles.profileHero}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {customer.name.charAt(0)}
              </Text>
            </View>
            <View style={styles.profileHeroText}>
              <Text style={[styles.profileName, { color: theme.text }]}>
                {customer.name}
              </Text>
              <View style={styles.phoneChip}>
                <Phone size={12} color="#0369A1" strokeWidth={2} style={styles.phoneChipIcon} />
                <Text style={[styles.phoneChipText, { color: '#0369A1' }]}>
                  +91 {customer.phone}
                </Text>
              </View>
            </View>
          </View>

          {/* Machine & Warranty Tag */}
          <View style={[styles.machineSection, { backgroundColor: '#ECFEFF' }]}>
            <View style={styles.machineRow}>
              <View style={styles.machineIconBubble}>
                <Droplets size={16} color="#0891B2" strokeWidth={2.2} />
              </View>
              <View style={styles.machineDetailText}>
                <Text style={[styles.machineName, { color: theme.text }]}>
                  {customer.roBrand} {customer.roModel}
                </Text>
                <Text style={[styles.installedOnText, { color: theme.textSecondary }]}>
                  Installed on {formatDate(customer.installDate)}
                </Text>
              </View>
            </View>
          </View>

          {/* Address Line */}
          <View style={styles.addressSection}>
            <MapPin size={14} color={theme.textSecondary} strokeWidth={2} style={styles.addressPin} />
            <Text style={[styles.addressFull, { color: theme.textSecondary }]}>
              {customer.address}
            </Text>
          </View>

          {/* Customer Notes */}
          {customer.notes ? (
            <View style={styles.notesBox}>
              <FileText size={13} color="#0891B2" strokeWidth={2} style={styles.notesIcon} />
              <Text style={styles.notesContent}>
                {customer.notes}
              </Text>
            </View>
          ) : null}

          {/* Quick Contact Actions Row */}
          <View style={styles.actionButtonGroup}>
            <View style={styles.actionButtonCol}>
              <ActionButton
                title="Call Client"
                variant="outline"
                icon={<Phone size={14} color={theme.primary} strokeWidth={2.2} />}
                onPress={handleCall}
                fullWidth
                size="sm"
              />
            </View>
            <View style={styles.actionButtonCol}>
              <ActionButton
                title="WhatsApp"
                variant="secondary"
                icon={<MessageCircle size={14} color="#FFFFFF" strokeWidth={2.2} />}
                onPress={handleWhatsApp}
                fullWidth
                size="sm"
              />
            </View>
          </View>
        </Card>

        {/* Customer Location & Service Route Map */}
        <CustomerMapCard customer={customer} />

        {/* Maintenance Status Overview */}
        <Card style={styles.maintenanceCard} variant="default">
          <View style={styles.maintenanceHeader}>
            <View style={styles.maintHeaderLeft}>
              <ShieldCheck size={18} color={theme.primary} strokeWidth={2.2} style={styles.maintIcon} />
              <Text style={[styles.maintTitle, { color: theme.text }]}>Service Status</Text>
            </View>
            <Badge
              label={isDueOrOverdue ? 'Maintenance Due' : 'Protected'}
              variant={isDueOrOverdue ? 'danger' : 'success'}
              size="sm"
            />
          </View>

          <View style={styles.maintDatesGrid}>
            <View style={styles.maintDateCol}>
              <Text style={[styles.maintDateLabel, { color: theme.textSecondary }]}>Last Service</Text>
              <Text style={[styles.maintDateValue, { color: theme.text }]}>
                {latestService ? formatDate(latestService.serviceDate) : formatDate(customer.installDate)}
              </Text>
            </View>

            <View style={styles.maintDivider} />

            <View style={styles.maintDateCol}>
              <Text style={[styles.maintDateLabel, { color: theme.textSecondary }]}>Next Due Date</Text>
              <Text
                style={[
                  styles.maintDateValue,
                  { color: isDueOrOverdue ? theme.danger : '#0369A1' },
                ]}
              >
                {formatDate(nextDueDate)}
              </Text>
            </View>
          </View>

          {/* Record Service Shortcut Button */}
          <ActionButton
            title="+ Record New Service"
            variant="primary"
            icon={<Wrench size={15} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={handleRecordService}
            fullWidth
            size="md"
            style={styles.recordNewBtn}
          />
        </Card>

        {/* Service History Timeline Section */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: theme.text }]}>
              Service History Timeline
            </Text>
            <View style={[styles.historyCountPill, { backgroundColor: '#E0F2FE' }]}>
              <Text style={[styles.historyCountText, { color: '#0369A1' }]}>
                {services.length} recorded
              </Text>
            </View>
          </View>

          {services.length === 0 ? (
            <Card style={styles.emptyHistoryCard} variant="default">
              <Text style={[styles.emptyHistoryTitle, { color: theme.text }]}>
                No Service History
              </Text>
              <Text style={[styles.emptyHistorySub, { color: theme.textSecondary }]}>
                No service visits have been logged for this customer yet.
              </Text>
            </Card>
          ) : (
            services.map((service, index) => {
              const isFirst = index === 0;
              const isLast = index === services.length - 1;

              return (
                <View key={service.id} style={styles.timelineRow}>
                  {/* Timeline track with dot */}
                  <View style={styles.trackCol}>
                    <View
                      style={[
                        styles.trackDot,
                        {
                          backgroundColor: isFirst ? theme.primary : theme.textSecondary,
                          borderColor: isFirst ? '#E0F2FE' : '#FFFFFF',
                        },
                      ]}
                    >
                      {isFirst ? <View style={styles.innerActiveDot} /> : null}
                    </View>
                    {!isLast && <View style={styles.trackLine} />}
                  </View>

                  {/* Timeline Entry Card */}
                  <Card style={styles.timelineCard} variant="default">
                    <View style={styles.timelineCardTop}>
                      <View style={styles.timelineTypeRow}>
                        <Text style={[styles.timelineServiceType, { color: theme.text }]}>
                          {service.serviceType}
                        </Text>
                        <Badge
                          label={service.paymentStatus}
                          variant={getPaymentVariant(service.paymentStatus)}
                          size="xs"
                        />
                      </View>
                      <Text style={[styles.timelineCharge, { color: '#0E7490' }]}>
                        {service.serviceCharge > 0 ? `₹${service.serviceCharge.toLocaleString('en-IN')}` : 'Free / AMC'}
                      </Text>
                    </View>

                    <View style={styles.timelineDateRow}>
                      <Calendar size={12} color={theme.textSecondary} strokeWidth={2} style={styles.calIcon} />
                      <Text style={[styles.timelineDateText, { color: theme.textSecondary }]}>
                        {formatDate(service.serviceDate)}
                      </Text>
                    </View>

                    {/* Work details */}
                    <Text style={[styles.workPerformedText, { color: theme.text }]}>
                      {service.workPerformed}
                    </Text>

                    {service.partsReplaced && service.partsReplaced !== 'None' ? (
                      <View style={styles.partsBox}>
                        <Text style={[styles.partsLabel, { color: theme.textSecondary }]}>
                          Parts Replaced:
                        </Text>
                        <Text style={[styles.partsValue, { color: theme.text }]}>
                          {service.partsReplaced}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  editShortcutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileCard: {
    padding: 16,
    borderRadius: Radii.lg,
    marginBottom: 14,
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    ...Shadows.sm,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  profileHeroText: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  phoneChipIcon: {
    marginRight: 4,
  },
  phoneChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  machineSection: {
    padding: 12,
    borderRadius: Radii.md,
    marginBottom: 12,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  machineIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  machineDetailText: {
    flex: 1,
  },
  machineName: {
    fontSize: 14,
    fontWeight: '700',
  },
  installedOnText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressPin: {
    marginRight: 6,
    marginTop: 2,
  },
  addressFull: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: Radii.sm,
    marginBottom: 14,
  },
  notesIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  notesContent: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 16,
    fontWeight: '500',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButtonCol: {
    flex: 1,
  },
  maintenanceCard: {
    padding: 16,
    borderRadius: Radii.lg,
    marginBottom: 16,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  maintHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maintIcon: {
    marginRight: 6,
  },
  maintTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  maintDatesGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: Radii.md,
    marginBottom: 14,
  },
  maintDateCol: {
    flex: 1,
    alignItems: 'center',
  },
  maintDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  maintDateValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  maintDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  recordNewBtn: {
    marginTop: 2,
  },
  historySection: {
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  historyCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  historyCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  trackCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  trackDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  innerActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  trackLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    padding: 14,
    borderRadius: Radii.md,
  },
  timelineCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineServiceType: {
    fontSize: 15,
    fontWeight: '700',
  },
  timelineCharge: {
    fontSize: 14,
    fontWeight: '800',
  },
  timelineDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calIcon: {
    marginRight: 4,
  },
  timelineDateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  workPerformedText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  partsBox: {
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: Radii.sm,
    marginTop: 4,
  },
  partsLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  partsValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHistoryCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyHistorySub: {
    fontSize: 13,
    textAlign: 'center',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  notFoundSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  notFoundButton: {
    minWidth: 140,
  },
});
