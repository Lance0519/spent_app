import React from 'react';
import { 
  View, 
  StyleSheet, 
  ViewStyle, 
  StyleProp, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

export interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  level?: 'background' | 'container' | 'control' | 1 | 2 | 3;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'accent';
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  specular?: boolean;
  onPress?: () => void;
  activeOpacity?: number;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

export const GlassView: React.FC<GlassViewProps> = ({
  children,
  style,
  contentStyle,
  level = 'container',
  intensity,
  tint = 'default',
  borderRadius = 24,
  borderWidth = 1,
  borderColor,
  specular = true,
  onPress,
  activeOpacity = 0.75,
  pointerEvents,
}) => {
  const { isDark, accentColor } = useTheme();

  const isDarkMode = tint === 'dark' || (tint === 'default' && isDark);
  const isAccent = tint === 'accent';

  // Standard 3-Tier Hierarchy Mapping
  const levelKey = typeof level === 'number' 
    ? (level === 1 ? 'background' : level === 3 ? 'control' : 'container') 
    : level;

  // Resolved intensity based on hierarchy level
  const resolvedIntensity = intensity ?? (
    levelKey === 'background' ? 25 : levelKey === 'control' ? 70 : 40
  );

  // Specular 1px border stroke color (subtle dark stroke in light mode to clearly define edges)
  const defaultBorderColor = isAccent
    ? `${accentColor}40`
    : isDarkMode
    ? (levelKey === 'control' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.14)')
    : (levelKey === 'control' ? 'rgba(15, 23, 42, 0.14)' : 'rgba(15, 23, 42, 0.09)');

  // Frosted acrylic tint colors per hierarchy level & theme mode
  const gradientColors = isAccent
    ? ([`${accentColor}25`, `${accentColor}12`] as const)
    : isDarkMode
    ? (levelKey === 'background'
        ? (['rgba(20, 18, 28, 0.50)', 'rgba(14, 12, 20, 0.40)'] as const)
        : levelKey === 'control'
        ? (['rgba(36, 32, 48, 0.82)', 'rgba(24, 21, 33, 0.75)'] as const)
        : (['rgba(28, 25, 38, 0.62)', 'rgba(18, 16, 26, 0.52)'] as const))
    : (levelKey === 'background'
        ? (['rgba(255, 255, 255, 0.88)', 'rgba(241, 245, 249, 0.78)'] as const)
        : levelKey === 'control'
        ? (['rgba(255, 255, 255, 0.98)', 'rgba(241, 245, 249, 0.94)'] as const)
        : (['rgba(255, 255, 255, 0.94)', 'rgba(248, 250, 252, 0.88)'] as const));

  // Top specular shimmer light bounce gradient
  const specularColors = isDarkMode
    ? (['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.02)', 'rgba(0, 0, 0, 0.0)'] as const)
    : (['rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.0)'] as const);

  const containerStyle: ViewStyle = {
    borderRadius,
    borderWidth,
    borderColor: borderColor || defaultBorderColor,
    overflow: 'hidden',
    position: 'relative',
    // Soft subtle shadows (no heavy extruded neumorphism)
    ...Platform.select({
      ios: {
        shadowColor: isDarkMode ? '#000000' : '#475569',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDarkMode ? 0.15 : 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: levelKey === 'control' ? 2 : 1,
      },
      web: {
        backdropFilter: `blur(${resolvedIntensity}px)`,
        WebkitBackdropFilter: `blur(${resolvedIntensity}px)`,
        boxShadow: isDarkMode 
          ? '0 4px 16px rgba(0, 0, 0, 0.25)' 
          : '0 2px 12px rgba(71, 85, 105, 0.05)',
      } as any,
    }),
  };

  const innerContent = (
    <>
      {/* Native Hardware Blur Layer - pointerEvents="none" MUST be set for Android click pass-through! */}
      <BlurView
        intensity={resolvedIntensity}
        tint={isDarkMode ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Frosted Acrylic Tint Overlay - pointerEvents="none" */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Top Specular Shimmer Light Bounce - pointerEvents="none" */}
      {specular && (
        <LinearGradient
          colors={specularColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.35 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* Actual Component Children Content */}
      <View style={[styles.content, contentStyle]} pointerEvents={pointerEvents}>
        {children}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={activeOpacity}
        style={[containerStyle, style]}
      >
        {innerContent}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      {innerContent}
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
