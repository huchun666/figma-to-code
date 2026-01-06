/**
 * CSS转换器
 * 负责将Figma节点转换为CSS样式代码
 */

import { rgbaToCSS, getSpacingVar, getRadiusVar, getBaseResetStyles } from '../utils/styleUtils.js';
import { toKebabCase } from '../utils/nameUtils.js';
import { detectHorizontalLayout } from '../utils/nodeUtils.js';

/**
 * CSS转换器类
 */
export class CSSTransformer {
  /**
   * 生成CSS样式
   * @param {Object} node - Figma节点
   * @param {string} componentName - 组件名称
   * @returns {string} CSS代码
   */
  generate(node, componentName) {
    const styles = [];
    const styleGroups = new Map();
    const singleStyles = [];
    
    // 添加基础重置样式
    styles.push(getBaseResetStyles());
    
    // 提取节点样式
    this.extractStyles(node, singleStyles, componentName, new Set(), new Map(), styleGroups);
    
    // 处理样式组，生成组合选择器
    for (const [styleKey, group] of styleGroups.entries()) {
      if (group.classes.length > 1) {
        const selector = group.classes.join(', ');
        const cssRules = this.extractCSSRulesFromStyle(group.style);
        if (cssRules.length > 0) {
          styles.push(`${selector} {\n${cssRules.join('\n')}\n}`);
        }
      } else if (group.classes.length === 1) {
        styles.push(group.style);
      }
    }
    
    // 添加没有样式键的单独样式
    for (const style of singleStyles) {
      styles.push(style);
    }
    
    return styles.join('\n\n');
  }

  /**
   * 从样式字符串中提取CSS规则（移除选择器）
   * @param {string} styleString - 样式字符串
   * @returns {Array<string>} CSS规则数组
   */
  extractCSSRulesFromStyle(styleString) {
    const match = styleString.match(/\{([\s\S]*)\}/);
    if (match && match[1]) {
      return match[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }
    return [];
  }

  /**
   * 提取样式（优化：合并相似样式，使用CSS变量）
   * @param {Object} node - Figma节点
   * @param {Array} styles - 样式数组
   * @param {string} prefix - 前缀
   * @param {Set} processedClasses - 已处理的类名集合
   * @param {Map} styleMap - 样式映射
   * @param {Map} styleGroups - 样式组映射
   */
  extractStyles(node, styles, prefix = '', processedClasses = new Set(), styleMap = new Map(), styleGroups = new Map()) {
    if (!node) return;

    const className = this.getClassName(node, true);
    
    if (className && !processedClasses.has(className)) {
      processedClasses.add(className);
      
      if (node.type === 'TEXT' || node.absoluteBoundingBox) {
        const style = this.nodeToCSS(node, className);
        if (style && style.trim().length > className.length + 5) {
          const styleKey = this.getStyleKey(node);
          if (styleKey && styleMap.has(styleKey)) {
            const existingClass = styleMap.get(styleKey);
            if (!styleGroups.has(styleKey)) {
              styleGroups.set(styleKey, {
                classes: [existingClass],
                style: style
              });
            }
            const group = styleGroups.get(styleKey);
            if (!group.classes.includes(className)) {
              group.classes.push(className);
            }
          } else {
            if (styleKey) {
              styleMap.set(styleKey, className);
              styleGroups.set(styleKey, {
                classes: [className],
                style: style
              });
            } else {
              styles.push(style);
            }
          }
        }
      }
    }

    if (node.children) {
      node.children.forEach(child => {
        this.extractStyles(child, styles, prefix, processedClasses, styleMap, styleGroups);
      });
    }
  }

  /**
   * 获取样式键（用于合并相似样式）
   * @param {Object} node - Figma节点
   * @returns {string|null} 样式键
   */
  getStyleKey(node) {
    const parts = [];
    const bbox = node.absoluteBoundingBox;
    
    if (bbox) {
      if (bbox.width) parts.push(`w:${bbox.width}`);
      if (bbox.height) parts.push(`h:${bbox.height}`);
    }
    
    if (node.fills?.[0]) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.visible !== false) {
        parts.push(`bg:${rgbaToCSS(fill.color, fill.opacity)}`);
      }
    }
    
