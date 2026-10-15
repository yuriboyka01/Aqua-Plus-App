import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Droplets,
  User,
  Wrench,
  X,
} from 'lucide-react-native';

import {
  ActionButton,
  Card,
  FormField,
  SearchBar,
  TextInputField,
} from '@/components/ui';
import { BottomTabInset, Radii } from '@/constants/theme';
import {
  calculateNextServiceDate,
  defaultSettings,
  formatDate,
  getCustomerById,
  sampleCustomers,
  sampleServices,
  TODAY,
} from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import { Customer, PaymentStatus, Service, ServiceType } from '@/types';

const SERVICE_TYPES: ServiceType[] = [
  'Maintenance',
  'Filter Change',
  'Repair',
  'Installation',
  'AMC Service',
];

const PAYMENT_STATUSES: PaymentStatus[] = ['Paid', 'Pending', 'Partial'];

export default function RecordServiceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();

  // Pre-load customer if passed as query param
  const initialCustomer = customerId ? getCustomerById(customerId) ?? null : null;

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer);
  const [serviceType, setServiceType] = useState<ServiceType>('Maintenance');
  const [roBrand, setRoBrand] = useState(initialCustomer?.roBrand ?? '');
  const [roModel, setRoModel] = useState(initialCustomer?.roModel ?? '');
  const [serviceDate, setServiceDate] = useState(TODAY);
  const [workPerformed, setWorkPerformed] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');
  const [serviceCharge, setServiceCharge] = useState('650');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [intervalDays, setIntervalDays] = useState(
    defaultSettings.defaultIntervalDays.toString()
  );

  // Modal & Search
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculated next service date
  const nextServiceDate = useMemo(() => {
    const parsedInterval = parseInt(intervalDays, 10);
    const validInterval = isNaN(parsedInterval) || parsedInterval <= 0 ? 90 : parsedInterval;
    return calculateNextServiceDate(serviceDate || TODAY, validInterval);
  }, [serviceDate, intervalDays]);

  // Filtered customer list for modal
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return sampleCustomers;
    return sampleCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.roBrand.toLowerCase().includes(q) ||
        c.roModel.toLowerCase().includes(q)
    );
  }, [customerSearchQuery]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setRoBrand(customer.roBrand);
    setRoModel(customer.roModel);
    setCustomerModalVisible(false);
    if (errors.customer) {
      setErrors((prev) => ({ ...prev, customer: '' }));
    }
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!selectedCustomer) {
      nextErrors.customer = 'Please select a customer for this service';
    }

    if (!serviceDate.trim()) {
      nextErrors.serviceDate = 'Service date is required';
    } else {
      const parts = serviceDate.trim().split('-');
      if (parts.length !== 3 || parts[0].length !== 4) {
        nextErrors.serviceDate = 'Format must be YYYY-MM-DD';
      }
    }

    if (!workPerformed.trim()) {
      nextErrors.workPerformed = 'Please describe the work performed';
    }

    const chargeNum = parseFloat(serviceCharge);
    if (isNaN(chargeNum) || chargeNum < 0) {
      nextErrors.serviceCharge = 'Enter a valid service charge (>= 0)';
    }

    const intervalNum = parseInt(intervalDays, 10);
    if (isNaN(intervalNum) || intervalNum <= 0) {
      nextErrors.intervalDays = 'Interval must be at least 1 day';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (!selectedCustomer) return;

    setIsSubmitting(true);

    const chargeNum = parseFloat(serviceCharge);
    const intervalNum = parseInt(intervalDays, 10);

    const newService: Service = {
      id: `s_${Date.now()}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      serviceType,
      roBrand: roBrand.trim() || selectedCustomer.roBrand,
      roModel: roModel.trim() || selectedCustomer.roModel,
      serviceDate: serviceDate.trim(),
      nextServiceDate,
      workPerformed: workPerformed.trim(),
      partsReplaced: partsReplaced.trim() || 'None',
      serviceCharge: isNaN(chargeNum) ? 0 : chargeNum,
      paymentStatus,
      serviceIntervalDays: isNaN(intervalNum) ? 90 : intervalNum,
      createdAt: new Date().toISOString(),
    };

    // Prepend to sample services list
    sampleServices.unshift(newService);

    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        'Service Recorded',
        `Service visit for ${selectedCustomer.name} has been saved. Next scheduled maintenance is set for ${formatDate(
          nextServiceDate
        )}.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }, 400);
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
        <Text style={[styles.appBarTitle, { color: theme.text }]}>Record Service Visit</Text>
        <View style={styles.appBarRightPlaceholder} />
      </View>

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
        {/* Step 1: Customer Selection */}
        <Card style={styles.formCard} variant="default">
          <Text style={[styles.sectionHeader, { color: theme.text }]}>
            1. Customer Assignment
          </Text>

          <FormField label="Assigned Customer" required error={errors.customer}>
            <Pressable
              onPress={() => setCustomerModalVisible(true)}
              style={[
                styles.customerSelector,
                {
                  backgroundColor: selectedCustomer ? '#ECFEFF' : '#FFFFFF',
                  borderColor: errors.customer ? theme.danger : theme.border,
                },
              ]}
            >
              {selectedCustomer ? (
                <View style={styles.selectedCustomerRow}>
                  <View style={styles.customerAvatarMini}>
                    <Text style={styles.customerAvatarInitial}>
                      {selectedCustomer.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.selectedCustomerText}>
                    <Text style={[styles.selectedName, { color: theme.text }]}>
                      {selectedCustomer.name}
                    </Text>
                    <Text style={[styles.selectedSub, { color: theme.textSecondary }]}>
                      +91 {selectedCustomer.phone} · {selectedCustomer.roBrand} {selectedCustomer.roModel}
                    </Text>
                  </View>
                  <Text style={[styles.changeLink, { color: theme.primary }]}>Change</Text>
                </View>
              ) : (
                <View style={styles.placeholderRow}>
                  <User size={16} color={theme.textSecondary} strokeWidth={2} style={styles.userIcon} />
                  <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
                    Select client from directory...
                  </Text>
                  <ChevronDown size={16} color={theme.textSecondary} strokeWidth={2} />
                </View>
              )}
            </Pressable>
          </FormField>

          {/* Step 2: Service Type */}
          <Text style={[styles.sectionHeader, { color: theme.text, marginTop: 14 }]}>
            2. Service Classification
          </Text>

          <FormField label="Service Type" required>
            <View style={styles.chipsContainer}>
              {SERVICE_TYPES.map((type) => {
                const isSelected = serviceType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setServiceType(type)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: isSelected ? theme.primary : '#F1F5F9',
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    {isSelected ? (
                      <Check size={12} color="#FFFFFF" strokeWidth={2.5} style={styles.chipCheck} />
                    ) : null}
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <View style={styles.twoColRow}>
            <View style={styles.col}>
              <TextInputField
                label="RO Brand"
                value={roBrand}
                onChangeText={setRoBrand}
                placeholder="e.g. Kent"
              />
            </View>
            <View style={styles.col}>
              <TextInputField
                label="RO Model"
                value={roModel}
                onChangeText={setRoModel}
                placeholder="e.g. Grand Plus"
              />
            </View>
          </View>

          <TextInputField
            label="Service Execution Date"
            value={serviceDate}
            onChangeText={(text) => {
              setServiceDate(text);
              if (errors.serviceDate) setErrors((prev) => ({ ...prev, serviceDate: '' }));
            }}
            error={errors.serviceDate}
            placeholder="YYYY-MM-DD"
            required
            leftIcon={<Calendar size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          {/* Step 3: Work Log */}
          <Text style={[styles.sectionHeader, { color: theme.text, marginTop: 14 }]}>
            3. Work Details & Parts
          </Text>

          <TextInputField
            label="Work Performed"
            placeholder="e.g. Replaced sediment filter and cleaned pre-carbon. Checked membrane TDS."
            value={workPerformed}
            onChangeText={(text) => {
              setWorkPerformed(text);
              if (errors.workPerformed) setErrors((prev) => ({ ...prev, workPerformed: '' }));
            }}
            error={errors.workPerformed}
            required
            multiline
            numberOfLines={3}
            leftIcon={<Wrench size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <TextInputField
            label="Parts Replaced (if any)"
            placeholder="e.g. 5 Micron Spun Filter, Carbon Block, SV Valve..."
            value={partsReplaced}
            onChangeText={setPartsReplaced}
            leftIcon={<Droplets size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          {/* Step 4: Billing & Schedule */}
          <Text style={[styles.sectionHeader, { color: theme.text, marginTop: 14 }]}>
            4. Billing & Next Schedule
          </Text>

          <View style={styles.twoColRow}>
            <View style={styles.col}>
              <TextInputField
                label="Service Charge (₹)"
                value={serviceCharge}
                onChangeText={(text) => {
                  setServiceCharge(text);
                  if (errors.serviceCharge) setErrors((prev) => ({ ...prev, serviceCharge: '' }));
                }}
                error={errors.serviceCharge}
                keyboardType="numeric"
                required
              />
            </View>

            <View style={styles.col}>
              <TextInputField
                label="Interval (Days)"
                value={intervalDays}
                onChangeText={(text) => {
                  setIntervalDays(text);
                  if (errors.intervalDays) setErrors((prev) => ({ ...prev, intervalDays: '' }));
                }}
                error={errors.intervalDays}
                keyboardType="numeric"
                required
              />
            </View>
          </View>

          {/* Payment Status Selector */}
          <FormField label="Payment Status" required>
            <View style={styles.paymentChipsRow}>
              {PAYMENT_STATUSES.map((status) => {
                const isSelected = paymentStatus === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => setPaymentStatus(status)}
                    style={[
                      styles.paymentChip,
                      {
                        backgroundColor: isSelected ? theme.primary : '#F1F5F9',
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.paymentChipText,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {status}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          {/* Next Due Auto-calculated Highlight Card */}
          <View style={[styles.nextDueCard, { backgroundColor: '#ECFEFF' }]}>
            <Clock size={18} color="#0891B2" strokeWidth={2.2} style={styles.nextDueIcon} />
            <View style={styles.nextDueTextWrapper}>
              <Text style={[styles.nextDueLabel, { color: theme.textSecondary }]}>
                Next Scheduled Maintenance Visit
              </Text>
              <Text style={[styles.nextDueValue, { color: '#0369A1' }]}>
                {formatDate(nextServiceDate)} ({intervalDays || 90} days interval)
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <ActionButton
            title="Save Service Record"
            variant="primary"
            onPress={handleSubmit}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>

      {/* Customer Selection Modal */}
      <Modal
        visible={customerModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Customer</Text>
            <Pressable
              onPress={() => setCustomerModalVisible(false)}
              style={styles.modalCloseBtn}
              hitSlop={10}
            >
              <X size={20} color={theme.text} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={styles.modalSearchWrapper}>
            <SearchBar
              value={customerSearchQuery}
              onChangeText={setCustomerSearchQuery}
              placeholder="Search by name, phone, or model..."
            />
          </View>

          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.customerListContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectCustomer(item)}
                style={({ pressed }) => [
                  styles.customerModalItem,
                  { borderBottomColor: theme.border },
                  pressed && styles.modalItemPressed,
                ]}
              >
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.modalCustomerDetails}>
                  <Text style={[styles.modalCustomerName, { color: theme.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.modalCustomerPhone, { color: theme.textSecondary }]}>
                    +91 {item.phone} · {item.roBrand} {item.roModel}
                  </Text>
                  <Text style={[styles.modalCustomerAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
                <ChevronDown size={16} color={theme.textSecondary} strokeWidth={2} style={styles.selectChevron} />
              </Pressable>
            )}
          />
        </View>
      </Modal>
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
  appBarRightPlaceholder: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  formCard: {
    padding: 18,
    borderRadius: Radii.lg,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  customerSelector: {
    borderWidth: 1.5,
    borderRadius: Radii.md,
    padding: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userIcon: {
    marginRight: 8,
  },
  placeholderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  selectedCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customerAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedCustomerText: {
    flex: 1,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
  },
  selectedSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  changeLink: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  chipCheck: {
    marginRight: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  paymentChipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextDueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radii.md,
    marginVertical: 14,
  },
  nextDueIcon: {
    marginRight: 10,
  },
  nextDueTextWrapper: {
    flex: 1,
  },
  nextDueLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  nextDueValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 6,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  customerListContent: {
    paddingHorizontal: 16,
  },
  customerModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalItemPressed: {
    opacity: 0.8,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalAvatarText: {
    color: '#0369A1',
    fontSize: 16,
    fontWeight: '800',
  },
  modalCustomerDetails: {
    flex: 1,
  },
  modalCustomerName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  modalCustomerPhone: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalCustomerAddress: {
    fontSize: 11,
    marginTop: 2,
  },
  selectChevron: {
    transform: [{ rotate: '-90deg' }],
  },
});
