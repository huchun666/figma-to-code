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
    this.nodeCache = new Map(); // 节点缓存（用于计算相对位置）
    this.useObjectState = false; // 是否使用对象状态管理
  }

  /**
   * 预处理Figma数据，优化数据结构
   */
  preprocessNode(node, parentNode = null) {
    if (!node) return null;

    // 计算相对位置（如果需要）
    if (parentNode && node.absoluteBoundingBox && parentNode.absoluteBoundingBox) {
      node.relativeBoundingBox = {
        x: node.absoluteBoundingBox.x - parentNode.absoluteBoundingBox.x,
        y: node.absoluteBoundingBox.y - parentNode.absoluteBoundingBox.y,
        width: node.absoluteBoundingBox.width,
        height: node.absoluteBoundingBox.height
      };
    }

    // 过滤不可见的填充和描边
    if (node.fills) {
      node.fills = node.fills.filter(fill => fill.visible !== false);
    }
    if (node.strokes) {
      node.strokes = node.strokes.filter(stroke => stroke.visible !== false);
    }

    // 预处理子节点
    if (node.children && node.children.length > 0) {
      node.children = node.children
        .map(child => this.preprocessNode(child, node))
        .filter(child => child !== null);
    }

    return node;
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
    this.nodeCache.clear();
    
    // 预处理Figma数据（优化数据结构）
    const processedData = this.preprocessNode(figmaData);
    
    const componentName = this.toPascalCase(processedData.name || 'Component');
    
    // 分析交互元素
    this.analyzeInteractiveElements(processedData);
    
    // 如果启用组件化，识别并拆分组件
    if (this.componentize) {
      this.identifyComponents(processedData, 0, null);
    }
    
    // JSX从depth=1开始，因为return语句后面需要缩进
    const jsx = this.nodeToJSX(processedData, 1, componentName);
    const css = this.generateCSS(processedData, componentName);
    
    const extension = this.useTypeScript ? 'tsx' : 'jsx';
    const typesFile = this.useTypeScript ? this.generateTypesFile(componentName) : null;

    // 收集主组件中使用的组件ID（用于导入）
    const usedComponentIds = new Set();
    const rootNodeId = figmaData.id;
    
    if (this.componentize) {
      this.collectUsedComponents(figmaData, usedComponentIds);
    }
    
    const result = {};
    
    // 如果启用组件化，所有组件都放在components目录下
    if (this.componentize) {
      result[`components/${componentName}/${componentName}.${extension}`] = 
        this.getReactTemplate(componentName, jsx, true, usedComponentIds);
      result[`components/${componentName}/${componentName}.css`] = css;
      if (typesFile) {
        result[`components/${componentName}/${componentName}.types.ts`] = typesFile;
      }
    } else {
      // 未启用组件化时，生成在主目录下
      result[`${componentName}.${extension}`] = this.getReactTemplate(componentName, jsx, false, usedComponentIds);
      result[`${componentName}.css`] = css;
      if (typesFile) {
        result[`${componentName}.types.ts`] = typesFile;
      }
    }

    // 生成子组件文件（排除根节点，因为已经在上面处理了）
    if (this.componentize && this.components.size > 0) {
      // 记录已生成的组件名称，避免重复
      const generatedComponents = new Set();
      if (this.componentize) {
        generatedComponents.add(componentName);
      }
      
      for (const [componentId, componentInfo] of this.components.entries()) {
        // 跳过根节点（已经在上面处理了）
        if (componentId === rootNodeId) continue;
        
        // 只为在主组件中使用的组件生成文件
        if (!usedComponentIds.has(componentId)) continue;
        
        const subComponentName = componentInfo.name;
        
        // 如果组件名称已生成，跳过（避免重复）
        if (generatedComponents.has(subComponentName)) continue;
        generatedComponents.add(subComponentName);
        
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
        const originalUseObjectState = this.useObjectState;
        
        this.interactiveElements = subInteractiveElements;
        this.stateVariables = subStateVariables;
        this.eventHandlers = subEventHandlers;
        this.components = subComponents;
        this.useObjectState = subStateVariables.length > 3;
        
        // 子组件的JSX也从depth=1开始
        const subJsx = this.nodeToJSX(componentInfo.node, 1, subComponentName);
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
        this.useObjectState = originalUseObjectState;
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
      const buttonId = this.sanitizeVariableName(this.toCamelCase(node.name || 'button'));
      this.interactiveElements.set(nodeId, {
        type: 'button',
        id: buttonId,
        name: node.name,
      });
      // 按钮通常不需要状态变量，只需要事件处理器
      // this.addStateVariable(buttonId, 'boolean', false);
      this.addEventHandler(buttonId, 'handleClick');
    }
    
    // 检测输入框
    if (this.isInput(nodeName)) {
      const inputId = this.sanitizeVariableName(this.toCamelCase(node.name || 'input'));
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
      const accordionId = this.sanitizeVariableName(this.toCamelCase(node.name || 'accordion'));
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
      const toggleId = this.sanitizeVariableName(this.toCamelCase(node.name || 'toggle'));
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
   * 检测水平布局
   */
  detectHorizontalLayout(node) {
    if (!node.children || node.children.length < 2) return false;
    
    const firstChild = node.children[0];
    const secondChild = node.children[1];
    
    if (!firstChild.absoluteBoundingBox || !secondChild.absoluteBoundingBox) return false;
    
    // 如果第二个子元素的y坐标与第一个相近（在同一行），则是水平布局
    const yDiff = Math.abs(secondChild.absoluteBoundingBox.y - firstChild.absoluteBoundingBox.y);
    const xDiff = Math.abs(secondChild.absoluteBoundingBox.x - firstChild.absoluteBoundingBox.x);
    
    return yDiff < 10 && xDiff > 10; // y坐标相近且x坐标不同，说明是水平排列
  }

  /**
   * 检查节点是否可以跳过（减少嵌套）
   */
  shouldSkipNode(node) {
    if (!node) return true;
    
    const nodeType = node.type?.toLowerCase();
    
    // GROUP类型且没有样式、没有交互、只有一个子元素时可以跳过
    if (nodeType === 'group') {
      const hasStyle = node.fills?.length > 0 || 
                       node.strokes?.length > 0 || 
                       node.cornerRadius > 0 ||
                       node.opacity !== undefined && node.opacity < 1;
      const hasInteraction = this.interactiveElements.has(node.id);
      const childCount = node.children?.length || 0;
      
      // 如果没有样式、没有交互、且只有一个子元素，可以跳过
      if (!hasStyle && !hasInteraction && childCount === 1) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检查节点是否有有意义的样式
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
   * 将Figma节点转换为JSX
   */
  nodeToJSX(node, depth = 0, currentComponentName = null) {
    if (!node) return '';

    // 检查是否可以跳过此节点（减少嵌套）
    if (this.shouldSkipNode(node) && node.children && node.children.length === 1) {
      // 跳过当前节点，直接渲染子节点
      return this.nodeToJSX(node.children[0], depth, currentComponentName);
    }

    const indent = '  '.repeat(depth);
    const nodeType = node.type?.toLowerCase() || 'div';
    const nodeId = node.id;
    const interactiveElement = this.interactiveElements.get(nodeId);
    
    // 检查是否是组件化的节点
    const componentInfo = this.components.get(nodeId);
    if (componentInfo) {
      const componentName = componentInfo.name;
      // 如果组件名称与当前组件名称相同，避免循环引用，渲染为普通div
      if (componentName === currentComponentName) {
        // 继续正常渲染，不生成组件标签
      } else {
        // 使用组件而不是原始节点
        const componentProps = this.getComponentProps(node);
        return `${indent}<${componentName}${componentProps} />`;
      }
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
          // 根据状态管理方式选择引用方式
          const safeInputId = this.sanitizeVariableName(interactiveElement.id);
          const inputValueRef = this.useObjectState 
            ? `state.${safeInputId}`
            : safeInputId;
          props.push(`value={${inputValueRef}}`);
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
        .map(child => this.nodeToJSX(child, depth + 1, currentComponentName))
        .join('\n') + '\n' + indent;
    }

    // 如果节点没有有意义的样式且只有一个子元素，可以考虑合并
    // 但为了保持结构，这里还是保留节点，只是不生成不必要的样式

    // 自闭合标签处理
    if (this.isSelfClosing(tagName)) {
      // 如果自闭合标签有子元素，需要将input和子元素包装在容器中
      if (children.trim()) {
        // 对于input等自闭合标签，子元素应该包装在容器中
        return `${indent}<div${className ? className : ''}${style ? style : ''}>\n${indent}  <${tagName}${props.length > 0 ? ' ' + props.join(' ') : ''}${eventHandlers.length > 0 ? ' ' + eventHandlers.join(' ') : ''} />${children}\n${indent}</div>`;
      } else {
        // 没有子元素，使用自闭合形式
        return `${indent}<${tagName}${allProps ? ' ' + allProps : ''} />`;
      }
    }

    // 如果节点没有有意义的样式且没有子元素，使用更简洁的形式
    if (!this.hasMeaningfulStyle(node) && !children.trim() && !interactiveElement) {
      // 空节点且无样式，可以省略或使用Fragment
      return '';
    }

    // 优化属性格式（移除多余空格）
    const cleanProps = allProps.trim();
    
    // 如果只有一个子元素且没有样式，可以考虑简化
    if (children.trim() && node.children?.length === 1 && !this.hasMeaningfulStyle(node)) {
      // 如果子元素是文本，直接返回文本
      if (node.children[0].type === 'TEXT' && node.children[0].characters) {
        return `${indent}${this.escapeHTML(node.children[0].characters)}`;
      }
    }

    return `${indent}<${tagName}${cleanProps ? ' ' + cleanProps : ''}>${children}</${tagName}>`;
  }

  /**
   * 格式化JSX（优化缩进和格式）
   */
  formatJSX(jsx) {
    if (!jsx) return '';
    
    // 移除多余的空行
    const lines = jsx.split('\n').filter((line, index, arr) => {
      // 移除连续的空行
      if (line.trim() === '' && arr[index + 1]?.trim() === '') {
        return false;
      }
      return true;
    });
    
    return lines.join('\n');
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
    const styleGroups = new Map();
    const singleStyles = []; // 存储没有样式键的单独样式
    
    // 添加基础重置样式
    styles.push(this.getBaseResetStyles());
    
    // 提取节点样式
    this.extractStyles(node, singleStyles, componentName, new Set(), new Map(), styleGroups);
    
    // 处理样式组，生成组合选择器
    const processedClasses = new Set();
    for (const [styleKey, group] of styleGroups.entries()) {
      if (group.classes.length > 1) {
        // 多个类使用相同样式，使用组合选择器
        // group.classes 已经包含点号（如 ".el-1"），直接使用
        const selector = group.classes.join(', ');
        const cssRules = this.extractCSSRulesFromStyle(group.style);
        if (cssRules.length > 0) {
          styles.push(`${selector} {\n${cssRules.join('\n')}\n}`);
        }
        // 标记这些类已处理
        group.classes.forEach(cls => processedClasses.add(cls));
      } else if (group.classes.length === 1) {
        // 单个类，直接使用原有样式
        styles.push(group.style);
        processedClasses.add(group.classes[0]);
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
   */
  extractCSSRulesFromStyle(styleString) {
    // 格式通常是: ".className {\n  rule1;\n  rule2;\n}"
    // 提取花括号之间的内容
    const match = styleString.match(/\{([\s\S]*)\}/);
    if (match && match[1]) {
      // 按行分割，过滤空行
      return match[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }
    return [];
  }

  /**
   * 获取基础重置样式和CSS变量
   */
  getBaseResetStyles() {
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

  /**
   * 提取样式（优化：合并相似样式，使用CSS变量）
   */
  extractStyles(node, styles, prefix = '', processedClasses = new Set(), styleMap = new Map(), styleGroups = new Map()) {
    if (!node) return;

    const className = this.getClassName(node, true);
    
    // 避免重复生成相同类名的样式
    if (className && !processedClasses.has(className)) {
      processedClasses.add(className);
      
      // 为文本节点和有bounding box的节点生成样式
      if (node.type === 'TEXT' || node.absoluteBoundingBox) {
        const style = this.nodeToCSS(node, className);
        if (style && style.trim().length > className.length + 5) { // 确保有实际内容
          // 检查是否有相似的样式可以合并
          const styleKey = this.getStyleKey(node);
          if (styleKey && styleMap.has(styleKey)) {
            // 找到相同样式的类，将它们组合在一起
            const existingClass = styleMap.get(styleKey);
            if (!styleGroups.has(styleKey)) {
              // 需要获取已有类的样式
              // 由于我们无法回溯节点，我们使用当前节点的样式
              styleGroups.set(styleKey, {
                classes: [existingClass],
                style: style // 使用当前样式（应该与已有类相同）
              });
            }
            // 将当前类添加到样式组
            const group = styleGroups.get(styleKey);
            if (!group.classes.includes(className)) {
              group.classes.push(className);
            }
          } else {
            if (styleKey) {
              styleMap.set(styleKey, className);
              // 创建新的样式组
              styleGroups.set(styleKey, {
                classes: [className],
                style: style
              });
            } else {
              // 没有样式键，直接添加样式
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
   * 比较所有重要的样式属性来识别相同的样式
   */
  getStyleKey(node) {
    const parts = [];
    const bbox = node.absoluteBoundingBox;
    
    // 尺寸
    if (bbox) {
      if (bbox.width) parts.push(`w:${bbox.width}`);
      if (bbox.height) parts.push(`h:${bbox.height}`);
    }
    
    // 背景色
    if (node.fills?.[0]) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.visible !== false) {
        parts.push(`bg:${this.rgbaToCSS(fill.color, fill.opacity)}`);
      }
    }
    
    // 文本样式
    if (node.type === 'TEXT') {
      if (node.style) {
        if (node.style.fontFamily) parts.push(`font:${node.style.fontFamily}`);
        if (node.style.fontSize) parts.push(`size:${node.style.fontSize}`);
        if (node.style.fontWeight) parts.push(`weight:${node.style.fontWeight}`);
        if (node.style.letterSpacing) parts.push(`spacing:${node.style.letterSpacing}`);
        if (node.style.lineHeightPx) parts.push(`line:${node.style.lineHeightPx}`);
      }
      // 文本颜色
      if (node.fills?.[0]) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.visible !== false) {
          parts.push(`color:${this.rgbaToCSS(fill.color, fill.opacity)}`);
        }
      }
    }
    
    // 圆角
    if (node.cornerRadius) {
      parts.push(`radius:${node.cornerRadius}`);
    }
    
    // 布局
    if (node.layoutMode) {
      parts.push(`layout:${node.layoutMode}`);
    }
    
    // 边框
    if (node.strokes?.[0]) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID' && stroke.visible !== false) {
        parts.push(`border:${this.rgbaToCSS(stroke.color, stroke.opacity)}-${node.strokeWeight || 1}`);
      }
    }
    
    // 内边距
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
   * 将节点转换为CSS（优化：移除不必要的样式）
   */
  nodeToCSS(node, className) {
    const rules = [];
    const bbox = node.absoluteBoundingBox;

    // Box sizing（只在需要时添加）
    const needsBoxSizing = node.strokes?.length > 0 || 
                          node.paddingTop || node.paddingRight || 
                          node.paddingBottom || node.paddingLeft;
    if (needsBoxSizing) {
      rules.push('  box-sizing: border-box;');
    }

    // 尺寸（只在有明确尺寸时添加，避免固定尺寸限制灵活性）
    if (bbox) {
      // 只在必要时添加固定尺寸（如果节点有明确的布局约束或需要固定尺寸）
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

    // 处理填充颜色（文本节点不使用fills作为背景）
    if (node.type !== 'TEXT' && node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.visible !== false) {
        const color = this.rgbaToCSS(fill.color, fill.opacity);
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
          rules.push(`  background-color: ${color};`);
        }
      }
    }
    // 移除不必要的透明背景设置

    // 处理边框
    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID') {
        const color = this.rgbaToCSS(stroke.color, stroke.opacity);
        const width = node.strokeWeight || 1;
        const strokeAlign = node.strokeAlign || 'INSIDE';
        
        if (strokeAlign === 'INSIDE') {
          rules.push(`  border: ${width}px solid ${color};`);
        } else if (strokeAlign === 'CENTER') {
          rules.push(`  border: ${width}px solid ${color};`);
          rules.push('  box-sizing: border-box;');
        } else {
          rules.push(`  border: ${width}px solid ${color};`);
        }
      }
    }

    // 处理圆角（使用CSS变量）
    if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
      const getRadiusVar = (val) => {
        if (val === 4) return 'var(--border-radius-sm)';
        if (val === 8) return 'var(--border-radius-md)';
        if (val === 12) return 'var(--border-radius-lg)';
        return `${val}px`;
      };
      rules.push(`  border-radius: ${getRadiusVar(node.cornerRadius)};`);
    }

    // 处理内边距（从layoutPadding或padding属性，使用CSS变量）
    const paddingTop = node.paddingTop || node.layoutPaddingTop || 0;
    const paddingRight = node.paddingRight || node.layoutPaddingRight || 0;
    const paddingBottom = node.paddingBottom || node.layoutPaddingBottom || 0;
    const paddingLeft = node.paddingLeft || node.layoutPaddingLeft || 0;
    
    if (paddingTop || paddingRight || paddingBottom || paddingLeft) {
      // 使用CSS变量简化常用值
      const getSpacingVar = (val) => {
        if (val === 4) return 'var(--spacing-xs)';
        if (val === 8) return 'var(--spacing-sm)';
        if (val === 16) return 'var(--spacing-md)';
        if (val === 24) return 'var(--spacing-lg)';
        if (val === 32) return 'var(--spacing-xl)';
        return `${val}px`;
      };
      
      if (paddingTop === paddingRight && paddingRight === paddingBottom && paddingBottom === paddingLeft) {
        rules.push(`  padding: ${getSpacingVar(paddingTop)};`);
      } else {
        rules.push(`  padding: ${getSpacingVar(paddingTop)} ${getSpacingVar(paddingRight)} ${getSpacingVar(paddingBottom)} ${getSpacingVar(paddingLeft)};`);
      }
    }

    // 处理外边距（通过计算子元素位置得出）
    // 如果有父节点和子节点，可以通过位置差计算margin
    // 这里简化处理，主要依赖Figma的布局约束

    // 处理字体样式
    if (node.style) {
      if (node.style.fontFamily) {
        // 清理字体名称，添加引号
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
      
      // 文本颜色（文本节点使用fills作为文字颜色）
      if (node.type === 'TEXT' && node.fills && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.visible !== false) {
          const color = this.rgbaToCSS(fill.color, fill.opacity);
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
      
      // Flex对齐方式（只在非默认值时添加）
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
      
      // Gap间距（使用CSS变量）
      if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
        const spacingVar = node.itemSpacing === 8 ? 'var(--spacing-sm)' :
                          node.itemSpacing === 16 ? 'var(--spacing-md)' :
                          node.itemSpacing === 24 ? 'var(--spacing-lg)' :
                          `${node.itemSpacing}px`;
        rules.push(`  gap: ${spacingVar};`);
      }
      
      // 处理布局包装
      if (node.layoutWrap === 'WRAP') {
        rules.push('  flex-wrap: wrap;');
      }
    } else if (node.children && node.children.length > 1) {
      // 如果有多个子元素但没有明确的布局模式，根据子元素位置判断
      const isHorizontal = this.detectHorizontalLayout(node);
      if (isHorizontal) {
        rules.push('  display: flex;');
        rules.push('  flex-direction: row;');
      } else if (node.children.length > 2) {
        // 只有多个子元素时才使用flex
        rules.push('  display: flex;');
        rules.push('  flex-direction: column;');
      }
    }

    // 处理定位和位置
    if (node.position) {
      if (node.position === 'ABSOLUTE') {
        rules.push('  position: absolute;');
        if (bbox) {
          // 计算相对于父元素的位置（需要父节点信息，这里简化处理）
          // 实际应该通过parent节点的absoluteBoundingBox计算
        }
      } else if (node.position === 'RELATIVE') {
        rules.push('  position: relative;');
      }
    }
    
    // 处理约束（constraints）- Figma的布局约束
    if (node.constraints) {
      const constraints = node.constraints;
      // 水平约束
      if (constraints.horizontal === 'MIN') {
        rules.push('  align-self: flex-start;');
      } else if (constraints.horizontal === 'CENTER') {
        rules.push('  align-self: center;');
      } else if (constraints.horizontal === 'MAX') {
        rules.push('  align-self: flex-end;');
      } else if (constraints.horizontal === 'STRETCH') {
        rules.push('  align-self: stretch;');
        if (bbox && bbox.width) {
          rules.push(`  width: 100%;`);
        }
      } else if (constraints.horizontal === 'SCALE') {
        // 缩放约束，保持比例
        if (bbox && bbox.width) {
          rules.push(`  width: 100%;`);
        }
      }
      
      // 垂直约束
      if (constraints.vertical === 'MIN') {
        rules.push('  align-self: flex-start;');
      } else if (constraints.vertical === 'CENTER') {
        rules.push('  align-self: center;');
      } else if (constraints.vertical === 'MAX') {
        rules.push('  align-self: flex-end;');
      } else if (constraints.vertical === 'STRETCH') {
        rules.push('  align-self: stretch;');
        if (bbox && bbox.height) {
          rules.push(`  height: 100%;`);
        }
      } else if (constraints.vertical === 'SCALE') {
        // 缩放约束，保持比例
        if (bbox && bbox.height) {
          rules.push(`  height: 100%;`);
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
   * 获取语义化的类名
   */
  getClassName(node, cssClass = false) {
    if (!node.name) return '';
    
    let name = this.toKebabCase(node.name);
    
    // 清理无意义的类名（如frame-数字、group等）
    if (/^frame-\d+$/.test(name) || name === 'group' || name === 'container') {
      // 尝试从子元素或上下文推断更有意义的名称
      name = this.inferSemanticName(node) || 'wrapper';
    }
    
    // 确保类名以字母开头（CSS要求）
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
   */
  inferSemanticName(node) {
    // 根据子元素推断名称
    if (node.children && node.children.length > 0) {
      const firstChild = node.children[0];
      if (firstChild.type === 'TEXT' && firstChild.characters) {
        const text = firstChild.characters.toLowerCase().substring(0, 20);
        return this.toKebabCase(text) || null;
      }
      
      // 检查是否有特定的子元素类型
      const hasButton = node.children.some(c => 
        (c.name || '').toLowerCase().includes('button')
      );
      if (hasButton) return 'button-group';
      
      const hasInput = node.children.some(c => 
        (c.name || '').toLowerCase().includes('input')
      );
      if (hasInput) return 'input-group';
    }
    
    // 根据布局模式推断
    if (node.layoutMode === 'HORIZONTAL') {
      return 'row';
    } else if (node.layoutMode === 'VERTICAL') {
      return 'column';
    }
    
    return null;
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
   * 转换为PascalCase（清理特殊字符）
   */
  toPascalCase(str) {
    if (!str) return 'Component';
    // 先清理所有非字母数字字符，保留空格和连字符用于分割
    let cleaned = str
      .replace(/[^a-zA-Z0-9\s-]+/g, '') // 移除所有特殊字符（保留空格和连字符）
      .trim();
    
    // 如果清理后为空，使用默认值
    if (!cleaned) return 'Component';
    
    // 转换为PascalCase
    return cleaned
      .replace(/[\s-]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[a-z]/, chr => chr.toUpperCase())
      .replace(/^[0-9]/, (match) => 'N' + match); // 如果以数字开头，添加前缀
  }

  /**
   * 转换为kebab-case（清理特殊字符）
   */
  toKebabCase(str) {
    if (!str) return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9-]+/g, '-') // 替换所有非字母数字字符为连字符
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '') // 移除开头和结尾的连字符
      .replace(/-+/g, '-') // 合并多个连字符
      .toLowerCase();
  }

  /**
   * 转换为camelCase（清理特殊字符，优化长名称）
   */
  toCamelCase(str) {
    if (!str) return '';
    // 先清理所有非字母数字字符，保留空格和连字符用于分割
    let cleaned = str
      .replace(/[^a-zA-Z0-9\s-]+/g, '') // 移除所有特殊字符（保留空格和连字符）
      .trim();
    
    // 如果清理后为空，使用默认值
    if (!cleaned) return 'item';
    
    // 转换为camelCase
    let camelCase = cleaned
      .replace(/[\s-]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, chr => chr.toLowerCase())
      .replace(/^[0-9]/, (match) => 'n' + match); // 如果以数字开头，添加前缀
    
    // 如果名称太长（超过30个字符），进行简化
    if (camelCase.length > 30) {
      // 尝试提取关键词
      const words = cleaned.toLowerCase().split(/[\s-]+/);
      const importantWords = words.filter(word => 
        word.length > 3 && 
        !['the', 'and', 'are', 'for', 'with', 'that', 'this', 'from', 'have', 'been'].includes(word)
      );
      
      if (importantWords.length > 0) {
        // 使用前3个重要单词
        const shortWords = importantWords.slice(0, 3);
        camelCase = shortWords
          .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
          .join('');
      } else {
        // 如果没有重要单词，直接截断
        camelCase = camelCase.substring(0, 30);
      }
      
      // 确保以字母开头
      if (!/^[a-zA-Z]/.test(camelCase)) {
        camelCase = 'item' + camelCase;
      }
    }
    
    return camelCase;
  }

  /**
   * 清理变量名，避免使用保留关键字
   */
  sanitizeVariableName(name) {
    if (!name) return 'item';
    
    // JavaScript/TypeScript保留关键字列表
    const reservedKeywords = new Set([
      'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
      'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
      'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch',
      'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
      'enum', 'implements', 'interface', 'let', 'package', 'private', 'protected',
      'public', 'static', 'await', 'abstract', 'boolean', 'byte', 'char', 'double',
      'final', 'float', 'goto', 'int', 'long', 'native', 'short', 'synchronized',
      'throws', 'transient', 'volatile'
    ]);
    
    // 如果名称是保留关键字，添加后缀
    if (reservedKeywords.has(name)) {
      return name + 'Value';
    }
    
    return name;
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
      const buttonId = this.sanitizeVariableName(this.toCamelCase(node.name || 'button'));
      interactiveElements.set(nodeId, {
        type: 'button',
        id: buttonId,
        name: node.name,
      });
      // 按钮通常不需要状态变量，只需要事件处理器
      // if (!stateVariables.find(v => v.id === buttonId)) {
      //   stateVariables.push({ id: buttonId, type: 'boolean', defaultValue: false });
      // }
      if (!eventHandlers.find(h => h.id === buttonId)) {
        eventHandlers.push({ id: buttonId, handlerName: 'handleClick' });
      }
    }
    
    // 检测输入框
    if (this.isInput(nodeName)) {
      const inputId = this.sanitizeVariableName(this.toCamelCase(node.name || 'input'));
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
      const accordionId = this.sanitizeVariableName(this.toCamelCase(node.name || 'accordion'));
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
      const toggleId = this.sanitizeVariableName(this.toCamelCase(node.name || 'toggle'));
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
        
        // 避免导入与当前组件同名的组件（防止循环导入和命名冲突）
        if (subComponentName === componentName) continue;
        
        const importPath = isSubComponent 
          ? `../${subComponentName}/${subComponentName}`
          : `./components/${subComponentName}/${subComponentName}`;
        componentImports.push(`import { ${subComponentName} } from '${importPath}';`);
      }
    }
    
    const componentImportsStr = componentImports.length > 0 
      ? componentImports.join('\n') + '\n' 
      : '';
    
    // 判断是否需要性能优化hooks
    const needsOptimization = this.stateVariables.length > 3 || this.eventHandlers.length > 3;
    const useMemoImport = needsOptimization ? ', useMemo' : '';
    const useCallbackImport = needsOptimization ? ', useCallback' : '';
    
    const imports = this.useTypeScript 
      ? `import React, { useState${useMemoImport}${useCallbackImport} } from 'react';
${componentImportsStr}import './${componentName}.css';
import type { ${componentName}Props${this.useObjectState ? `, ${componentName}State` : ''} } from './${componentName}.types';`
      : `import React, { useState${useMemoImport}${useCallbackImport} } from 'react';
${componentImportsStr}import './${componentName}.css';`;

    const componentSignature = this.useTypeScript
      ? `const ${componentName}: React.FC<${componentName}Props> = () => {`
      : `const ${componentName} = () => {`;

    // 判断是否使用对象状态（超过3个状态变量时使用对象）
    this.useObjectState = this.stateVariables.length > 3;
    
    // 生成状态声明（使用对象形式，更简洁）
    const stateDeclarations = this.stateVariables.length > 0 
      ? (() => {
          if (this.useObjectState) {
            // 多个状态时使用对象形式
            const stateType = this.useTypeScript 
              ? `<${componentName}State>`
              : '';
            const stateInit = this.stateVariables.map(v => {
              // 避免使用保留关键字作为属性名
              const safeId = this.sanitizeVariableName(v.id);
              const defaultValue = typeof v.defaultValue === 'string' ? `'${v.defaultValue}'` : v.defaultValue;
              return `    ${safeId}: ${defaultValue}`;
            }).join(',\n');
            return `  const [state, setState] = useState${stateType}({\n${stateInit}\n  });`;
          } else {
            // 少量状态时使用独立声明
            return this.stateVariables.map(v => {
              const safeId = this.sanitizeVariableName(v.id);
              const defaultValue = typeof v.defaultValue === 'string' ? `'${v.defaultValue}'` : v.defaultValue;
              const typeAnnotation = this.useTypeScript ? `<${v.type}>` : '';
              return `  const [${safeId}, set${this.toPascalCase(safeId)}] = useState${typeAnnotation}(${defaultValue});`;
            }).join('\n');
          }
        })()
      : '';

    // 生成事件处理函数（使用useCallback优化）
    const handlers = this.eventHandlers.map(h => {
      const stateVar = this.stateVariables.find(v => v.id === h.id);
      const interactiveElement = Array.from(this.interactiveElements.values()).find(el => el.id === h.id);
      
      const handlerName = `handle${this.toPascalCase(h.id)}`;
      const useCallbackWrapper = needsOptimization ? 'useCallback(' : '';
      const useCallbackDeps = needsOptimization ? ', [])' : '';
      
      // 根据交互元素类型生成不同的处理函数
      const safeId = this.sanitizeVariableName(h.id);
      
      if (interactiveElement?.type === 'input') {
        if (!stateVar) return ''; // 输入框必须有状态变量
        const setterName = this.useObjectState 
          ? `setState((prev: ${componentName}State) => ({ ...prev, ${safeId}: e.target.value }))`
          : `set${this.toPascalCase(h.id)}(e.target.value)`;
        return `  const ${handlerName}Change = ${useCallbackWrapper}(e: React.ChangeEvent<HTMLInputElement>) => {
    ${setterName};
  }${useCallbackDeps};`;
      } else if (interactiveElement?.type === 'accordion' || interactiveElement?.type === 'toggle') {
        if (!stateVar) return ''; // 折叠/切换元素必须有状态变量
        const setterName = this.useObjectState
          ? `setState((prev: ${componentName}State) => ({ ...prev, ${safeId}: !prev.${safeId} }))`
          : `set${this.toPascalCase(h.id)}(prev => !prev)`;
        return `  const ${handlerName}Toggle = ${useCallbackWrapper}() => {
    ${setterName};
  }${useCallbackDeps};`;
      } else if (interactiveElement?.type === 'button') {
        // 按钮不需要状态变量，只需要事件处理器
        return `  const ${handlerName} = ${useCallbackWrapper}() => {
    // TODO: 实现按钮点击逻辑
  }${useCallbackDeps};`;
      } else {
        // 其他类型，如果有状态变量则使用，否则只生成空处理器
        if (!stateVar) {
          return `  const ${handlerName} = ${useCallbackWrapper}() => {
    // TODO: 实现事件处理逻辑
  }${useCallbackDeps};`;
        }
        const setterName = this.useObjectState
          ? `setState((prev: ${componentName}State) => ({ ...prev, ${safeId}: !prev.${safeId} }))`
          : `set${this.toPascalCase(h.id)}(prev => !prev)`;
        return `  const ${handlerName} = ${useCallbackWrapper}() => {
    ${setterName};
  }${useCallbackDeps};`;
      }
    }).filter(Boolean).join('\n\n');

    const stateSection = stateDeclarations ? stateDeclarations + '\n' : '';
    const handlersSection = handlers ? handlers + '\n' : '';
    
    // 如果使用对象状态，添加解构（只在JSX中实际使用时才解构）
    // 注意：这里不生成解构，而是在JSX中直接使用 state.xxx，避免未使用变量的警告
    const stateDestructure = '';
    
    const exportStatement = isSubComponent 
      ? `export { ${componentName} };\nexport default ${componentName};`
      : `export default ${componentName};`;
    
    // 格式化JSX（确保正确的缩进）
    const formattedJSX = this.formatJSX(jsx);
    
    return `${imports}

${componentSignature}
${stateSection}${stateDestructure}${handlersSection}  return (
${formattedJSX}
  );
};

${exportStatement}
`;
  }

  /**
   * 生成TypeScript类型定义文件
   */
  generateTypesFile(componentName) {
    const stateInterface = this.stateVariables.length > 0
      ? `export interface ${componentName}State {
${this.stateVariables.map(v => {
        const safeId = this.sanitizeVariableName(v.id);
        return `  ${safeId}: ${v.type};`;
      }).join('\n')}
}

`
      : '';
    
    return `/**
 * ${componentName} 组件属性
 */
export interface ${componentName}Props {
  className?: string;
  // TODO: 根据实际需求添加props
}

${stateInterface}/**
 * ${componentName} 组件事件处理器类型
 */
export interface ${componentName}Handlers {
${this.eventHandlers.map(h => {
  const interactiveElement = Array.from(this.interactiveElements.values()).find(el => el.id === h.id);
  if (interactiveElement?.type === 'input') {
    return `  handle${this.toPascalCase(h.id)}Change: (e: React.ChangeEvent<HTMLInputElement>) => void;`;
  }
  return `  handle${this.toPascalCase(h.id)}: () => void;`;
}).join('\n')}
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
