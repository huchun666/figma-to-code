/**
 * 组件分析器
 * 负责识别可组件化的节点和重复结构
 */

/**
 * 组件分析器类
 */
export class ComponentAnalyzer {
  /**
   * 识别可组件化的节点
   * @param {Object} node - Figma节点
   * @param {number} depth - 当前深度
   * @param {string} parentId - 父节点ID
   * @param {Map} components - 组件映射
   * @param {Function} toPascalCase - 转换为PascalCase的函数
   * @param {number} componentCounter - 组件计数器引用
   */
  static identify(node, depth, parentId, components, toPascalCase, componentCounter) {
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
      componentName = toPascalCase(node.name || `Component${++componentCounter.value}`);
    }
    // 2. 命名包含特定关键词
    else if (this.isComponentCandidate(nodeName)) {
      shouldComponentize = true;
      componentName = toPascalCase(node.name || `Component${++componentCounter.value}`);
    }
    // 3. 有多个子节点且结构复杂
    else if (node.children && node.children.length >= 3 && depth < 3) {
      if (this.hasRepeatedStructure(node)) {
        shouldComponentize = true;
        componentName = toPascalCase(node.name || `Component${++componentCounter.value}`);
      }
    }
    
    if (shouldComponentize && componentName) {
      components.set(nodeId, {
        name: componentName,
        node: node,
        parentId: parentId,
      });
      // 标记为组件，不再递归处理其子节点
      return;
    }
    
    // 递归处理子节点
    if (node.children) {
      node.children.forEach(child => {
        this.identify(child, depth + 1, nodeId, components, toPascalCase, componentCounter);
      });
    }
  }

  /**
   * 判断节点名称是否暗示应该组件化
   * @param {string} name - 节点名称
   * @returns {boolean} 是否应该组件化
   */
  static isComponentCandidate(name) {
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
   * @param {Object} node - Figma节点
   * @returns {boolean} 是否有重复结构
   */
  static hasRepeatedStructure(node) {
    if (!node.children || node.children.length < 2) return false;
    
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
}
