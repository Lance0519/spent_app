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
  intensity = 40,
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

  // Specular border color
  const defaultBorderColor = isAccent
    ? `${accentColor}40`
    : isDarkMode
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(255, 255, 255, 0.70)';

  // Frosted acrylic tint colors
  const gradientColors = isAccent
    ? ([`${accentColor}25`, `${accentColor}12`] as const)
    : isDarkMode
    ? (['rgba(35, 32, 42, 0.72)', 'rgba(22, 20, 27, 0.65)'] as const)
    : (['rgba(255, 255, 255, 0.82)', 'rgba(244, 239, 248, 0.60)'] as const);

  // Top-down specular light shimmer colors
  const specularColors = isDarkMode
    ? (['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.01)', 'rgba(0, 0, 0, 0.05)'] as const)
    : (['rgba(255, 255, 255, 0.90)', 'rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.0)'] as const);

  const containerStyle: ViewStyle = {
    borderRadius,
    borderWidth,
    borderColor: borderColor || defaultBorderColor,
    overflow: 'hidden',
    position: 'relative',
    // Soft ambient glass drop shadow
    ...Platform.select({
      ios: {
        shadowColor: isDarkMode ? '#000000' : '#4A3B52',
        shadowOffset: { width: 0, height: isDarkMode ? 6 : 4 },
        shadowOpacity: isDarkMode ? 0.25 : 0.06,
        shadowRadius: isDarkMode ? 14 : 10,
      },
      android: {
        elevation: isDarkMode ? 3 : 2,
      },
      web: {
        backdropFilter: `blur(${intensity}px)`,
        WebkitBackdropFilter: `blur(${intensity}px)`,
        boxShadow: isDarkMode 
          ? '0 6px 20px rgba(0, 0, 0, 0.35)' 
          : '0 4px 16px rgba(100, 80, 120, 0.08)',
      } as any,
    }),
  };

  const innerContent = (
    <>
      {/* Native Hardware Blur Layer */}
      <BlurView
        intensity={intensity}
        tint={isDarkMode ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Frosted Acrylic Tint Overlay */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Specular Shimmer Light Bounce */}
      {specular && (
        <LinearGradient
          colors={specularColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* Actual Component Children */}
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
