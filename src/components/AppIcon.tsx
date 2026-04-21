import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  family?: 'ion' | 'material';
  name: string;
  size?: number;
  color?: string;
};

const AppIcon = ({ family = 'ion', name, size = 20, color = '#132238' }: Props) => {
  if (family === 'material') {
    return <MaterialCommunityIcons name={name as never} size={size} color={color} />;
  }

  return <Ionicons name={name as never} size={size} color={color} />;
};

export default AppIcon;
