export class CodeGenerator {
  constructor(config = {}) {
    this.format = config.format || 'react';
    this.outputDir = config.outputDir || './output';
    this.cssFramework = config.cssFramework || 'none';
    this.useTypeScript = config.useTypeScript !== false; // 默认使用TypeScript
    this.componentize = config.componentize !== false; // 默认启用组件化
    this.interactiveElements = new Map(); // 存储交互元素
    this.stateVariables = []; // 存储状态变量
    this.eventHandlers = []; // 存储事件处理函数
    this.components = new Map(); // 存储子组件信息
    this.componentCounter = 0; // 组件计数器
  }

  /**
   * 生成代码
   * @param {Object} figmaData - Figma节点数据
   * @returns {Object} 生成的文件内容映射
   */
  generate(figmaData) {
    switch (this.format.toLowerCase()) {
      case 'react':
        return this.generateReact(figmaData);
      case 'html':
        return this.generateHTML(figmaData);
      case 'vue':
        return this.generateVue(figmaData);
      default:
        return this.generateReact(figmaData);
    }
  }

  /**
   * 生成React组件
   */
  generateReact(figmaData) {
    // 重置状态
    this.interactiveElements.clear();
    this.stateVariables = [];
    this.eventHandlers = [];
    this.components.clear();
    this.componentCounter = 0;
    
    const componentName = this.toPascalCase(figmaData.name || 'Component');
    
    // 分析交互元素
    this.analyzeInteractiveElements(figmaData);
    
    // 如果启用组件化，识别并拆分组件
    if (this.componentize) {
      this.identifyComponents(figmaData, 0, null);
    }
    
    const jsx = this.nodeToJSX(figmaData);
    const css = this.generateCSS(figmaData, componentName);
    
    const extension = this.useTypeScript ? 'tsx' : 'jsx';
    const typesFile = this.useTypeScript ? this.generateTypesFile(componentName) : null;

    // 收集主组件中使用的组件ID（用于导入）
    const usedComponentIds = new Set();
    if (this.componentize) {
      this.collectUsedComponents(figmaData, usedComponentIds);
    }
    
    const result = {
      [`${componentName}.${extension}`]: this.getReactTemplate(componentName, jsx, false, usedComponentIds),
      [`${componentName}.css`]: css,
    };
    
    if (typesFile) {
      result[`${componentName}.types.ts`] = typesFile;
    }

    // 生成子组件文件
    if (this.componentize && this.components.size > 0) {
      // 收集主组件中使用的组件ID
      const usedComponentIds = new Set();
      this.collectUsedComponents(figmaData, usedComponentIds);
      
      for (const [componentId, componentInfo] of this.components.entries()) {
        // 只为在主组件中使用的组件生成文件
        if (!usedComponentIds.has(componentId)) continue;
        
        const subComponentName = componentInfo.name;
        
        // 为子组件创建独立的生成器上下文
        const subInteractiveElements = new Map();
        const subStateVariables = [];
        const subEventHandlers = [];
        const subComponents = new Map();
        
        // 分析子组件的交互元素
        this.analyzeInteractiveElementsForNode(componentInfo.node, subInteractiveElements, subStateVariables, subEventHandlers);
        
        // 识别子组件的子组件
        this.identifyComponentsForNode(componentInfo.node, 0, componentId, subComponents);
        
        // 临时替换状态以便生成子组件
        const originalInteractive = this.interactiveElements;
        const originalState = this.stateVariables;
        const originalHandlers = this.eventHandlers;
        const originalComponents = this.components;
        
        this.interactiveElements = subInteractiveElements;
        this.stateVariables = subStateVariables;
        this.eventHandlers = subEventHandlers;
        this.components = subComponents;
        
        const subJsx = this.nodeToJSX(componentInfo.node);
        const subCss = this.generateCSS(componentInfo.node, subComponentName);
        
        // 收集子组件中使用的组件ID
        const subUsedComponentIds = new Set();
        this.collectUsedComponents(componentInfo.node, subUsedComponentIds);
        
        result[`components/${subComponentName}/${subComponentName}.${extension}`] = 
          this.getReactTemplate(subComponentName, subJsx, true, subUsedComponentIds);
        result[`components/${subComponentName}/${subComponentName}.css`] = subCss;
        
        if (this.useTypeScript) {
          result[`components/${subComponentName}/${subComponentName}.types.ts`] = 
            this.generateTypesFile(subComponentName);
        }
        
        // 恢复状态
        this.interactiveElements = originalInteractive;
        this.stateVariables = originalState;
        this.eventHandlers = originalHandlers;
        this.components = originalComponents;
      }
    }

    return result;
  }

