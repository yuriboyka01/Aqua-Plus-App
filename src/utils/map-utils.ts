import { Linking, Platform } from 'react-native';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export const SERVICE_HUB = {
  name: 'Aqua Plus RO Tech Service Hub',
  area: 'Thirunagar',
  address: 'GST Road, Thirunagar, Madurai, Tamil Nadu - 625006',
  coordinates: {
    latitude: 9.8785,
    longitude: 78.0772,
  },
};

export const MADURAI_AREAS = [
  'Thirunagar',
  'Simmakkal',
  'KK Nagar',
  'Tallakulam',
  'Anna Nagar',
  'Kochadai',
  'Sellur',
  'Teppakulam',
  'Ponmeni',
  'Palanganatham',
  'Villapuram',
  'Goripalayam',
  'Arapalayam',
  'Mattuthavani',
  'Pasumalai',
  'Jaihindpuram',
] as const;

export type MaduraiArea = (typeof MADURAI_AREAS)[number];

export const MADURAI_AREA_COORDINATES: Record<string, LocationCoordinates> = {
  'Thirunagar': { latitude: 9.8785, longitude: 78.0772 },
  'Simmakkal': { latitude: 9.9252, longitude: 78.1198 },
  'KK Nagar': { latitude: 9.9328, longitude: 78.1504 },
  'Tallakulam': { latitude: 9.9366, longitude: 78.1347 },
  'Anna Nagar': { latitude: 9.9189, longitude: 78.1481 },
  'Kochadai': { latitude: 9.9287, longitude: 78.0821 },
  'Sellur': { latitude: 9.9392, longitude: 78.1215 },
  'Teppakulam': { latitude: 9.9142, longitude: 78.1465 },
  'Ponmeni': { latitude: 9.9095, longitude: 78.0932 },
  'Palanganatham': { latitude: 9.9015, longitude: 78.0987 },
  'Villapuram': { latitude: 9.8974, longitude: 78.1256 },
  'Goripalayam': { latitude: 9.9312, longitude: 78.1321 },
  'Arapalayam': { latitude: 9.9301, longitude: 78.1065 },
  'Mattuthavani': { latitude: 9.9455, longitude: 78.1624 },
  'Pasumalai': { latitude: 9.8892, longitude: 78.0845 },
  'Jaihindpuram': { latitude: 9.9056, longitude: 78.1123 },
};

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Calculate estimated driving time from Hub in minutes and formatted text
 */
export function getEstimatedDriveTime(distanceKm: number): {
  minutes: number;
  formatted: string;
} {
  // Average city service vehicle transit speed ~22 km/h + 3 min buffer for parking/dispatch
  const minutes = Math.max(5, Math.round((distanceKm / 22) * 60 + 3));
  return {
    minutes,
    formatted: `~${minutes} mins drive`,
  };
}

/**
 * Generates official Google Maps turn-by-turn navigation URL
 */
export function getGoogleMapsDirectionsUrl(
  destinationAddress: string,
  lat?: number,
  lng?: number
): string {
  const origin = encodeURIComponent(SERVICE_HUB.address);
  const destination =
    lat !== undefined && lng !== undefined
      ? `${lat},${lng}`
      : encodeURIComponent(`${destinationAddress}, Madurai, Tamil Nadu`);

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
}

/**
 * Generates official Google Maps search / location pin URL
 */
export function getGoogleMapsSearchUrl(
  address: string,
  lat?: number,
  lng?: number
): string {
  const query =
    lat !== undefined && lng !== undefined
      ? `${lat},${lng}`
      : encodeURIComponent(`${address}, Madurai, Tamil Nadu`);

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Open turn-by-turn directions in Google Maps (or native maps)
 */
export async function openRouteDirections(
  address: string,
  lat?: number,
  lng?: number
): Promise<void> {
  const webUrl = getGoogleMapsDirectionsUrl(address, lat, lng);

  if (Platform.OS === 'android') {
    const dest =
      lat !== undefined && lng !== undefined
        ? `${lat},${lng}`
        : encodeURIComponent(`${address}, Madurai`);
    const nativeIntent = `google.navigation:q=${dest}&mode=d`;
    try {
      const canOpen = await Linking.canOpenURL(nativeIntent);
      if (canOpen) {
        await Linking.openURL(nativeIntent);
        return;
      }
    } catch {
      // Fallback to web URL
    }
  }

  await Linking.openURL(webUrl);
}

/**
 * Open customer location pin on Google Maps
 */
export async function openLocationPin(
  address: string,
  lat?: number,
  lng?: number
): Promise<void> {
  const webUrl = getGoogleMapsSearchUrl(address, lat, lng);
  await Linking.openURL(webUrl);
}
