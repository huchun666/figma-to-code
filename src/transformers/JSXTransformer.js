/**
 * JSX转换器
 * 负责将Figma节点转换为JSX代码
 */

import { mapFigmaTypeToHTML, isSelfClosing, escapeHTML, detectHorizontalLayout } from '../utils/nodeUtils.js';
import { toPascalCase, toKebabCase, sanitizeVariableName } from '../utils/nameUtils.js';

/**
 * JSX转换器类
 */
export class JSXTransformer {
  constructor(interactiveElements, components, useObjectState) {
    this.interactiveElements = interactiveElements;
    this.components = components;
    this.useObjectState = useObjectState;
  }

  /**
   * 将Figma节点转换为JSX
   * @param {Object} node - Figma节点
   * @param {number} depth - 缩进深度
   * @param {string} currentComponentName - 当前组件名称
   * @returns {string} JSX代码
   */
  transform(node, depth = 0, currentComponentName = null) {
    if (!node) return '';

    // 检查是否可以跳过此节点（减少嵌套）
    if (this.shouldSkipNode(node) && node.children && node.children.length === 1) {
      return this.transform(node.children[0], depth, currentComponentName);
    }

    const indent = '  '.repeat(depth);
    const nodeType = node.type?.toLowerCase() || 'div';
    const nodeId = node.id;
    const interactiveElement = this.interactiveElements.get(nodeId);
    
    // 检查是否是组件化的节点
    const componentInfo = this.components.get(nodeId);
    if (componentInfo) {
      const componentName = componentInfo.name;
      if (componentName === currentComponentName) {
        // 继续正常渲染，不生成组件标签
      } else {
        const componentProps = this.getComponentProps(node);
        return `${indent}<${componentName}${componentProps} />`;
      }
    }
    
    let tagName = mapFigmaTypeToHTML(nodeType);
    let props = [];
    let eventHandlers = [];
    
    // 如果是交互元素，调整标签和属性
    if (interactiveElement) {
      switch (interactiveElement.type) {
        case 'button':
          tagName = 'button';
          eventHandlers.push(`onClick={handle${toPascalCase(interactiveElement.id)}}`);
          break;
        case 'input':
          tagName = 'input';
          props.push(`type="text"`);
          const safeInputId = sanitizeVariableName(interactiveElement.id);
          const inputValueRef = this.useObjectState 
            ? `state.${safeInputId}`
            : safeInputId;
          props.push(`value={${inputValueRef}}`);
          eventHandlers.push(`onChange={handle${toPascalCase(interactiveElement.id)}Change}`);
          break;
        case 'accordion':
        case 'toggle':
          eventHandlers.push(`onClick={handle${toPascalCase(interactiveElement.id)}Toggle}`);
          break;
      }
    }
    
    // 获取样式属性
    const className = this.getClassName(node);
    
    // 组合所有属性
    const allProps = [className, ...props, ...eventHandlers].filter(Boolean).join(' ');
    
    // 处理文本节点
    if (nodeType === 'text' && node.characters) {
      return `${indent}<${tagName}${allProps ? ' ' + allProps : ''}>${escapeHTML(node.characters)}</${tagName}>`;
    }

    // 处理子节点
    let children = '';
    if (node.children && node.children.length > 0) {
      children = '\n' + node.children
        .map(child => this.transform(child, depth + 1, currentComponentName))
        .join('\n') + '\n' + indent;
    }

    // 自闭合标签处理
    if (isSelfClosing(tagName)) {
      if (children.trim()) {
        return `${indent}<div${className ? className : ''}>\n${indent}  <${tagName}${props.length > 0 ? ' ' + props.join(' ') : ''}${eventHandlers.length > 0 ? ' ' + eventHandlers.join(' ') : ''} />${children}\n${indent}</div>`;
      } else {
        return `${indent}<${tagName}${allProps ? ' ' + allProps : ''} />`;
      }
    }

    // 如果节点没有有意义的样式且没有子元素，使用更简洁的形式
    if (!this.hasMeaningfulStyle(node) && !children.trim() && !interactiveElement) {
      return '';
    }

    const cleanProps = allProps.trim();
    
    // 如果只有一个子元素且没有样式，可以考虑简化
    if (children.trim() && node.children?.length === 1 && !this.hasMeaningfulStyle(node)) {
      if (node.children[0].type === 'TEXT' && node.children[0].characters) {
        return `${indent}${escapeHTML(node.children[0].characters)}`;
      }
    }

    return `${indent}<${tagName}${cleanProps ? ' ' + cleanProps : ''}>${children}</${tagName}>`;
  }

  /**
   * 格式化JSX（优化缩进和格式）
   * @param {string} jsx - JSX代码
   * @returns {string} 格式化后的JSX
   */
  format(jsx) {
    if (!jsx) return '';
    
    const lines = jsx.split('\n').filter((line, index, arr) => {
      if (line.trim() === '' && arr[index + 1]?.trim() === '') {
        return false;
      }
      return true;
    });
    
    return lines.join('\n');
  }

  /**
   * 检查节点是否可以跳过
   * @param {Object} node - Figma节点
   * @returns {boolean} 是否可以跳过
   */
  shouldSkipNode(node) {
    if (!node) return true;
    
    const nodeType = node.type?.toLowerCase();
    
    if (nodeType === 'group') {
      const hasStyle = node.fills?.length > 0 || 
                       node.strokes?.length > 0 || 
                       node.cornerRadius > 0 ||
                       node.opacity !== undefined && node.opacity < 1;
      const hasInteraction = this.interactiveElements.has(node.id);
      const childCount = node.children?.length || 0;
      
      if (!hasStyle && !hasInteraction && childCount === 1) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检查节点是否有有意义的样式
   * @param {Object} node - Figma节点
   * @returns {boolean} 是否有有意义的样式
   */
  hasMeaningfulStyle(node) {
    if (!node) return false;
    
    const bbox = node.absoluteBoundingBox;
    const hasFills = node.fills && node.fills.length > 0;
    const hasStrokes = node.strokes && node.strokes.length > 0;
    const hasCornerRadius = node.cornerRadius > 0;
    const hasLayout = node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL';
    const hasPadding = node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft ||
                      node.layoutPaddingTop || node.layoutPaddingRight || node.layoutPaddingBottom || node.layoutPaddingLeft;
    const hasOpacity = node.opacity !== undefined && node.opacity < 1;
    const hasPosition = node.position === 'ABSOLUTE' || node.position === 'RELATIVE';
    
    return hasFills || hasStrokes || hasCornerRadius || hasLayout || hasPadding || hasOpacity || hasPosition || 
           (bbox && (bbox.width !== undefined || bbox.height !== undefined));
  }

  /**
   * 获取组件props
   * @param {Object} node - Figma节点
   * @returns {string} props字符串
   */
  getComponentProps(node) {
    const props = [];
    const className = this.getClassName(node);
    if (className) {
      props.push(className.trim());
    }
    return props.length > 0 ? ' ' + props.join(' ') : '';
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
    
    // 清理无意义的类名
    if (/^frame-\d+$/.test(name) || name === 'group' || name === 'container') {
      name = this.inferSemanticName(node) || 'wrapper';
    }
    
    // 确保类名以字母开头
    if (name && /^[0-9]/.test(name)) {
      name = 'el-' + name;
    }
    
    // 如果类名为空或无效，使用节点ID的一部分
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
