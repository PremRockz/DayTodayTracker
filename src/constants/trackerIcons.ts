import {
  Milk,
  Newspaper,
  Coffee,
  Utensils,
  Palette,
  Car,
  Trash2,
  Receipt,
  Droplet,
  Cake,
  Zap,
  Gem,
  Banknote,
  Fuel,
  ShoppingCart,
  HeartPulse,
} from 'lucide-react-native';

export const TRACKER_ICONS = [
  { id: 'milk', component: Milk },
  { id: 'newspaper', component: Newspaper },
  { id: 'coffee', component: Coffee },
  { id: 'food', component: Utensils },
  { id: 'hobby', component: Palette },
  { id: 'car', component: Car },
  { id: 'bill', component: Receipt },
  { id: 'water', component: Droplet },
  { id: 'event', component: Cake },
  { id: 'electricity', component: Zap },
  { id: 'gold', component: Gem },
  { id: 'money', component: Banknote },
  { id: 'petrol', component: Fuel },
  { id: 'grocery', component: ShoppingCart },
  { id: 'hospital', component: HeartPulse },
  { id: 'other', component: Trash2 },
];

export const TRACKER_ICON_MAP: { [key: string]: typeof Milk } = Object.fromEntries(
  TRACKER_ICONS.map((icon) => [icon.id, icon.component])
);
