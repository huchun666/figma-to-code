/**
 * 命名工具函数
 * 提供各种命名格式转换和清理功能
 */

/**
 * 转换为PascalCase（清理特殊字符）
 * @param {string} str - 输入字符串
 * @returns {string} PascalCase格式的字符串
 */
export function toPascalCase(str) {
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
 * @param {string} str - 输入字符串
 * @returns {string} kebab-case格式的字符串
 */
export function toKebabCase(str) {
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
 * @param {string} str - 输入字符串
 * @returns {string} camelCase格式的字符串
 */
export function toCamelCase(str) {
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
 * @param {string} name - 变量名
 * @returns {string} 清理后的变量名
 */
export function sanitizeVariableName(name) {
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
