/**
 * 节点工具函数
 * 提供Figma节点相关的处理和转换功能
 */

/**
 * 预处理Figma数据，优化数据结构
 * @param {Object} node - Figma节点
 * @param {Object} parentNode - 父节点
 * @returns {Object} 处理后的节点
 */
export function preprocessNode(node, parentNode = null) {
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
      .map(child => preprocessNode(child, node))
      .filter(child => child !== null);
  }

  return node;
}

/**
 * 将Figma类型映射到HTML标签
 * @param {string} type - Figma节点类型
 * @returns {string} HTML标签名
 */
export function mapFigmaTypeToHTML(type) {
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
  return mapping[type?.toLowerCase()] || 'div';
}

/**
 * 判断是否为自闭合标签
 * @param {string} tagName - HTML标签名
 * @returns {boolean} 是否为自闭合标签
 */
export function isSelfClosing(tagName) {
  return ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tagName);
}

/**
 * 转义HTML
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
export function escapeHTML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 检测水平布局
 * @param {Object} node - Figma节点
 * @returns {boolean} 是否为水平布局
 */
export function detectHorizontalLayout(node) {
  if (!node.children || node.children.length < 2) return false;
  
  const firstChild = node.children[0];
  const secondChild = node.children[1];
  
  if (!firstChild.absoluteBoundingBox || !secondChild.absoluteBoundingBox) return false;
  
  // 如果第二个子元素的y坐标与第一个相近（在同一行），则是水平布局
  const yDiff = Math.abs(secondChild.absoluteBoundingBox.y - firstChild.absoluteBoundingBox.y);
  const xDiff = Math.abs(secondChild.absoluteBoundingBox.x - firstChild.absoluteBoundingBox.x);
  
  return yDiff < 10 && xDiff > 10; // y坐标相近且x坐标不同，说明是水平排列
}
