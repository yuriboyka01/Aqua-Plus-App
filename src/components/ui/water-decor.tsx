import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

export function WaterWavesDecor({ width = 360, height = 140, opacity = 0.18 }: { width?: number; height?: number; opacity?: number }) {
  return (
    <View pointerEvents="none" style={[styles.wavesContainer, { width, height, opacity }]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 140" fill="none">
        <Defs>
          <SvgLinearGradient id="oceanWaveGrad" x1="0" y1="0" x2="360" y2="140" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#06B6D4" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#0E7490" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#164E63" stopOpacity="0.05" />
          </SvgLinearGradient>
          <SvgLinearGradient id="dropletGrad" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#06B6D4" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#0891B2" stopOpacity="0.05" />
          </SvgLinearGradient>
        </Defs>

        {/* Wave 1 */}
        <Path
          d="M0,80 C60,40 120,110 200,60 C260,20 310,80 360,50 L360,140 L0,140 Z"
          fill="url(#oceanWaveGrad)"
        />

        {/* Wave 2 */}
        <Path
          d="M0,105 C80,75 140,120 220,85 C290,55 330,95 360,75 L360,140 L0,140 Z"
          fill="#06B6D4"
          fillOpacity={0.15}
        />

        {/* Decorative Water Droplet Rings */}
        <Circle cx="310" cy="35" r="28" stroke="url(#dropletGrad)" strokeWidth="1.5" />
        <Circle cx="310" cy="35" r="14" fill="#06B6D4" fillOpacity={0.08} />
        <Circle cx="260" cy="70" r="6" fill="#06B6D4" fillOpacity={0.25} />
        <Circle cx="40" cy="30" r="18" stroke="url(#dropletGrad)" strokeWidth="1" />
      </Svg>
    </View>
  );
}

export function DropletIcon({ size = 20, color = '#06B6D4' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wavesContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
});
