import { Platform, ViewStyle } from 'react-native';

type ShadowOptions = {
  color: string;
  opacity: number;
  radius: number;
  elevation: number;
  offsetX?: number;
  offsetY?: number;
};

export const createShadow = ({
  color,
  opacity,
  radius,
  elevation,
  offsetX = 0,
  offsetY = Math.max(2, Math.round(radius / 2))
}: ShadowOptions): ViewStyle => {
  const hex = color.replace('#', '');
  const hexColor =
    hex.length === 3
      ? hex
          .split('')
          .map((value) => value + value)
          .join('')
      : hex;
  const red = Number.parseInt(hexColor.slice(0, 2), 16);
  const green = Number.parseInt(hexColor.slice(2, 4), 16);
  const blue = Number.parseInt(hexColor.slice(4, 6), 16);
  const rgbaColor =
    Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)
      ? `rgba(0, 0, 0, ${opacity})`
      : `rgba(${red}, ${green}, ${blue}, ${opacity})`;

  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${rgbaColor}`
    } as unknown as ViewStyle;
  }

  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: offsetX, height: offsetY },
    elevation
  };
};
