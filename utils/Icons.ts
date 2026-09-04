import { 
  Wallet, Coffee, Train, ShoppingCart, Tag, 
  Home, Plane, GraduationCap, HeartPulse, Gamepad2, 
  Laptop, Smartphone, Car, Bus, Fuel, Gift, Zap, 
  Umbrella, Scissors, Baby, PawPrint, Music, MonitorPlay, 
  Book, Shield, Briefcase, PiggyBank, TrendingUp, DollarSign,
  Dumbbell, Crosshair, Wrench, Package, Utensils
} from 'lucide-react-native';

export const IconMap: Record<string, any> = {
  'wallet': Wallet,
  'coffee': Coffee,
  'train': Train,
  'shopping-cart': ShoppingCart,
  'tag': Tag,
  'home': Home,
  'plane': Plane,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  'gamepad-2': Gamepad2,
  'laptop': Laptop,
  'smartphone': Smartphone,
  'car': Car,
  'bus': Bus,
  'fuel': Fuel,
  'gift': Gift,
  'zap': Zap,
  'umbrella': Umbrella,
  'scissors': Scissors,
  'baby': Baby,
  'paw-print': PawPrint,
  'music': Music,
  'monitor-play': MonitorPlay,
  'book': Book,
  'shield': Shield,
  'briefcase': Briefcase,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  'dumbbell': Dumbbell,
  'crosshair': Crosshair,
  'wrench': Wrench,
  'package': Package,
  'utensils': Utensils
};

export const AVAILABLE_ICONS = Object.keys(IconMap);
