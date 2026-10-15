import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Building2,
  Clock,
  Droplets,
  Info,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react-native';

import { ActionButton, Badge, Card, TextInputField } from '@/components/ui';
import { BottomTabInset, Radii } from '@/constants/theme';
import { defaultSettings } from '@/data/sample-data';
import { useTheme } from '@/hooks/use-theme';
import { BusinessSettings } from '@/types';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        'Settings Saved',
        'Business profile and maintenance configuration have been updated locally.',
        [{ text: 'OK' }]
      );
    }, 400);
  };

  const toggleWhatsApp = () => {
    setSettings((prev) => ({
      ...prev,
      whatsappEnabled: !prev.whatsappEnabled,
    }));
  };

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.background }]}>
      {/* Header */}
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
            <Text style={[styles.screenTitle, { color: theme.text }]}>Settings</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Service Rules, Business Profile & Integrations
            </Text>
          </View>
        </View>
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
        {/* Section 1: Business Profile */}
        <Card style={styles.sectionCard} variant="default">
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconCircle}>
              <Building2 size={18} color="#0891B2" strokeWidth={2.2} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Business Profile
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Branding shown on customer service logs & invoices
              </Text>
            </View>
          </View>

          <TextInputField
            label="Service Business Name"
            value={settings.businessName}
            onChangeText={(text) =>
              setSettings((prev) => ({ ...prev, businessName: text }))
            }
            placeholder="e.g. Aqua Plus RO Tech"
            leftIcon={<Droplets size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <TextInputField
            label="Proprietor / Technician Lead"
            value={settings.ownerName}
            onChangeText={(text) =>
              setSettings((prev) => ({ ...prev, ownerName: text }))
            }
            placeholder="e.g. Nisanth"
            leftIcon={<User size={16} color={theme.textSecondary} strokeWidth={2} />}
          />

          <TextInputField
            label="Official Helpline Phone"
            value={settings.phone}
            onChangeText={(text) =>
              setSettings((prev) => ({ ...prev, phone: text }))
            }
            placeholder="e.g. 9842156789"
            keyboardType="phone-pad"
            leftIcon={<Phone size={16} color={theme.textSecondary} strokeWidth={2} />}
          />
        </Card>

        {/* Section 2: Service Maintenance Rules */}
        <Card style={styles.sectionCard} variant="default">
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconCircle}>
              <Clock size={18} color="#0891B2" strokeWidth={2.2} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Maintenance Rules
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Default cycle for sediment, carbon & membrane replacement
              </Text>
            </View>
          </View>

          <TextInputField
            label="Standard Service Interval (Days)"
            value={settings.defaultIntervalDays.toString()}
            onChangeText={(text) => {
              const num = parseInt(text, 10);
              setSettings((prev) => ({
                ...prev,
                defaultIntervalDays: isNaN(num) ? 90 : num,
              }));
            }}
            keyboardType="numeric"
            hint="Typically 90 days for Madurai borewell high-TDS water."
          />

          <TextInputField
            label="Advance Notice Window (Days)"
            value={settings.reminderDaysBefore.toString()}
            onChangeText={(text) => {
              const num = parseInt(text, 10);
              setSettings((prev) => ({
                ...prev,
                reminderDaysBefore: isNaN(num) ? 3 : num,
              }));
            }}
            keyboardType="numeric"
            hint="Days ahead to flag client service visit as upcoming."
          />
        </Card>

        {/* Section 3: Integrations & WhatsApp Status */}
        <Card style={styles.sectionCard} variant="default">
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconCircle}>
              <MessageCircle size={18} color="#0891B2" strokeWidth={2.2} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Communication Integrations
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Client dispatch notices & reminder gateway
              </Text>
            </View>
          </View>

          {/* WhatsApp Integration Row */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <View style={styles.toggleTitleRow}>
                <Text style={[styles.toggleTitle, { color: theme.text }]}>
                  WhatsApp Direct Dispatch
                </Text>
                <Badge
                  label={settings.whatsappEnabled ? 'Configured (Device)' : 'Standby'}
                  variant={settings.whatsappEnabled ? 'aqua' : 'default'}
                  size="xs"
                />
              </View>
              <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                Opens WhatsApp on your device with pre-composed reminder templates.
              </Text>
            </View>
            <Switch
              value={settings.whatsappEnabled}
              onValueChange={toggleWhatsApp}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* SMS Alerts Row */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <View style={styles.toggleTitleRow}>
                <Text style={[styles.toggleTitle, { color: theme.text }]}>
                  Automated SMS Alerts
                </Text>
                <Badge label="Operating in Test Mode" variant="warning" size="xs" />
              </View>
              <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                External SMS gateway will connect in the Supabase phase.
              </Text>
            </View>
            <Switch
              value={smsAlerts}
              onValueChange={setSmsAlerts}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Integration Status Notice Box */}
          <View style={[styles.infoBox, { backgroundColor: '#ECFEFF' }]}>
            <Info size={16} color="#0891B2" strokeWidth={2.2} style={styles.infoIcon} />
            <Text style={styles.infoText}>
              External gateways operate in verified test mode. Direct WhatsApp messaging links open safely through your device&apos;s WhatsApp client.
            </Text>
          </View>
        </Card>

        {/* Section 4: Application & System Info */}
        <Card style={styles.sectionCard} variant="default">
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={18} color="#0891B2" strokeWidth={2.2} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                App & Storage Health
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Client database and runtime security
              </Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>App Build</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>v1.0.0 (Aqua Flux UI)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Data Storage</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>Local Reactive State (Supabase Ready)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Territory Hub</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>Madurai, Tamil Nadu, India</Text>
            </View>
          </View>
        </Card>

        {/* Save Button */}
        <ActionButton
          title="Save Configuration"
          variant="primary"
          icon={<Save size={16} color="#FFFFFF" strokeWidth={2.2} />}
          onPress={handleSave}
          loading={isSubmitting}
          fullWidth
          size="lg"
          style={styles.saveBtn}
        />
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
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionCard: {
    padding: 16,
    borderRadius: Radii.lg,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: 14,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: Radii.md,
    marginTop: 10,
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 16,
    fontWeight: '600',
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 8,
  },
});
