/**
 * 代码生成器主类
 * 企业级模块化架构，整合所有功能模块
 */

import { preprocessNode } from '../utils/nodeUtils.js';
import { toPascalCase, sanitizeVariableName, toCamelCase } from '../utils/nameUtils.js';
import { ComponentAnalyzer } from '../analyzers/ComponentAnalyzer.js';
import { InteractiveElementAnalyzer } from '../analyzers/InteractiveElementAnalyzer.js';
import { JSXTransformer } from '../transformers/JSXTransformer.js';
import { CSSTransformer } from '../transformers/CSSTransformer.js';
import { ReactTemplateGenerator } from '../templates/ReactTemplateGenerator.js';
import { HTMLTemplateGenerator } from '../templates/HTMLTemplateGenerator.js';
import { VueTemplateGenerator } from '../templates/VueTemplateGenerator.js';

/**
 * 代码生成器类
 */
export class CodeGenerator {
  constructor(config = {}) {
    this.format = config.format || 'react';
    this.outputDir = config.outputDir || './output';
    this.cssFramework = config.cssFramework || 'none';
    this.useTypeScript = config.useTypeScript !== false;
    this.componentize = config.componentize !== false;
    this.componentName = config.componentName || null; // 自定义组件名
    
    // 状态管理
    this.interactiveElements = new Map();
    this.stateVariables = [];
    this.eventHandlers = [];
    this.components = new Map();
    this.componentCounter = { value: 0 };
    this.useObjectState = false;
    
    // 初始化转换器
    this.jsxTransformer = null;
    this.cssTransformer = new CSSTransformer();
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
   * @param {Object} figmaData - Figma节点数据
   * @returns {Object} 生成的文件内容映射
   */
  generateReact(figmaData) {
    // 重置状态
    this.resetState();
    
    // 预处理Figma数据
    const processedData = preprocessNode(figmaData);
    // 优先使用配置的组件名，否则使用Figma节点名称，最后使用默认值
    const componentName = this.componentName 
      ? toPascalCase(this.componentName)
      : toPascalCase(processedData.name || 'Component');
    
    // 分析交互元素
    this.analyzeInteractiveElements(processedData);
    
    // 如果启用组件化，识别并拆分组件
    if (this.componentize) {
      ComponentAnalyzer.identify(
        processedData, 
        0, 
        null, 
        this.components, 
        toPascalCase, 
        this.componentCounter
      );
    }
    
    // 初始化JSX转换器
    this.jsxTransformer = new JSXTransformer(
      this.interactiveElements,
      this.components,
      this.useObjectState
    );
    
    // 生成JSX和CSS
    const jsx = this.jsxTransformer.transform(processedData, 1, componentName);
    const css = this.cssTransformer.generate(processedData, componentName);
    
    const extension = this.useTypeScript ? 'tsx' : 'jsx';
    const typesFile = this.useTypeScript ? this.generateTypesFile(componentName) : null;

    // 收集主组件中使用的组件ID
    const usedComponentIds = new Set();
    const rootNodeId = figmaData.id;
    
    if (this.componentize) {
      this.collectUsedComponents(figmaData, usedComponentIds);
    }
    
    const result = {};
    
    // 如果启用组件化，所有组件都放在components目录下
    if (this.componentize) {
      result[`components/${componentName}/${componentName}.${extension}`] = 
        ReactTemplateGenerator.generate(
          componentName,
          jsx,
          this.interactiveElements,
          this.stateVariables,
          this.eventHandlers,
          this.components,
          this.useObjectState,
          this.useTypeScript,
          true,
          usedComponentIds,
          toPascalCase
        );
      result[`components/${componentName}/${componentName}.css`] = css;
      if (typesFile) {
        result[`components/${componentName}/${componentName}.types.ts`] = typesFile;
      }
    } else {
      result[`${componentName}.${extension}`] = ReactTemplateGenerator.generate(
        componentName,
        jsx,
        this.interactiveElements,
        this.stateVariables,
        this.eventHandlers,
        this.components,
        this.useObjectState,
        this.useTypeScript,
        false,
        usedComponentIds,
        toPascalCase
      );
      result[`${componentName}.css`] = css;
      if (typesFile) {
        result[`${componentName}.types.ts`] = typesFile;
      }
    }

    // 生成子组件文件
    if (this.componentize && this.components.size > 0) {
      const generatedComponents = new Set([componentName]);
      
      for (const [componentId, componentInfo] of this.components.entries()) {
        if (componentId === rootNodeId) continue;
        if (!usedComponentIds.has(componentId)) continue;
        
        const subComponentName = componentInfo.name;
        if (generatedComponents.has(subComponentName)) continue;
        generatedComponents.add(subComponentName);
        
        // 为子组件创建独立的上下文
        const subResult = this.generateSubComponent(componentInfo, subComponentName);
        Object.assign(result, subResult);
      }
    }

    return result;
  }

  /**
   * 生成子组件
   * @param {Object} componentInfo - 组件信息
   * @param {string} subComponentName - 子组件名称
   * @returns {Object} 生成的文件内容映射
   */
  generateSubComponent(componentInfo, subComponentName) {
    // 保存当前状态
    const originalState = this.saveState();
    
    // 为子组件创建独立的状态
    this.resetState();
    
    // 分析子组件的交互元素
    this.analyzeInteractiveElements(componentInfo.node);
    
    // 识别子组件的子组件
    if (this.componentize) {
      ComponentAnalyzer.identify(
        componentInfo.node,
        0,
        componentInfo.node.id,
        this.components,
        toPascalCase,
        this.componentCounter
      );
    }
    
    this.useObjectState = this.stateVariables.length > 3;
    
    // 初始化JSX转换器
    this.jsxTransformer = new JSXTransformer(
      this.interactiveElements,
      this.components,
      this.useObjectState
    );
    
    const subJsx = this.jsxTransformer.transform(componentInfo.node, 1, subComponentName);
    const subCss = this.cssTransformer.generate(componentInfo.node, subComponentName);
    
    const subUsedComponentIds = new Set();
    this.collectUsedComponents(componentInfo.node, subUsedComponentIds);
    
    const extension = this.useTypeScript ? 'tsx' : 'jsx';
    const result = {};
    
    result[`components/${subComponentName}/${subComponentName}.${extension}`] = 
      ReactTemplateGenerator.generate(
        subComponentName,
        subJsx,
        this.interactiveElements,
        this.stateVariables,
        this.eventHandlers,
        this.components,
        this.useObjectState,
        this.useTypeScript,
        true,
        subUsedComponentIds,
        toPascalCase
      );
    result[`components/${subComponentName}/${subComponentName}.css`] = subCss;
    
    if (this.useTypeScript) {
      result[`components/${subComponentName}/${subComponentName}.types.ts`] = 
        this.generateTypesFile(subComponentName);
    }
    
    // 恢复状态
    this.restoreState(originalState);
    
    return result;
  }

  /**
   * 生成HTML
   * @param {Object} figmaData - Figma节点数据
   * @returns {Object} 生成的文件内容映射
   */
  generateHTML(figmaData) {
    // 实现HTML生成逻辑
    return HTMLTemplateGenerator.generate(figmaData, this.cssTransformer);
  }

  /**
   * 生成Vue组件
   * @param {Object} figmaData - Figma节点数据
   * @returns {Object} 生成的文件内容映射
   */
  generateVue(figmaData) {
    // 实现Vue生成逻辑
    return VueTemplateGenerator.generate(figmaData, this.cssTransformer);
  }

  /**
   * 分析交互元素
   * @param {Object} node - Figma节点
   */
  analyzeInteractiveElements(node) {
    InteractiveElementAnalyzer.analyze(
      node,
      this.interactiveElements,
      this.stateVariables,
      this.eventHandlers,
      sanitizeVariableName,
      toCamelCase
    );
    this.useObjectState = this.stateVariables.length > 3;
  }

  /**
   * 收集使用的组件ID
   * @param {Object} node - Figma节点
   * @param {Set} usedIds - 使用的组件ID集合
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
   * 生成TypeScript类型定义文件
   * @param {string} componentName - 组件名称
   * @returns {string} 类型定义文件内容
   */
  generateTypesFile(componentName) {
    
    const stateInterface = this.stateVariables.length > 0
      ? `export interface ${componentName}State {
${this.stateVariables.map(v => {
        const safeId = sanitizeVariableName(v.id);
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
    return `  handle${toPascalCase(h.id)}Change: (e: React.ChangeEvent<HTMLInputElement>) => void;`;
  }
  return `  handle${toPascalCase(h.id)}: () => void;`;
}).join('\n')}
}
`;
  }

  /**
   * 重置状态
   */
  resetState() {
    this.interactiveElements.clear();
    this.stateVariables = [];
    this.eventHandlers = [];
    this.components.clear();
    this.componentCounter.value = 0;
    this.useObjectState = false;
  }

  /**
   * 保存状态
   * @returns {Object} 保存的状态
   */
  saveState() {
    return {
      interactiveElements: new Map(this.interactiveElements),
      stateVariables: [...this.stateVariables],
      eventHandlers: [...this.eventHandlers],
      components: new Map(this.components),
      componentCounter: { value: this.componentCounter.value },
      useObjectState: this.useObjectState
    };
  }

  /**
   * 恢复状态
   * @param {Object} state - 要恢复的状态
   */
  restoreState(state) {
    this.interactiveElements = state.interactiveElements;
    this.stateVariables = state.stateVariables;
    this.eventHandlers = state.eventHandlers;
    this.components = state.components;
    this.componentCounter = state.componentCounter;
    this.useObjectState = state.useObjectState;
  }
}