  /**
   * 生成HTML
   */
  generateHTML(figmaData) {
    const html = this.nodeToHTML(figmaData);
    const css = this.generateCSS(figmaData, 'styles');

    return {
      'index.html': this.getHTMLTemplate(html, css),
    };
  }

  /**
   * 生成Vue组件
   */
  generateVue(figmaData) {
    const componentName = this.toPascalCase(figmaData.name || 'Component');
    const template = this.nodeToHTML(figmaData);
    const css = this.generateCSS(figmaData, componentName);

    return {
      [`${componentName}.vue`]: this.getVueTemplate(componentName, template, css),
    };
  }

  /**
   * 识别可组件化的节点
   */
  identifyComponents(node, depth = 0, parentId = null) {
    if (!node) return;
    
    const nodeName = (node.name || '').toLowerCase();
    const nodeType = node.type?.toLowerCase();
    const nodeId = node.id;
    
    // 判断是否应该组件化
    let shouldComponentize = false;
    let componentName = '';
    
    // 1. Figma Component 或 Instance 类型
    if (nodeType === 'component' || nodeType === 'instance') {
      shouldComponentize = true;
      componentName = this.toPascalCase(node.name || `Component${++this.componentCounter}`);
    }
    // 2. 命名包含特定关键词（如 card, item, list-item, button-group 等）
    else if (this.isComponentCandidate(nodeName)) {
      shouldComponentize = true;
      componentName = this.toPascalCase(node.name || `Component${++this.componentCounter}`);
    }
    // 3. 有多个子节点且结构复杂（深度和子节点数量判断）
    else if (node.children && node.children.length >= 3 && depth < 3) {
      // 检查是否有重复结构
      if (this.hasRepeatedStructure(node)) {
        shouldComponentize = true;
        componentName = this.toPascalCase(node.name || `Component${++this.componentCounter}`);
      }
    }
    
    if (shouldComponentize && componentName) {
      this.components.set(nodeId, {
        name: componentName,
        node: node,
        parentId: parentId,
      });
      // 标记为组件，不再递归处理其子节点（子节点会在组件内部处理）
      return;
    }
    
    // 递归处理子节点
    if (node.children) {
      node.children.forEach(child => {
        this.identifyComponents(child, depth + 1, nodeId);
      });
    }
  }

