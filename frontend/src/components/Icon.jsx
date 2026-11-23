import React from "react";
import {
  Wallet, Plane, Home, Car, TrendingUp, Heart, Backpack, Dices,
  Receipt, PiggyBank, Target, Calendar, BarChart3, Sparkles, Dumbbell,
  MapPin, Fuel, Wrench, Users, Boxes, ClipboardList, Activity, Luggage, Compass,
  Download, ShieldCheck, Lock, LifeBuoy, RefreshCw, Mail, CreditCard, Clock, Smartphone, Monitor,
  Star, Zap, Lightbulb, Eye, Gauge, Layers, FileSpreadsheet, HandCoins, Timer, Smile, BadgeCheck,
} from "lucide-react";

const MAP = {
  Wallet, Plane, Home, Car, TrendingUp, Heart, Backpack, Dices,
  Receipt, PiggyBank, Target, Calendar, BarChart3, Sparkles, Dumbbell,
  MapPin, Fuel, Wrench, Users, Boxes, ClipboardList, Activity, Luggage, Compass,
  Download, ShieldCheck, Lock, LifeBuoy, RefreshCw, Mail, CreditCard, Clock, Smartphone, Monitor,
  Star, Zap, Lightbulb, Eye, Gauge, Layers, FileSpreadsheet, HandCoins, Timer, Smile, BadgeCheck,
};

export const ICON_NAMES = Object.keys(MAP);

export const Icon = ({ name, className = "", strokeWidth = 1.75 }) => {
  const Cmp = MAP[name] || Sparkles;
  return <Cmp className={className} strokeWidth={strokeWidth} />;
};

export default Icon;
