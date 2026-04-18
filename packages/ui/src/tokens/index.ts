import tokensJson from './tokens.json';

export const tokens = tokensJson;

export const colors = tokens.colors;
export const spacing = tokens.spacing;
export const radii = tokens.radii;
export const fontSizes = tokens.fontSizes;
export const fontWeights = tokens.fontWeights;
export const shadows = tokens.shadows;

export type Tokens = typeof tokens;
export type Colors = typeof tokens.colors;
export type Spacing = typeof tokens.spacing;
export type Radii = typeof tokens.radii;
export type FontSizes = typeof tokens.fontSizes;
export type FontWeights = typeof tokens.fontWeights;
export type Shadows = typeof tokens.shadows;

export default tokens;