  /**
   * 判断节点名称是否暗示应该组件化
   */
  isComponentCandidate(name) {
    const componentKeywords = [
      'card', 'item', 'list-item', 'listitem', 'row', 'cell',
      'header', 'footer', 'sidebar', 'nav', 'menu', 'button-group',
      'form-group', 'input-group', 'modal', 'dialog', 'popup',
      'accordion', 'tab', 'tab-item', 'panel', 'section',
      'widget', 'block', 'box', 'container', 'wrapper'
    ];
    return componentKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 检查节点是否有重复结构（用于识别列表项等）
   */
  hasRepeatedStructure(node) {
    if (!node.children || node.children.length < 2) return false;
    
    // 检查前两个子节点是否有相似的结构
    const firstChild = node.children[0];
    const secondChild = node.children[1];
    
    if (!firstChild || !secondChild) return false;
    
    // 简单的结构相似性检查
    const firstType = firstChild.type;
    const secondType = secondChild.type;
    const firstChildCount = firstChild.children?.length || 0;
    const secondChildCount = secondChild.children?.length || 0;
    
    return firstType === secondType && 
           Math.abs(firstChildCount - secondChildCount) <= 1;
  }

  /**
   * 分析交互元素
   */
  analyzeInteractiveElements(node) {
    if (!node) return;
    
    const nodeName = (node.name || '').toLowerCase();
    const nodeId = node.id;
    
    // 检测按钮
    if (this.isButton(nodeName)) {
      const buttonId = this.toCamelCase(node.name || 'button');
      this.interactiveElements.set(nodeId, {
        type: 'button',
        id: buttonId,
        name: node.name,
      });
      this.addStateVariable(buttonId, 'boolean', false);
      this.addEventHandler(buttonId, 'handleClick');
    }
    
    // 检测输入框
    if (this.isInput(nodeName)) {
      const inputId = this.toCamelCase(node.name || 'input');
      this.interactiveElements.set(nodeId, {
        type: 'input',
        id: inputId,
        name: node.name,
      });
      this.addStateVariable(inputId, 'string', '');
      this.addEventHandler(inputId, 'handleChange');
    }
    
    // 检测可折叠/展开元素
    if (this.isAccordion(nodeName) || this.isCollapsible(nodeName)) {
      const accordionId = this.toCamelCase(node.name || 'accordion');
      this.interactiveElements.set(nodeId, {
        type: 'accordion',
        id: accordionId,
        name: node.name,
      });
      this.addStateVariable(accordionId, 'boolean', false);
      this.addEventHandler(accordionId, 'handleToggle');
    }
    
    // 检测切换开关
    if (this.isToggle(nodeName) || this.isSwitch(nodeName)) {
      const toggleId = this.toCamelCase(node.name || 'toggle');
      this.interactiveElements.set(nodeId, {
        type: 'toggle',
        id: toggleId,
        name: node.name,
      });
      this.addStateVariable(toggleId, 'boolean', false);
      this.addEventHandler(toggleId, 'handleToggle');
    }
    
    // 递归处理子节点
    if (node.children) {
      node.children.forEach(child => {
        this.analyzeInteractiveElements(child);
      });
    }
  }

  /**
   * 判断是否为按钮
   */
  isButton(name) {
    const buttonKeywords = ['button', 'btn', 'click', 'submit', 'confirm', 'cancel', 'ok', 'apply'];
    return buttonKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 判断是否为输入框
   */
  isInput(name) {
    const inputKeywords = ['input', 'textfield', 'text-field', 'form', 'search', 'textarea'];
    return inputKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 判断是否为手风琴/折叠面板
   */
  isAccordion(name) {
    return name.includes('accordion') || name.includes('折叠') || name.includes('展开');
  }

  /**
   * 判断是否为可折叠元素
   */
  isCollapsible(name) {
    return name.includes('collapse') || name.includes('collapsible') || name.includes('expand');
  }

  /**
   * 判断是否为切换开关
   */
  isToggle(name) {
    return name.includes('toggle') || name.includes('switch');
  }

  /**
   * 判断是否为开关
   */
  isSwitch(name) {
    return name.includes('switch') || name.includes('开关');
  }

  /**
   * 添加状态变量
   */
  addStateVariable(id, type, defaultValue) {
    if (!this.stateVariables.find(v => v.id === id)) {
      this.stateVariables.push({ id, type, defaultValue });
    }
  }

  /**
   * 添加事件处理函数
   */
  addEventHandler(id, handlerName) {
    if (!this.eventHandlers.find(h => h.id === id)) {
      this.eventHandlers.push({ id, handlerName });
    }
  }

  /**
   * 将Figma节点转换为JSX
   */
  nodeToJSX(node, depth = 0) {
    if (!node) return '';

    const indent = '  '.repeat(depth);
    const nodeType = node.type?.toLowerCase() || 'div';
    const nodeId = node.id;
    const interactiveElement = this.interactiveElements.get(nodeId);
    
    // 检查是否是组件化的节点
    const componentInfo = this.components.get(nodeId);
    if (componentInfo) {
      // 使用组件而不是原始节点
      const componentName = componentInfo.name;
      const componentProps = this.getComponentProps(node);
      return `${indent}<${componentName}${componentProps} />`;
    }
    
    let tagName = this.mapFigmaTypeToHTML(nodeType);
    let props = [];
    let eventHandlers = [];
    
    // 如果是交互元素，调整标签和属性
    if (interactiveElement) {
      switch (interactiveElement.type) {
        case 'button':
          tagName = 'button';
          eventHandlers.push(`onClick={handle${this.toPascalCase(interactiveElement.id)}}`);
          break;
        case 'input':
          tagName = 'input';
          props.push(`type="text"`);
          props.push(`value={${interactiveElement.id}}`);
          eventHandlers.push(`onChange={handle${this.toPascalCase(interactiveElement.id)}Change}`);
          break;
        case 'accordion':
        case 'toggle':
          eventHandlers.push(`onClick={handle${this.toPascalCase(interactiveElement.id)}Toggle}`);
          break;
      }
    }
    
    // 获取样式属性
    const style = this.getStyleAttributes(node);
    const className = this.getClassName(node);
    
    // 组合所有属性
    const allProps = [className, style, ...props, ...eventHandlers].filter(Boolean).join(' ');
    
    // 处理文本节点
    if (nodeType === 'text' && node.characters) {
      return `${indent}<${tagName}${allProps ? ' ' + allProps : ''}>${this.escapeHTML(node.characters)}</${tagName}>`;
    }

    // 处理子节点
    let children = '';
    if (node.children && node.children.length > 0) {
      children = '\n' + node.children
        .map(child => this.nodeToJSX(child, depth + 1))
        .join('\n') + '\n' + indent;
    }

    // 自闭合标签
    if (this.isSelfClosing(tagName) && !children.trim()) {
      return `${indent}<${tagName}${allProps ? ' ' + allProps : ''} />`;
    }

    return `${indent}<${tagName}${allProps ? ' ' + allProps : ''}>${children}</${tagName}>`;
  }

  /**
   * 获取组件props
   */
  getComponentProps(node) {
    const props = [];
    const className = this.getClassName(node);
    if (className) {
      props.push(className.trim());
    }
    // 可以添加更多props，比如从node中提取的数据
    return props.length > 0 ? ' ' + props.join(' ') : '';
  }

  /**
   * 将Figma节点转换为HTML
   */
  nodeToHTML(node, depth = 0) {
    if (!node) return '';

    const indent = '  '.repeat(depth);
    const nodeType = node.type?.toLowerCase() || 'div';
    const tagName = this.mapFigmaTypeToHTML(nodeType);
    
    const style = this.getStyleAttributes(node, true);
    const className = this.getClassName(node);
    
    if (nodeType === 'text' && node.characters) {
      return `${indent}<${tagName}${className}${style}>${this.escapeHTML(node.characters)}</${tagName}>`;
    }

    let children = '';
    if (node.children && node.children.length > 0) {
      children = '\n' + node.children
        .map(child => this.nodeToHTML(child, depth + 1))
        .join('\n') + '\n' + indent;
    }

    if (this.isSelfClosing(tagName) && !children.trim()) {
      return `${indent}<${tagName}${className}${style} />`;
    }

    return `${indent}<${tagName}${className}${style}>${children}</${tagName}>`;
  }

  /**
   * 生成CSS样式
   */
  generateCSS(node, componentName) {
    const styles = [];
    this.extractStyles(node, styles, componentName);
    return styles.join('\n\n');
  }

  /**
   * 提取样式
   */
  extractStyles(node, styles, prefix = '') {
    if (!node) return;

    const className = this.getClassName(node, true);
    if (className && node.absoluteBoundingBox) {
      const style = this.nodeToCSS(node, className);
      if (style) {
        styles.push(style);
      }
    }

    if (node.children) {
      node.children.forEach(child => {
        this.extractStyles(child, styles, prefix);
      });
    }
  }

  /**
   * 将节点转换为CSS
   */
  nodeToCSS(node, className) {
    const rules = [];
    const bbox = node.absoluteBoundingBox;

    if (bbox) {
      rules.push(`  width: ${bbox.width}px;`);
      rules.push(`  height: ${bbox.height}px;`);
    }

    // 处理填充颜色
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        const color = this.rgbaToCSS(fill.color, fill.opacity);
        rules.push(`  background-color: ${color};`);
      }
    }

    // 处理边框
    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID') {
        const color = this.rgbaToCSS(stroke.color, stroke.opacity);
        const width = node.strokeWeight || 1;
        rules.push(`  border: ${width}px solid ${color};`);
      }
    }

