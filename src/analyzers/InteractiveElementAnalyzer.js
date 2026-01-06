/**
 * 交互元素分析器
 * 负责识别和分析Figma设计中的交互元素（按钮、输入框、折叠面板等）
 */

/**
 * 交互元素分析器类
 */
export class InteractiveElementAnalyzer {
  /**
   * 分析交互元素
   * @param {Object} node - Figma节点
   * @param {Map} interactiveElements - 交互元素映射
   * @param {Array} stateVariables - 状态变量数组
   * @param {Array} eventHandlers - 事件处理器数组
   * @param {Function} sanitizeVariableName - 变量名清理函数
   * @param {Function} toCamelCase - 转换为camelCase的函数
   */
  static analyze(node, interactiveElements, stateVariables, eventHandlers, sanitizeVariableName, toCamelCase) {
    if (!node) return;
    
    const nodeName = (node.name || '').toLowerCase();
    const nodeId = node.id;
    
    // 检测按钮
    if (this.isButton(nodeName)) {
      const buttonId = sanitizeVariableName(toCamelCase(node.name || 'button'));
      interactiveElements.set(nodeId, {
        type: 'button',
        id: buttonId,
        name: node.name,
      });
      // 按钮通常不需要状态变量，只需要事件处理器
      eventHandlers.push({ id: buttonId, handlerName: 'handleClick' });
    }
    
    // 检测输入框
    if (this.isInput(nodeName)) {
      const inputId = sanitizeVariableName(toCamelCase(node.name || 'input'));
      interactiveElements.set(nodeId, {
        type: 'input',
        id: inputId,
        name: node.name,
      });
      stateVariables.push({ id: inputId, type: 'string', defaultValue: '' });
      eventHandlers.push({ id: inputId, handlerName: 'handleChange' });
    }
    
    // 检测可折叠/展开元素
    if (this.isAccordion(nodeName) || this.isCollapsible(nodeName)) {
      const accordionId = sanitizeVariableName(toCamelCase(node.name || 'accordion'));
      interactiveElements.set(nodeId, {
        type: 'accordion',
        id: accordionId,
        name: node.name,
      });
      stateVariables.push({ id: accordionId, type: 'boolean', defaultValue: false });
      eventHandlers.push({ id: accordionId, handlerName: 'handleToggle' });
    }
    
    // 检测切换开关
    if (this.isToggle(nodeName) || this.isSwitch(nodeName)) {
      const toggleId = sanitizeVariableName(toCamelCase(node.name || 'toggle'));
      interactiveElements.set(nodeId, {
        type: 'toggle',
        id: toggleId,
        name: node.name,
      });
      stateVariables.push({ id: toggleId, type: 'boolean', defaultValue: false });
      eventHandlers.push({ id: toggleId, handlerName: 'handleToggle' });
    }
    
    // 递归处理子节点
    if (node.children) {
      node.children.forEach(child => {
        this.analyze(child, interactiveElements, stateVariables, eventHandlers, sanitizeVariableName, toCamelCase);
      });
    }
  }

  /**
   * 判断是否为按钮
   * @param {string} name - 节点名称
   * @returns {boolean} 是否为按钮
   */
  static isButton(name) {
    const buttonKeywords = ['button', 'btn', 'click', 'submit', 'confirm', 'cancel', 'ok', 'apply'];
    return buttonKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 判断是否为输入框
   * @param {string} name - 节点名称
   * @returns {boolean} 是否为输入框
   */
  static isInput(name) {
    const inputKeywords = ['input', 'textfield', 'text-field', 'form', 'search', 'textarea'];
    return inputKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 判断是否为手风琴/折叠面板
   * @param {string} name - 节点名称
   * @returns {boolean} 是否为手风琴
   */
  static isAccordion(name) {
    return name.includes('accordion') || name.includes('折叠') || name.includes('展开');
  }

  /**
   * 判断是否为可折叠元素
   * @param {string} name - 节点名称
   * @returns {boolean} 是否为可折叠元素
   */
  static isCollapsible(name) {
    return name.includes('collapse') || name.includes('collapsible') || name.includes('expand');
  }

  /**
   * 判断是否为切换开关
   * @param {string} name - 节点名称
   * @returns {boolean} 是否为切换开关
   */
  static isToggle(name) {
    return name.includes('toggle') || name.includes('switch');
  }

  /**
   * 判断是否为开关
   * @param {string} name - 节点名称
   * @returns {boolean} 是否为开关
   */
  static isSwitch(name) {
    return name.includes('switch') || name.includes('开关');
  }
}
