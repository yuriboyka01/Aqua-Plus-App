import React, { useState } from 'react';
import {
  Alert,
  Clipboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Navigation,
  Route,
  Zap,
} from 'lucide-react-native';

import { ActionButton } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Radii, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Customer } from '@/types';
import {
  calculateDistanceKm,
  getEstimatedDriveTime,
  openLocationPin,
  openRouteDirections,
  SERVICE_HUB,
} from '@/utils/map-utils';

export interface CustomerMapCardProps {
  customer: Customer;
  showFullDetails?: boolean;
}

export function CustomerMapCard({
  customer,
  showFullDetails = true,
}: CustomerMapCardProps) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  // Calculate distance & drive time
  const customerLat = customer.latitude ?? 9.9252;
  const customerLng = customer.longitude ?? 78.1198;
  const distanceKm = calculateDistanceKm(
    SERVICE_HUB.coordinates.latitude,
    SERVICE_HUB.coordinates.longitude,
    customerLat,
    customerLng
  );
  const driveTime = getEstimatedDriveTime(distanceKm);

  const handleNavigate = () => {
    openRouteDirections(customer.address, customer.latitude, customer.longitude).catch(
      () => {
        Alert.alert('Notice', 'Unable to open maps navigation on this device.');
      }
    );
  };

  const handleOpenPin = () => {
    openLocationPin(customer.address, customer.latitude, customer.longitude).catch(
      () => {
        Alert.alert('Notice', 'Unable to open Google Maps on this device.');
      }
    );
  };

  const handleCopyAddress = () => {
    const fullText = `${customer.name}\n${customer.address}${
      customer.landmark ? ` (Landmark: ${customer.landmark})` : ''
    }`;
    if (Clipboard && Clipboard.setString) {
      Clipboard.setString(fullText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Card style={styles.cardContainer} variant="default">
      {/* Header with Route Info */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.routeIconBubble}>
            <Route size={16} color="#0891B2" strokeWidth={2.2} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Service Route & Map
            </Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
              From {SERVICE_HUB.area} Hub → {customer.area ?? 'Customer Home'}
            </Text>
          </View>
        </View>

        <View style={styles.badgesCol}>
          <View style={styles.distancePill}>
            <Zap size={11} color="#0369A1" strokeWidth={2.2} style={styles.zapIcon} />
            <Text style={styles.distanceText}>{distanceKm} km</Text>
          </View>
        </View>
      </View>

      {/* Styled Interactive / Schematic Transit Map */}
      <View style={styles.mapGraphicWrapper}>
        <Svg width="100%" height={140} viewBox="0 0 340 140">
          <Defs>
            <SvgGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#F0F9FF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.85" />
            </SvgGradient>
            <SvgGradient id="routeGradient" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0%" stopColor="#0891B2" stopOpacity="1" />
              <Stop offset="100%" stopColor="#06B6D4" stopOpacity="1" />
            </SvgGradient>
          </Defs>

          {/* Background Canvas */}
          <Rect width="340" height="140" rx="12" fill="url(#mapBg)" />

          {/* Stylized Grid Roads of Madurai */}
          <Path
            d="M 10 35 L 330 35 M 10 75 L 330 75 M 10 115 L 330 115"
            stroke="#CBD5E1"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <Path
            d="M 70 10 L 70 130 M 170 10 L 170 130 M 270 10 L 270 130"
            stroke="#CBD5E1"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.6"
          />

          {/* Vaigai River Ribbon (Madurai Landmark) */}
          <Path
            d="M 0 50 Q 80 40 160 55 T 340 45"
            fill="none"
            stroke="#BAE6FD"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.8"
          />
          <SvgText
            x="240"
            y="48"
            fontSize="9"
            fill="#0369A1"
            fontWeight="600"
            opacity="0.75"
          >
            Vaigai River
          </SvgText>

          {/* Madurai City Hub to Customer Route Polyline */}
          <Path
            d="M 50 110 Q 110 95 160 75 T 280 30"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="6 3"
          />

          {/* Origin: Service Hub (Thirunagar) */}
          <Circle cx="50" cy="110" r="14" fill="rgba(8, 145, 178, 0.2)" />
          <Circle cx="50" cy="110" r="8" fill="#0891B2" />
          <Circle cx="50" cy="110" r="4" fill="#FFFFFF" />
          <SvgText
            x="20"
            y="132"
            fontSize="10"
            fontWeight="700"
            fill="#0E7490"
          >
            Hub (Thirunagar)
          </SvgText>

          {/* Midpoint Corridor Landmark */}
          <Circle cx="160" cy="75" r="3" fill="#64748B" />
          <SvgText
            x="145"
            y="90"
            fontSize="8"
            fontWeight="500"
            fill="#64748B"
          >
            Bypass Rd
          </SvgText>

          {/* Destination: Customer Home */}
          <Circle cx="280" cy="30" r="16" fill="rgba(6, 182, 212, 0.25)" />
          <Circle cx="280" cy="30" r="10" fill="#0E7490" />
          <Circle cx="280" cy="30" r="4" fill="#FFFFFF" />
          <SvgText
            x="240"
            y="20"
            fontSize="10"
            fontWeight="800"
            fill="#0F172A"
          >
            {customer.name.split(' ')[0]}&apos;s Home
          </SvgText>
        </Svg>

        {/* Live Route Summary Overlay Tag */}
        <View style={styles.routeOverlayTag}>
          <Text style={styles.routeOverlayTitle}>{driveTime.formatted}</Text>
          <Text style={styles.routeOverlaySub}>Fastest route via Madurai Ring / Bypass</Text>
        </View>
      </View>

      {/* Address & Landmark Details */}
      {showFullDetails && (
        <View style={styles.addressInfoBlock}>
          <View style={styles.addressRow}>
            <MapPin size={15} color="#0891B2" strokeWidth={2.2} style={styles.addressIcon} />
            <Text style={[styles.addressText, { color: theme.text }]}>
              {customer.address}
            </Text>
          </View>

          {customer.landmark ? (
            <View style={styles.landmarkRow}>
              <View style={styles.landmarkPill}>
                <Text style={styles.landmarkLabel}>Landmark:</Text>
                <Text style={styles.landmarkText} numberOfLines={1}>
                  {customer.landmark}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <View style={styles.actionMain}>
          <ActionButton
            title="Navigate in Google Maps"
            variant="primary"
            icon={<Navigation size={15} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={handleNavigate}
            fullWidth
            size="md"
          />
        </View>

        <View style={styles.actionSecondaryRow}>
          <Pressable
            onPress={handleOpenPin}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Open Pin in Google Maps"
          >
            <ExternalLink size={14} color="#0369A1" strokeWidth={2} style={styles.secBtnIcon} />
            <Text style={styles.secBtnText}>View Pin</Text>
          </Pressable>

          <Pressable
            onPress={handleCopyAddress}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Copy Customer Address"
          >
            {copied ? (
              <>
                <Check size={14} color="#10B981" strokeWidth={2.5} style={styles.secBtnIcon} />
                <Text style={[styles.secBtnText, { color: '#10B981' }]}>Copied</Text>
              </>
            ) : (
              <>
                <Copy size={14} color="#0369A1" strokeWidth={2} style={styles.secBtnIcon} />
                <Text style={styles.secBtnText}>Copy Address</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    padding: 16,
    borderRadius: Radii.lg,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  routeIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(8, 145, 178, 0.25)',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  badgesCol: {
    alignItems: 'flex-end',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.25)',
  },
  zapIcon: {
    marginRight: 3,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  mapGraphicWrapper: {
    position: 'relative',
    borderRadius: Radii.md,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  routeOverlayTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  routeOverlayTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E7490',
  },
  routeOverlaySub: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748B',
  },
  addressInfoBlock: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  landmarkRow: {
    marginTop: 6,
    paddingLeft: 23,
  },
  landmarkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  landmarkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
    marginRight: 4,
  },
  landmarkText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0F172A',
    flex: 1,
  },
  actionsContainer: {
    gap: 8,
  },
  actionMain: {
    width: '100%',
  },
  actionSecondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.25)',
  },
  secBtnIcon: {
    marginRight: 6,
  },
  secBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