    // 处理圆角
    if (node.cornerRadius) {
      rules.push(`  border-radius: ${node.cornerRadius}px;`);
    }

    // 处理内边距
    if (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom) {
      const padding = [
        node.paddingTop || 0,
        node.paddingRight || 0,
        node.paddingBottom || 0,
        node.paddingLeft || 0,
      ].join('px ') + 'px';
      rules.push(`  padding: ${padding};`);
    }

    // 处理字体样式
    if (node.style) {
      if (node.style.fontFamily) {
        rules.push(`  font-family: ${node.style.fontFamily};`);
      }
      if (node.style.fontSize) {
        rules.push(`  font-size: ${node.style.fontSize}px;`);
      }
      if (node.style.fontWeight) {
        rules.push(`  font-weight: ${node.style.fontWeight};`);
      }
      if (node.style.letterSpacing) {
        rules.push(`  letter-spacing: ${node.style.letterSpacing}px;`);
      }
      if (node.style.lineHeightPx) {
        rules.push(`  line-height: ${node.style.lineHeightPx}px;`);
      }
    }

    // 处理布局
    if (node.layoutMode === 'HORIZONTAL') {
      rules.push('  display: flex;');
      rules.push('  flex-direction: row;');
    } else if (node.layoutMode === 'VERTICAL') {
      rules.push('  display: flex;');
      rules.push('  flex-direction: column;');
    }

