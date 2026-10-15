import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Droplets,
  FileText,
  MapPin,
  Navigation,
  Phone,
  User,
} from 'lucide-react-native';

import { ActionButton, Card, FormField, TextInputField } from '@/components/ui';
import { BottomTabInset, Radii } from '@/constants/theme';
import { getCustomerById, sampleCustomers, sampleServices } from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import {
  MADURAI_AREA_COORDINATES,
  MADURAI_AREAS,
  openLocationPin,
} from '@/utils/map-utils';

const COMMON_BRANDS = [
  'Kent',
  'Aquaguard',
  'Pureit',
  'LivPure',
  'AO Smith',
  'Blue Star',
  'Other',
];

export default function EditCustomerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const customer = id ? getCustomerById(id) : undefined;

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [area, setArea] = useState(customer?.area ?? 'Thirunagar');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [landmark, setLandmark] = useState(customer?.landmark ?? '');
  const [roBrand, setRoBrand] = useState(customer?.roBrand ?? 'Kent');
  const [roModel, setRoModel] = useState(customer?.roModel ?? '');
  const [installDate, setInstallDate] = useState(customer?.installDate ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');

  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    roBrand?: string;
    roModel?: string;
    installDate?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!customer) {
    return (
      <View
        style={[
          styles.keyboardView,
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
            Unable to locate customer details to edit.
          </Text>
          <ActionButton
            title="Go Back"
            variant="primary"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  const handleBrandSelect = (brand: string) => {
    if (brand === 'Other') {
      setRoBrand('');
    } else {
      setRoBrand(brand);
    }
    if (errors.roBrand) {
      setErrors((prev) => ({ ...prev, roBrand: undefined }));
    }
  };

  const validate = (): boolean => {
    const nextErrors: typeof errors = {};

    if (!name.trim()) {
      nextErrors.name = 'Customer name is required';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      nextErrors.phone = 'Phone number is required';
    } else if (cleanPhone.length !== 10) {
      nextErrors.phone = 'Enter a valid 10-digit mobile number';
    }

    if (!address.trim()) {
      nextErrors.address = 'Service location / address is required';
    }

    if (!roBrand.trim()) {
      nextErrors.roBrand = 'RO purifier brand is required';
    }

    if (!roModel.trim()) {
      nextErrors.roModel = 'RO purifier model is required';
    }

    if (!installDate.trim()) {
      nextErrors.installDate = 'Installation date is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    setIsSubmitting(true);

    const targetIndex = sampleCustomers.findIndex((c) => c.id === customer.id);
    if (targetIndex !== -1) {
      const coords = MADURAI_AREA_COORDINATES[area];
      sampleCustomers[targetIndex] = {
        ...sampleCustomers[targetIndex],
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
        address: address.trim(),
        area,
        landmark: landmark.trim(),
        latitude: coords ? coords.latitude : sampleCustomers[targetIndex].latitude,
        longitude: coords ? coords.longitude : sampleCustomers[targetIndex].longitude,
        roBrand: roBrand.trim(),
        roModel: roModel.trim(),
        installDate: installDate.trim(),
        notes: notes.trim(),
      };

      // Also sync customer name, roBrand, roModel in sampleServices
      for (const service of sampleServices) {
        if (service.customerId === customer.id) {
          service.customerName = name.trim();
          service.roBrand = roBrand.trim();
          service.roModel = roModel.trim();
        }
      }
    }

    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        'Changes Saved',
        `Client profile for ${name.trim()} has been successfully updated.`,
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
    <KeyboardAvoidingView
      style={[styles.keyboardView, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <Text style={[styles.appBarTitle, { color: theme.text }]}>Edit Client Profile</Text>
        <View style={styles.appBarRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: BottomTabInset + insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.formCard} variant="default">
          <Text style={[styles.formSectionHeader, { color: theme.text }]}>
            1. Client Identity & Contact
          </Text>

          <TextInputField
            label="Customer Full Name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
            required
            leftIcon={<User size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <TextInputField
            label="Mobile Number"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            error={errors.phone}
            required
            keyboardType="phone-pad"
            maxLength={10}
            leftIcon={<Phone size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          {/* Madurai Service Area Selection */}
          <FormField label="Madurai Area / Locality" required>
            <View style={styles.areaChipsContainer}>
              {MADURAI_AREAS.slice(0, 10).map((a) => {
                const isSelected = area === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setArea(a)}
                    style={[
                      styles.areaChip,
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
                        styles.areaChipText,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {a}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          <TextInputField
            label="Service Street Address & Door No."
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
            }}
            error={errors.address}
            required
            multiline
            numberOfLines={2}
            leftIcon={<MapPin size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <TextInputField
            label="Nearby Landmark (Optional Reference)"
            placeholder="e.g. Opposite Apollo Hospital, Near Periyar Bus Stand"
            value={landmark}
            onChangeText={setLandmark}
            leftIcon={<Navigation size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          {/* Test / Preview Pin on Google Maps */}
          {address.trim().length > 3 && (
            <Pressable
              onPress={() => {
                const coords = MADURAI_AREA_COORDINATES[area];
                openLocationPin(address, coords?.latitude, coords?.longitude).catch(() => {
                  Alert.alert('Notice', 'Unable to open Google Maps.');
                });
              }}
              style={styles.mapPreviewBtn}
            >
              <Navigation size={13} color="#0891B2" strokeWidth={2.2} style={styles.mapPreviewIcon} />
              <Text style={styles.mapPreviewText}>Preview Location on Google Maps</Text>
            </Pressable>
          )}

          <View style={styles.formDivider} />

          <Text style={[styles.formSectionHeader, { color: theme.text }]}>
            2. RO Purifier Details
          </Text>

          <FormField label="RO Purifier Brand" required error={errors.roBrand}>
            <View style={styles.brandChipsContainer}>
              {COMMON_BRANDS.map((brand) => {
                const isSelected =
                  brand === 'Other'
                    ? !COMMON_BRANDS.slice(0, -1).includes(roBrand) && roBrand !== ''
                    : roBrand === brand;

                return (
                  <Pressable
                    key={brand}
                    onPress={() => handleBrandSelect(brand)}
                    style={[
                      styles.brandChip,
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
                        styles.brandChipText,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      {brand}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>

          {(!COMMON_BRANDS.slice(0, -1).includes(roBrand) || roBrand === '') && (
            <TextInputField
              label="Specify Custom Brand"
              value={roBrand}
              onChangeText={(text) => {
                setRoBrand(text);
                if (errors.roBrand) setErrors((prev) => ({ ...prev, roBrand: undefined }));
              }}
              error={errors.roBrand}
              required
            />
          )}

          <TextInputField
            label="RO Model & Technology"
            value={roModel}
            onChangeText={(text) => {
              setRoModel(text);
              if (errors.roModel) setErrors((prev) => ({ ...prev, roModel: undefined }));
            }}
            error={errors.roModel}
            required
            leftIcon={<Droplets size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <TextInputField
            label="Installation Date"
            value={installDate}
            onChangeText={(text) => {
              setInstallDate(text);
              if (errors.installDate)
                setErrors((prev) => ({ ...prev, installDate: undefined }));
            }}
            error={errors.installDate}
            required
            leftIcon={<Calendar size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <TextInputField
            label="Service / Water Condition Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            leftIcon={<FileText size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <ActionButton
            title="Save Changes"
            variant="primary"
            onPress={handleSave}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
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
  formSectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  formDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  brandChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  brandChip: {
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
  brandChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  areaChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  areaChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFEFF',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    marginBottom: 14,
  },
  mapPreviewIcon: {
    marginRight: 6,
  },
  mapPreviewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0891B2',
  },
  submitBtn: {
    marginTop: 12,
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
    marginBottom: 16,
  },
});
