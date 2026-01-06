/**
 * React模板生成器
 * 负责生成React组件的完整代码模板
 */

import { sanitizeVariableName, toPascalCase } from '../utils/nameUtils.js';
import { JSXTransformer } from '../transformers/JSXTransformer.js';

/**
 * React模板生成器类
 */
export class ReactTemplateGenerator {
  /**
   * 生成React组件模板
   * @param {string} componentName - 组件名称
   * @param {string} jsx - JSX代码
   * @param {Map} interactiveElements - 交互元素映射
   * @param {Array} stateVariables - 状态变量数组
   * @param {Array} eventHandlers - 事件处理器数组
   * @param {Map} components - 组件映射
   * @param {boolean} useObjectState - 是否使用对象状态
   * @param {boolean} useTypeScript - 是否使用TypeScript
   * @param {boolean} isSubComponent - 是否为子组件
   * @param {Set} usedComponentIds - 使用的组件ID集合
   * @param {Function} toPascalCase - 转换为PascalCase的函数
   * @returns {string} React组件代码
   */
  static generate(
    componentName,
    jsx,
    interactiveElements,
    stateVariables,
    eventHandlers,
    components,
    useObjectState,
    useTypeScript,
    isSubComponent = false,
    usedComponentIds = null,
    toPascalCaseFn = toPascalCase
  ) {
    // 生成子组件的导入
    const componentImports = [];
    if (components && components.size > 0) {
      for (const [componentId, componentInfo] of components.entries()) {
        if (usedComponentIds && !usedComponentIds.has(componentId)) continue;
        
        const subComponentName = componentInfo.name;
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
    const needsOptimization = stateVariables.length > 3 || eventHandlers.length > 3;
    const useMemoImport = needsOptimization ? ', useMemo' : '';
    const useCallbackImport = needsOptimization ? ', useCallback' : '';
    
    const imports = useTypeScript 
      ? `import React, { useState${useMemoImport}${useCallbackImport} } from 'react';
${componentImportsStr}import './${componentName}.css';
import type { ${componentName}Props${useObjectState ? `, ${componentName}State` : ''} } from './${componentName}.types';`
      : `import React, { useState${useMemoImport}${useCallbackImport} } from 'react';
${componentImportsStr}import './${componentName}.css';`;

    const componentSignature = useTypeScript
      ? `const ${componentName}: React.FC<${componentName}Props> = () => {`
      : `const ${componentName} = () => {`;

    // 生成状态声明
    const stateDeclarations = stateVariables.length > 0 
      ? (() => {
          if (useObjectState) {
            const stateType = useTypeScript 
              ? `<${componentName}State>`
              : '';
            const stateInit = stateVariables.map(v => {
              const safeId = sanitizeVariableName(v.id);
              const defaultValue = typeof v.defaultValue === 'string' ? `'${v.defaultValue}'` : v.defaultValue;
              return `    ${safeId}: ${defaultValue}`;
            }).join(',\n');
            return `  const [state, setState] = useState${stateType}({\n${stateInit}\n  });`;
          } else {
            return stateVariables.map(v => {
              const safeId = sanitizeVariableName(v.id);
              const defaultValue = typeof v.defaultValue === 'string' ? `'${v.defaultValue}'` : v.defaultValue;
              const typeAnnotation = useTypeScript ? `<${v.type}>` : '';
              return `  const [${safeId}, set${toPascalCaseFn(safeId)}] = useState${typeAnnotation}(${defaultValue});`;
            }).join('\n');
          }
        })()
      : '';

    // 生成事件处理函数
    const handlers = eventHandlers.map(h => {
      const stateVar = stateVariables.find(v => v.id === h.id);
      const interactiveElement = Array.from(interactiveElements.values()).find(el => el.id === h.id);
      
      const handlerName = `handle${toPascalCaseFn(h.id)}`;
      const useCallbackWrapper = needsOptimization ? 'useCallback(' : '';
      const useCallbackDeps = needsOptimization ? ', [])' : '';
      const safeId = sanitizeVariableName(h.id);
      
      if (interactiveElement?.type === 'input') {
        if (!stateVar) return '';
        const setterName = useObjectState 
          ? `setState((prev: ${componentName}State) => ({ ...prev, ${safeId}: e.target.value }))`
          : `set${toPascalCaseFn(h.id)}(e.target.value)`;
        return `  const ${handlerName}Change = ${useCallbackWrapper}(e: React.ChangeEvent<HTMLInputElement>) => {
    ${setterName};
  }${useCallbackDeps};`;
      } else if (interactiveElement?.type === 'accordion' || interactiveElement?.type === 'toggle') {
        if (!stateVar) return '';
        const setterName = useObjectState
          ? `setState((prev: ${componentName}State) => ({ ...prev, ${safeId}: !prev.${safeId} }))`
          : `set${toPascalCaseFn(h.id)}(prev => !prev)`;
        return `  const ${handlerName}Toggle = ${useCallbackWrapper}() => {
    ${setterName};
  }${useCallbackDeps};`;
      } else if (interactiveElement?.type === 'button') {
        return `  const ${handlerName} = ${useCallbackWrapper}() => {
    // TODO: 实现按钮点击逻辑
  }${useCallbackDeps};`;
      } else {
        if (!stateVar) {
          return `  const ${handlerName} = ${useCallbackWrapper}() => {
    // TODO: 实现事件处理逻辑
  }${useCallbackDeps};`;
        }
        const setterName = useObjectState
          ? `setState((prev: ${componentName}State) => ({ ...prev, ${safeId}: !prev.${safeId} }))`
          : `set${toPascalCaseFn(h.id)}(prev => !prev)`;
        return `  const ${handlerName} = ${useCallbackWrapper}() => {
    ${setterName};
  }${useCallbackDeps};`;
      }
    }).filter(Boolean).join('\n\n');

    const stateSection = stateDeclarations ? stateDeclarations + '\n' : '';
    const handlersSection = handlers ? handlers + '\n' : '';
    
    const exportStatement = isSubComponent 
      ? `export { ${componentName} };\nexport default ${componentName};`
      : `export default ${componentName};`;
    
    // 格式化JSX
    const transformer = new JSXTransformer(interactiveElements, components, useObjectState);
    const formattedJSX = transformer.format(jsx);
    
    return `${imports}

${componentSignature}
${stateSection}${handlersSection}  return (
${formattedJSX}
  );
};

${exportStatement}
`;
  }
}
