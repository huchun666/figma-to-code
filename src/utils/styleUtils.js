/**
 * 样式工具函数
 * 提供样式相关的转换和处理功能
 */

/**
 * RGBA转CSS颜色
 * @param {Object} color - Figma颜色对象 {r, g, b}
 * @param {number} opacity - 透明度 (0-1)
 * @returns {string} CSS颜色字符串
 */
export function rgbaToCSS(color, opacity = 1) {
  if (!color) return 'transparent';
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = opacity !== undefined ? opacity : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * 获取CSS变量值（用于间距）
 * @param {number} val - 间距值
 * @returns {string} CSS变量或像素值
 */
export function getSpacingVar(val) {
  if (val === 4) return 'var(--spacing-xs)';
  if (val === 8) return 'var(--spacing-sm)';
  if (val === 16) return 'var(--spacing-md)';
  if (val === 24) return 'var(--spacing-lg)';
  if (val === 32) return 'var(--spacing-xl)';
  return `${val}px`;
}

/**
 * 获取CSS变量值（用于圆角）
 * @param {number} val - 圆角值
 * @returns {string} CSS变量或像素值
 */
export function getRadiusVar(val) {
  if (val === 4) return 'var(--border-radius-sm)';
  if (val === 8) return 'var(--border-radius-md)';
  if (val === 12) return 'var(--border-radius-lg)';
  return `${val}px`;
}

/**
 * 获取基础重置样式和CSS变量
 * @returns {string} CSS重置样式
 */
export function getBaseResetStyles() {
  return `/* CSS变量定义 */
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --transition-base: 0.2s ease;
}

/* 基础重置样式 */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

*,
*::before,
*::after {
  box-sizing: inherit;
}`;
}