    if (rules.length === 0) return '';

    return `${className} {\n${rules.join('\n')}\n}`;
  }

  /**
   * 获取样式属性字符串
   */
  getStyleAttributes(node, inline = false) {
    if (!inline) return '';
    
    const styles = [];
    const bbox = node.absoluteBoundingBox;

    if (bbox) {
      styles.push(`width: ${bbox.width}px`);
      styles.push(`height: ${bbox.height}px`);
    }

    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        styles.push(`background-color: ${this.rgbaToCSS(fill.color, fill.opacity)}`);
      }
    }

    if (styles.length === 0) return '';
    return ` style="${styles.join('; ')}"`;
  }

  /**
   * 获取类名
   */
  getClassName(node, cssClass = false) {
    if (!node.name) return '';
    const name = this.toKebabCase(node.name);
    return cssClass ? `.${name}` : ` className="${name}"`;
  }

  /**
   * 将Figma类型映射到HTML标签
   */
  mapFigmaTypeToHTML(type) {
    const mapping = {
      'frame': 'div',
      'group': 'div',
      'text': 'p',
      'rectangle': 'div',
      'ellipse': 'div',
      'vector': 'svg',
      'component': 'div',
      'instance': 'div',
      'page': 'div',
    };
    return mapping[type] || 'div';
  }

  /**
   * 判断是否为自闭合标签
   */
  isSelfClosing(tagName) {
    return ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tagName);
  }

  /**
   * RGBA转CSS颜色
   */
  rgbaToCSS(color, opacity = 1) {
    if (!color) return 'transparent';
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = opacity !== undefined ? opacity : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * 转义HTML
   */
  escapeHTML(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 转换为PascalCase
   */
  toPascalCase(str) {
    if (!str) return 'Component';
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[a-z]/, chr => chr.toUpperCase());
  }

  /**
   * 转换为kebab-case
   */
  toKebabCase(str) {
    if (!str) return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * 转换为camelCase
   */
  toCamelCase(str) {
    if (!str) return '';
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, chr => chr.toLowerCase());
  }

  /**
   * 收集使用的组件ID
   */
  collectUsedComponents(node, usedIds) {
    if (!node) return;
    
    const nodeId = node.id;
    if (this.components.has(nodeId)) {
      usedIds.add(nodeId);
    }
    
    if (node.children) {
      node.children.forEach(child => {
        this.collectUsedComponents(child, usedIds);
      });
    }
  }

  /**
   * 为特定节点分析交互元素
   */
  analyzeInteractiveElementsForNode(node, interactiveElements, stateVariables, eventHandlers) {
    if (!node) return;
    
    const nodeName = (node.name || '').toLowerCase();
    const nodeId = node.id;
    
    // 检测按钮
    if (this.isButton(nodeName)) {
      const buttonId = this.toCamelCase(node.name || 'button');
      interactiveElements.set(nodeId, {
        type: 'button',
        id: buttonId,
        name: node.name,
      });
      if (!stateVariables.find(v => v.id === buttonId)) {
        stateVariables.push({ id: buttonId, type: 'boolean', defaultValue: false });
      }
      if (!eventHandlers.find(h => h.id === buttonId)) {
        eventHandlers.push({ id: buttonId, handlerName: 'handleClick' });
      }
    }
    
    // 检测输入框
    if (this.isInput(nodeName)) {
      const inputId = this.toCamelCase(node.name || 'input');
      interactiveElements.set(nodeId, {
        type: 'input',
        id: inputId,
        name: node.name,
      });
      if (!stateVariables.find(v => v.id === inputId)) {
        stateVariables.push({ id: inputId, type: 'string', defaultValue: '' });
      }
      if (!eventHandlers.find(h => h.id === inputId)) {
        eventHandlers.push({ id: inputId, handlerName: 'handleChange' });
      }
    }
    
    // 检测可折叠/展开元素
    if (this.isAccordion(nodeName) || this.isCollapsible(nodeName)) {
      const accordionId = this.toCamelCase(node.name || 'accordion');
      interactiveElements.set(nodeId, {
        type: 'accordion',
        id: accordionId,
        name: node.name,
      });
      if (!stateVariables.find(v => v.id === accordionId)) {
        stateVariables.push({ id: accordionId, type: 'boolean', defaultValue: false });
      }
      if (!eventHandlers.find(h => h.id === accordionId)) {
        eventHandlers.push({ id: accordionId, handlerName: 'handleToggle' });
      }
    }
    
    // 检测切换开关
    if (this.isToggle(nodeName) || this.isSwitch(nodeName)) {
      const toggleId = this.toCamelCase(node.name || 'toggle');
      interactiveElements.set(nodeId, {
        type: 'toggle',
        id: toggleId,
        name: node.name,
      });
      if (!stateVariables.find(v => v.id === toggleId)) {
        stateVariables.push({ id: toggleId, type: 'boolean', defaultValue: false });
      }
      if (!eventHandlers.find(h => h.id === toggleId)) {
        eventHandlers.push({ id: toggleId, handlerName: 'handleToggle' });
      }
    }
    
    // 递归处理子节点
    if (node.children) {
      node.children.forEach(child => {
        this.analyzeInteractiveElementsForNode(child, interactiveElements, stateVariables, eventHandlers);
      });
    }
  }

  /**
   * 为特定节点识别组件
   */
  identifyComponentsForNode(node, depth, parentId, components) {
    if (!node) return;
    
    const nodeName = (node.name || '').toLowerCase();
    const nodeType = node.type?.toLowerCase();
    const nodeId = node.id;
    
    // 判断是否应该组件化
    let shouldComponentize = false;
    let componentName = '';
    
    if (nodeType === 'component' || nodeType === 'instance') {
      shouldComponentize = true;
      componentName = this.toPascalCase(node.name || `Component${++this.componentCounter}`);
    } else if (this.isComponentCandidate(nodeName)) {
      shouldComponentize = true;
      componentName = this.toPascalCase(node.name || `Component${++this.componentCounter}`);
    } else if (node.children && node.children.length >= 3 && depth < 3) {
      if (this.hasRepeatedStructure(node)) {
        shouldComponentize = true;
        componentName = this.toPascalCase(node.name || `Component${++this.componentCounter}`);
      }
    }
    
    if (shouldComponentize && componentName) {
      components.set(nodeId, {
        name: componentName,
        node: node,
        parentId: parentId,
      });
      return;
    }
    
    if (node.children) {
      node.children.forEach(child => {
        this.identifyComponentsForNode(child, depth + 1, nodeId, components);
      });
    }
  }

  /**
   * React模板
   */
  getReactTemplate(componentName, jsx, isSubComponent = false, usedComponentIds = null) {
    // 生成子组件的导入
    const componentImports = [];
    if (this.componentize && this.components.size > 0) {
      for (const [componentId, componentInfo] of this.components.entries()) {
        // 如果提供了usedComponentIds，只导入使用的组件
        if (usedComponentIds && !usedComponentIds.has(componentId)) continue;
        
        const subComponentName = componentInfo.name;
        const importPath = isSubComponent 
          ? `../${subComponentName}/${subComponentName}`
          : `./components/${subComponentName}/${subComponentName}`;
        componentImports.push(`import { ${subComponentName} } from '${importPath}';`);
      }
    }
    
    const componentImportsStr = componentImports.length > 0 
      ? componentImports.join('\n') + '\n' 
      : '';
    
    const imports = this.useTypeScript 
      ? `import React, { useState } from 'react';
${componentImportsStr}import './${componentName}.css';
import type { ${componentName}Props } from './${componentName}.types';`
      : `import React, { useState } from 'react';
${componentImportsStr}import './${componentName}.css';`;

    const componentSignature = this.useTypeScript
      ? `const ${componentName}: React.FC<${componentName}Props> = () => {`
      : `const ${componentName} = () => {`;

    // 生成状态声明
    const stateDeclarations = this.stateVariables.length > 0 
      ? this.stateVariables.map(v => {
          const defaultValue = typeof v.defaultValue === 'string' ? `'${v.defaultValue}'` : v.defaultValue;
          const typeAnnotation = this.useTypeScript ? `<${v.type}>` : '';
          return `  const [${v.id}, set${this.toPascalCase(v.id)}] = useState${typeAnnotation}(${defaultValue});`;
        }).join('\n')
      : '';

    // 生成事件处理函数
    const handlers = this.eventHandlers.map(h => {
      const stateVar = this.stateVariables.find(v => v.id === h.id);
      const interactiveElement = Array.from(this.interactiveElements.values()).find(el => el.id === h.id);
      if (!stateVar) return '';
      
      const handlerName = `handle${this.toPascalCase(h.id)}`;
      const setterName = `set${this.toPascalCase(h.id)}`;
      
      // 根据交互元素类型生成不同的处理函数
      if (interactiveElement?.type === 'input') {
        return `  const ${handlerName}Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    ${setterName}(e.target.value);
  };`;
      } else if (interactiveElement?.type === 'accordion' || interactiveElement?.type === 'toggle') {
        return `  const ${handlerName}Toggle = () => {
    ${setterName}(prev => !prev);
  };`;
      } else if (interactiveElement?.type === 'button') {
        return `  const ${handlerName} = () => {
    // TODO: 添加按钮点击逻辑
    console.log('${interactiveElement.name} clicked');
  };`;
      } else {
        return `  const ${handlerName} = () => {
    ${setterName}(prev => !prev);
  };`;
      }
    }).filter(Boolean).join('\n\n');

    const stateSection = stateDeclarations ? stateDeclarations + '\n' : '';
    const handlersSection = handlers ? handlers + '\n' : '';
    
    const exportStatement = isSubComponent 
      ? `export { ${componentName} };\nexport default ${componentName};`
      : `export default ${componentName};`;
    
    return `${imports}

${componentSignature}
${stateSection}${handlersSection}  return (
${jsx}
  );
};

${exportStatement}
`;
  }

  /**
   * 生成TypeScript类型定义文件
   */
  generateTypesFile(componentName) {
    return `export interface ${componentName}Props {
  // TODO: 添加组件props类型定义
}

export interface ${componentName}State {
${this.stateVariables.map(v => `  ${v.id}: ${v.type};`).join('\n')}
}
`;
  }

  /**
   * HTML模板
   */
  getHTMLTemplate(html, css) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figma Design</title>
  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>
`;
  }

  /**
   * Vue模板
   */
  getVueTemplate(componentName, template, css) {
    return `<template>
${template}
</template>

<script>
export default {
  name: '${componentName}',
};
</script>

<style scoped>
${css}
</style>
`;
  }
}
