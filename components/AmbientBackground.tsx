import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface AmbientBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'subtle' | 'vibrant' | 'default';
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({ 
  children, 
  style,
  intensity = 'default' 
}) => {
  const { accentColor, isDark } = useTheme();

  // Opacity multipliers based on intensity
  const mult = intensity === 'vibrant' ? 1.4 : intensity === 'subtle' ? 0.7 : 1.0;

  // Harmonious secondary color for atmospheric depth
  const secondaryColor = accentColor.toLowerCase() === '#6366f1' ? '#3B82F6' : '#8B5CF6';

  const orb1Opacity = (isDark ? 0.22 : 0.14) * mult;
  const orb2Opacity = (isDark ? 0.16 : 0.10) * mult;
  const orb3Opacity = (isDark ? 0.14 : 0.08) * mult;

  const baseBg = isDark ? '#141218' : '#FEF7FF';

  return (
    <View style={[styles.container, { backgroundColor: baseBg }, style]}>
      {/* Ambient Lighting Canvas */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            {/* Primary Accent Orb (Top Right) */}
            <RadialGradient
              id="accentOrbTop"
              cx="85%"
              cy="12%"
              rx="55%"
              ry="40%"
              fx="85%"
              fy="12%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={accentColor} stopOpacity={orb1Opacity} />
              <Stop offset="50%" stopColor={accentColor} stopOpacity={orb1Opacity * 0.4} />
              <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
            </RadialGradient>

            {/* Secondary Harmonic Orb (Mid Left) */}
            <RadialGradient
              id="secondaryOrbMid"
              cx="10%"
              cy="45%"
              rx="50%"
              ry="35%"
              fx="10%"
              fy="45%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={secondaryColor} stopOpacity={orb2Opacity} />
              <Stop offset="60%" stopColor={secondaryColor} stopOpacity={orb2Opacity * 0.3} />
              <Stop offset="100%" stopColor={secondaryColor} stopOpacity={0} />
            </RadialGradient>

            {/* Subtle Atmosphere Orb (Bottom Right) */}
            <RadialGradient
              id="atmosphereOrbBottom"
              cx="75%"
              cy="85%"
              rx="60%"
              ry="40%"
              fx="75%"
              fy="85%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={accentColor} stopOpacity={orb3Opacity} />
              <Stop offset="70%" stopColor={accentColor} stopOpacity={orb3Opacity * 0.25} />
              <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* Render glowing orbs */}
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#accentOrbTop)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#secondaryOrbMid)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#atmosphereOrbBottom)" />
        </Svg>
      </View>

      {/* Screen Content */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});
