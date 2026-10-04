import React from "react";
import {
  Wallet, Plane, Home, Car, TrendingUp, Heart, Backpack, Dices,
  Receipt, PiggyBank, Target, Calendar, BarChart3, Sparkles, Dumbbell,
  MapPin, Fuel, Wrench, Users, Boxes, ClipboardList, Activity, Luggage, Compass,
} from "lucide-react";

const MAP = {
  Wallet, Plane, Home, Car, TrendingUp, Heart, Backpack, Dices,
  Receipt, PiggyBank, Target, Calendar, BarChart3, Sparkles, Dumbbell,
  MapPin, Fuel, Wrench, Users, Boxes, ClipboardList, Activity, Luggage, Compass,
};

export const Icon = ({ name, className = "", strokeWidth = 1.75 }) => {
  const Cmp = MAP[name] || Sparkles;
  return <Cmp className={className} strokeWidth={strokeWidth} />;
};

export default Icon;