    if (node.type === 'TEXT') {
      if (node.style) {
        if (node.style.fontFamily) parts.push(`font:${node.style.fontFamily}`);
        if (node.style.fontSize) parts.push(`size:${node.style.fontSize}`);
        if (node.style.fontWeight) parts.push(`weight:${node.style.fontWeight}`);
        if (node.style.letterSpacing) parts.push(`spacing:${node.style.letterSpacing}`);
        if (node.style.lineHeightPx) parts.push(`line:${node.style.lineHeightPx}`);
      }
      if (node.fills?.[0]) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.visible !== false) {
          parts.push(`color:${rgbaToCSS(fill.color, fill.opacity)}`);
        }
      }
    }
    
    if (node.cornerRadius) {
      parts.push(`radius:${node.cornerRadius}`);
    }
    
    if (node.layoutMode) {
      parts.push(`layout:${node.layoutMode}`);
    }
    
    if (node.strokes?.[0]) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        parts.push(`border:${rgbaToCSS(stroke.color, stroke.opacity)}-${node.strokeWeight || 1}`);
      }
    }
    
    const paddingTop = node.paddingTop || node.layoutPaddingTop || 0;
    const paddingRight = node.paddingRight || node.layoutPaddingRight || 0;
    const paddingBottom = node.paddingBottom || node.layoutPaddingBottom || 0;
    const paddingLeft = node.paddingLeft || node.layoutPaddingLeft || 0;
    if (paddingTop || paddingRight || paddingBottom || paddingLeft) {
      parts.push(`pad:${paddingTop}-${paddingRight}-${paddingBottom}-${paddingLeft}`);
    }
    
    return parts.length > 0 ? parts.join('|') : null;
  }

  /**
   * 将节点转换为CSS
   * @param {Object} node - Figma节点
   * @param {string} className - CSS类名
   * @returns {string} CSS代码
   */
  nodeToCSS(node, className) {
    const rules = [];
    const bbox = node.absoluteBoundingBox;

    // Box sizing
    const needsBoxSizing = node.strokes?.length > 0 || 
                          node.paddingTop || node.paddingRight || 
                          node.paddingBottom || node.paddingLeft;
    if (needsBoxSizing) {
      rules.push('  box-sizing: border-box;');
    }

    // 尺寸
    if (bbox) {
      const needsFixedSize = node.constraints?.horizontal === 'FIXED' || 
                            node.constraints?.vertical === 'FIXED' ||
                            node.minWidth || node.minHeight;
      
      if (bbox.width && (needsFixedSize || node.type === 'TEXT')) {
        rules.push(`  width: ${bbox.width}px;`);
      } else if (bbox.width && node.constraints?.horizontal === 'STRETCH') {
        rules.push('  width: 100%;');
      }
      
      if (bbox.height && (needsFixedSize || node.type === 'TEXT')) {
        rules.push(`  height: ${bbox.height}px;`);
      } else if (bbox.height && node.constraints?.vertical === 'STRETCH') {
        rules.push('  height: 100%;');
      }
    }

    // 处理填充颜色
    if (node.type !== 'TEXT' && node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.visible !== false) {
        const color = rgbaToCSS(fill.color, fill.opacity);
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
          rules.push(`  background-color: ${color};`);
        }
      }
    }

    // 处理边框
    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID') {
        const color = rgbaToCSS(stroke.color, stroke.opacity);
        const width = node.strokeWeight || 1;
        rules.push(`  border: ${width}px solid ${color};`);
        if (node.strokeAlign === 'CENTER') {
          rules.push('  box-sizing: border-box;');
        }
      }
    }

    // 处理圆角
    if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
      rules.push(`  border-radius: ${getRadiusVar(node.cornerRadius)};`);
    }

    // 处理内边距
    const paddingTop = node.paddingTop || node.layoutPaddingTop || 0;
    const paddingRight = node.paddingRight || node.layoutPaddingRight || 0;
    const paddingBottom = node.paddingBottom || node.layoutPaddingBottom || 0;
    const paddingLeft = node.paddingLeft || node.layoutPaddingLeft || 0;
    
    if (paddingTop || paddingRight || paddingBottom || paddingLeft) {
      if (paddingTop === paddingRight && paddingRight === paddingBottom && paddingBottom === paddingLeft) {
        rules.push(`  padding: ${getSpacingVar(paddingTop)};`);
      } else {
        rules.push(`  padding: ${getSpacingVar(paddingTop)} ${getSpacingVar(paddingRight)} ${getSpacingVar(paddingBottom)} ${getSpacingVar(paddingLeft)};`);
      }
    }

    // 处理字体样式
    if (node.style) {
      if (node.style.fontFamily) {
        const fontFamily = node.style.fontFamily.includes(' ') 
          ? `"${node.style.fontFamily}"` 
          : node.style.fontFamily;
        rules.push(`  font-family: ${fontFamily}, sans-serif;`);
      }
      if (node.style.fontSize) {
        rules.push(`  font-size: ${node.style.fontSize}px;`);
      }
      if (node.style.fontWeight) {
        rules.push(`  font-weight: ${node.style.fontWeight};`);
      }
      if (node.style.letterSpacing !== undefined) {
        rules.push(`  letter-spacing: ${node.style.letterSpacing}px;`);
      }
      if (node.style.lineHeightPx) {
        rules.push(`  line-height: ${node.style.lineHeightPx}px;`);
      } else if (node.style.lineHeightPercentFontSize) {
        const lineHeight = (node.style.lineHeightPercentFontSize / 100) * (node.style.fontSize || 16);
        rules.push(`  line-height: ${lineHeight}px;`);
      }
      
      // 文本颜色
      if (node.type === 'TEXT' && node.fills && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.visible !== false) {
          const color = rgbaToCSS(fill.color, fill.opacity);
          if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
            rules.push(`  color: ${color};`);
          }
        }
      }
      
      // 文本对齐
      if (node.textAlignHorizontal) {
        const alignMap = {
          'LEFT': 'left',
          'CENTER': 'center',
          'RIGHT': 'right',
          'JUSTIFIED': 'justify'
        };
        if (alignMap[node.textAlignHorizontal]) {
          rules.push(`  text-align: ${alignMap[node.textAlignHorizontal]};`);
        }
      }
      
      // 文本装饰
      if (node.textDecoration === 'UNDERLINE') {
        rules.push('  text-decoration: underline;');
      } else if (node.textDecoration === 'STRIKETHROUGH') {
        rules.push('  text-decoration: line-through;');
      }
    }

    // 处理布局
    if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
      rules.push('  display: flex;');
      rules.push(`  flex-direction: ${node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'};`);
      
      if (node.primaryAxisAlignItems && node.primaryAxisAlignItems !== 'MIN') {
        const alignMap = {
          'CENTER': 'center',
          'MAX': 'flex-end',
          'SPACE_BETWEEN': 'space-between',
          'SPACE_AROUND': 'space-around'
        };
        if (alignMap[node.primaryAxisAlignItems]) {
          rules.push(`  justify-content: ${alignMap[node.primaryAxisAlignItems]};`);
        }
      }
      
      if (node.counterAxisAlignItems && node.counterAxisAlignItems !== 'MIN') {
        const alignMap = {
          'CENTER': 'center',
          'MAX': 'flex-end',
          'STRETCH': 'stretch',
          'BASELINE': 'baseline'
        };
        if (alignMap[node.counterAxisAlignItems]) {
          rules.push(`  align-items: ${alignMap[node.counterAxisAlignItems]};`);
        }
      }
      
      // Gap间距
      if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
        const spacingVar = node.itemSpacing === 8 ? 'var(--spacing-sm)' :
                          node.itemSpacing === 16 ? 'var(--spacing-md)' :
                          node.itemSpacing === 24 ? 'var(--spacing-lg)' :
                          `${node.itemSpacing}px`;
        rules.push(`  gap: ${spacingVar};`);
      }
      
      if (node.layoutWrap === 'WRAP') {
        rules.push('  flex-wrap: wrap;');
      }
    } else if (node.children && node.children.length > 1) {
      const isHorizontal = detectHorizontalLayout(node);
      if (isHorizontal) {
        rules.push('  display: flex;');
        rules.push('  flex-direction: row;');
      } else if (node.children.length > 2) {
        rules.push('  display: flex;');
        rules.push('  flex-direction: column;');
      }
    }

    // 处理定位
    if (node.position) {
      if (node.position === 'ABSOLUTE') {
        rules.push('  position: absolute;');
      } else if (node.position === 'RELATIVE') {
        rules.push('  position: relative;');
      }
    }
    
    // 处理约束
    if (node.constraints) {
      const constraints = node.constraints;
      if (constraints.horizontal === 'MIN') {
        rules.push('  align-self: flex-start;');
      } else if (constraints.horizontal === 'CENTER') {
        rules.push('  align-self: center;');
      } else if (constraints.horizontal === 'MAX') {
        rules.push('  align-self: flex-end;');
      } else if (constraints.horizontal === 'STRETCH') {
        rules.push('  align-self: stretch;');
        if (bbox && bbox.width) {
          rules.push('  width: 100%;');
        }
      } else if (constraints.horizontal === 'SCALE') {
        if (bbox && bbox.width) {
          rules.push('  width: 100%;');
        }
      }
      
      if (constraints.vertical === 'MIN') {
        rules.push('  align-self: flex-start;');
      } else if (constraints.vertical === 'CENTER') {
        rules.push('  align-self: center;');
      } else if (constraints.vertical === 'MAX') {
        rules.push('  align-self: flex-end;');
      } else if (constraints.vertical === 'STRETCH') {
        rules.push('  align-self: stretch;');
        if (bbox && bbox.height) {
          rules.push('  height: 100%;');
        }
      } else if (constraints.vertical === 'SCALE') {
        if (bbox && bbox.height) {
          rules.push('  height: 100%;');
        }
      }
    }

    // 处理溢出
    if (node.clipsContent !== undefined) {
      rules.push(`  overflow: ${node.clipsContent ? 'hidden' : 'visible'};`);
    }

    // 处理透明度
    if (node.opacity !== undefined && node.opacity < 1) {
      rules.push(`  opacity: ${node.opacity};`);
    }

    // 处理可见性
    if (node.visible === false) {
      rules.push('  display: none;');
    }

    // 处理最小/最大尺寸
    if (node.minWidth) {
      rules.push(`  min-width: ${node.minWidth}px;`);
    }
    if (node.maxWidth) {
      rules.push(`  max-width: ${node.maxWidth}px;`);
    }
    if (node.minHeight) {
      rules.push(`  min-height: ${node.minHeight}px;`);
    }
    if (node.maxHeight) {
      rules.push(`  max-height: ${node.maxHeight}px;`);
    }

    // 处理文本节点特殊样式
    if (node.type === 'TEXT') {
      rules.push('  white-space: pre-wrap;');
      rules.push('  word-wrap: break-word;');
    }

    if (rules.length === 0) return '';

    return `${className} {\n${rules.join('\n')}\n}`;
  }

  /**
   * 获取语义化的类名
   * @param {Object} node - Figma节点
   * @param {boolean} cssClass - 是否返回CSS类格式
   * @returns {string} 类名
   */
  getClassName(node, cssClass = false) {
    if (!node.name) return '';
    
    let name = toKebabCase(node.name);
    
    if (/^frame-\d+$/.test(name) || name === 'group' || name === 'container') {
      name = this.inferSemanticName(node) || 'wrapper';
    }
    
    if (name && /^[0-9]/.test(name)) {
      name = 'el-' + name;
    }
    
    if (!name || name.length === 0) {
      name = node.id ? `node-${node.id.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20)}` : 'element';
    }
    
    return cssClass ? `.${name}` : ` className="${name}"`;
  }

  /**
   * 推断语义化名称
   * @param {Object} node - Figma节点
   * @returns {string|null} 推断的名称
   */
  inferSemanticName(node) {
    if (node.children && node.children.length > 0) {
      const firstChild = node.children[0];
      if (firstChild.type === 'TEXT' && firstChild.characters) {
        const text = firstChild.characters.toLowerCase().substring(0, 20);
        return toKebabCase(text) || null;
      }
      
      const hasButton = node.children.some(c => 
        (c.name || '').toLowerCase().includes('button')
      );
      if (hasButton) return 'button-group';
      
      const hasInput = node.children.some(c => 
        (c.name || '').toLowerCase().includes('input')
      );
      if (hasInput) return 'input-group';
    }
    
    if (node.layoutMode === 'HORIZONTAL') {
      return 'row';
    } else if (node.layoutMode === 'VERTICAL') {
      return 'column';
    }
    
    return null;
  }
}
