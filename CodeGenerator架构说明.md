# CodeGenerator 代码生成架构说明

## 📋 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [核心流程](#核心流程)
- [模块详解](#模块详解)
- [代码生成流程](#代码生成流程)
- [配置选项](#配置选项)

---

## 概述

`CodeGenerator` 是一个企业级模块化代码生成器，负责将 Figma 设计文件转换为可用的 React/HTML/Vue 组件代码。它采用模块化架构，将不同职责分离到独立的分析器、转换器和生成器中。

### 主要功能

- ✅ 支持 React、HTML、Vue 三种输出格式
- ✅ 自动识别交互元素（按钮、输入框、折叠面板等）
- ✅ 智能组件化拆分
- ✅ TypeScript 支持
- ✅ 状态管理优化（单个状态 vs 对象状态）
- ✅ 性能优化（useMemo、useCallback）

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────┐
│           CodeGenerator (主控制器)              │
│  - 配置管理                                       │
│  - 流程协调                                       │
│  - 状态管理                                       │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────────┐
│  分析器层    │  │   转换器层      │
│            │  │                │
│ - Component│  │ - JSXTransformer│
│   Analyzer │  │ - CSSTransformer│
│            │  │                │
│ - Interactive│ │                │
│   Element   │ │                │
│   Analyzer  │ │                │
└──────┬──────┘ └──────┬─────────┘
       │                │
       └───────┬────────┘
               │
       ┌───────▼──────────┐
       │   生成器层        │
       │                  │
       │ - ReactTemplate  │
       │   Generator      │
       │ - HTMLTemplate   │
       │   Generator      │
       │ - VueTemplate    │
       │   Generator      │
       └──────────────────┘
```

### 核心模块

1. **CodeGenerator** - 主控制器，协调整个生成流程
2. **ComponentAnalyzer** - 组件分析器，识别可组件化的节点
3. **InteractiveElementAnalyzer** - 交互元素分析器，识别按钮、输入框等
4. **JSXTransformer** - JSX 转换器，将 Figma 节点转换为 JSX
5. **CSSTransformer** - CSS 转换器，生成样式代码
6. **ReactTemplateGenerator** - React 模板生成器，组装完整的组件代码

---

## 核心流程

### 1. 初始化阶段

```javascript
constructor(config = {}) {
  // 配置项
  this.format = config.format || 'react';           // 输出格式
  this.outputDir = config.outputDir || './output';  // 输出目录
  this.cssFramework = config.cssFramework || 'none'; // CSS框架
  this.useTypeScript = config.useTypeScript !== false; // TypeScript支持
  this.componentize = config.componentize !== false;   // 组件化
  
  // 状态管理
  this.interactiveElements = new Map();  // 交互元素映射
  this.stateVariables = [];               // 状态变量数组
  this.eventHandlers = [];                // 事件处理器数组
  this.components = new Map();            // 组件映射
  this.componentCounter = { value: 0 };  // 组件计数器
  this.useObjectState = false;            // 是否使用对象状态
}
```

### 2. 生成流程（以 React 为例）

```
generate(figmaData)
    ↓
generateReact(figmaData)
    ↓
┌─────────────────────────────────────┐
│ 1. 重置状态                          │
│    resetState()                      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. 预处理数据                        │
│    preprocessNode(figmaData)         │
│    获取组件名称: toPascalCase(name)  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. 分析交互元素                      │
│    analyzeInteractiveElements()      │
│    - 识别按钮、输入框、折叠面板等    │
│    - 生成状态变量和事件处理器        │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. 组件化分析（如果启用）            │
│    ComponentAnalyzer.identify()     │
│    - 识别可组件化的节点              │
│    - 标记重复结构                    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 5. JSX 转换                         │
│    JSXTransformer.transform()       │
│    - 将 Figma 节点转换为 JSX         │
│    - 处理交互元素                    │
│    - 处理组件引用                    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 6. CSS 生成                         │
│    CSSTransformer.generate()        │
│    - 生成样式代码                    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 7. 模板组装                         │
│    ReactTemplateGenerator.generate()│
│    - 组装导入语句                    │
│    - 生成状态声明                    │
│    - 生成事件处理器                  │
│    - 组装完整组件代码                │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 8. 子组件生成（如果启用组件化）      │
│    generateSubComponent()           │
│    - 为每个子组件独立生成代码        │
└──────────────┬──────────────────────┘
               ↓
           返回结果
```

---

## 模块详解

### 1. ComponentAnalyzer（组件分析器）

**职责**：识别可组件化的节点

**识别规则**：

1. **Figma Component/Instance 类型**
   ```javascript
   if (nodeType === 'component' || nodeType === 'instance') {
     shouldComponentize = true;
   }
   ```

2. **命名包含特定关键词**
   ```javascript
   const componentKeywords = [
     'card', 'item', 'list-item', 'row', 'cell',
     'header', 'footer', 'sidebar', 'nav', 'menu',
     'modal', 'dialog', 'popup', 'accordion', 'tab',
     'widget', 'block', 'box', 'container', 'wrapper'
   ];
   ```

3. **重复结构检测**
   - 有 3 个或更多子节点
   - 子节点结构相似（类型相同，子节点数量相近）

**输出**：`components Map`，包含组件ID和组件信息

---

### 2. InteractiveElementAnalyzer（交互元素分析器）

**职责**：识别和分析交互元素

**识别的元素类型**：

| 类型 | 关键词 | 状态变量 | 事件处理器 |
|------|--------|---------|-----------|
| **按钮** | button, btn, click, submit | ❌ 无 | `handleClick` |
| **输入框** | input, textfield, form, search | ✅ `string` | `handleChange` |
| **折叠面板** | accordion, collapse, expand | ✅ `boolean` | `handleToggle` |
| **切换开关** | toggle, switch | ✅ `boolean` | `handleToggle` |

**处理逻辑**：

```javascript
// 检测按钮
if (this.isButton(nodeName)) {
  interactiveElements.set(nodeId, {
    type: 'button',
    id: buttonId,
    name: node.name,
  });
  eventHandlers.push({ id: buttonId, handlerName: 'handleClick' });
}

// 检测输入框
if (this.isInput(nodeName)) {
  interactiveElements.set(nodeId, {
    type: 'input',
    id: inputId,
    name: node.name,
  });
  stateVariables.push({ id: inputId, type: 'string', defaultValue: '' });
  eventHandlers.push({ id: inputId, handlerName: 'handleChange' });
}
```

---

### 3. JSXTransformer（JSX 转换器）

**职责**：将 Figma 节点转换为 JSX 代码

**转换规则**：

1. **节点类型映射**
   ```javascript
   const nodeType = node.type?.toLowerCase() || 'div';
   let tagName = mapFigmaTypeToHTML(nodeType);
   // TEXT → p/span, RECTANGLE → div, etc.
   ```

2. **交互元素处理**
   ```javascript
   if (interactiveElement) {
     switch (interactiveElement.type) {
       case 'button':
         tagName = 'button';
         eventHandlers.push(`onClick={handle${toPascalCase(id)}}`);
         break;
       case 'input':
         tagName = 'input';
         props.push(`value={${stateRef}}`);
         eventHandlers.push(`onChange={handle${toPascalCase(id)}Change}`);
         break;
     }
   }
   ```

3. **组件引用处理**
   ```javascript
   const componentInfo = this.components.get(nodeId);
   if (componentInfo) {
     return `<${componentName}${componentProps} />`;
   }
   ```

4. **节点优化**
   - 跳过无意义的包装节点（无样式、无交互、单子节点）
   - 简化文本节点
   - 处理自闭合标签

---

### 4. ReactTemplateGenerator（React 模板生成器）

**职责**：组装完整的 React 组件代码

**生成内容**：

1. **导入语句**
   ```typescript
   import React, { useState, useMemo, useCallback } from 'react';
   import { SubComponent } from './components/SubComponent/SubComponent';
   import './Component.css';
   import type { ComponentProps, ComponentState } from './Component.types';
   ```

2. **状态声明**
   
   **单个状态模式**（状态变量 ≤ 3）：
   ```typescript
   const [articleInformation, setArticleInformation] = useState<string>('');
   const [additionalInformation, setAdditionalInformation] = useState<string>('');
   const [textToggleMedium, setTextToggleMedium] = useState<boolean>(false);
   ```
   
   **对象状态模式**（状态变量 > 3）：
   ```typescript
   const [state, setState] = useState<ComponentState>({
     articleInformation: '',
     additionalInformation: '',
     textToggleMedium: false,
     inputState: '',
     expand: false,
     toggle: false,
   });
   ```

3. **事件处理器**
   ```typescript
   const handleArticleInformationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
     setState((prev: ComponentState) => ({ ...prev, articleInformation: e.target.value }));
   }, []);
   
   const handleButtonClick = useCallback(() => {
     // TODO: 实现按钮点击逻辑
   }, []);
   ```

4. **组件结构**
   ```typescript
   const Component: React.FC<ComponentProps> = () => {
     // 状态声明
     // 事件处理器
     return (
       <div className="component">
         {/* JSX 内容 */}
       </div>
     );
   };
   
   export { Component };
   export default Component;
   ```

**性能优化**：

- 当状态变量 > 3 或事件处理器 > 3 时，自动使用 `useCallback` 和 `useMemo`
- 使用对象状态减少状态变量数量

---

### 5. TypeScript 类型生成

**生成的文件**：`Component.types.ts`

**内容结构**：

```typescript
/**
 * Component 组件属性
 */
export interface ComponentProps {
  className?: string;
  // TODO: 根据实际需求添加props
}

export interface ComponentState {
  articleInformation: string;
  additionalInformation: string;
  textToggleMedium: boolean;
  inputState: string;
  expand: boolean;
  toggle: boolean;
}

/**
 * Component 组件事件处理器类型
 */
export interface ComponentHandlers {
  handleArticleInformationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAdditionalInformationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTextToggleMedium: () => void;
  // ...
}
```

---

## 代码生成流程

### 主组件生成流程

```javascript
generateReact(figmaData) {
  // 1. 重置状态
  this.resetState();
  
  // 2. 预处理
  const processedData = preprocessNode(figmaData);
  const componentName = toPascalCase(processedData.name || 'Component');
  
  // 3. 分析交互元素
  this.analyzeInteractiveElements(processedData);
  // → 填充 interactiveElements, stateVariables, eventHandlers
  
  // 4. 组件化分析
  if (this.componentize) {
    ComponentAnalyzer.identify(...);
    // → 填充 components Map
  }
  
  // 5. JSX 转换
  const jsx = this.jsxTransformer.transform(processedData, 1, componentName);
  
  // 6. CSS 生成
  const css = this.cssTransformer.generate(processedData, componentName);
  
  // 7. 收集使用的组件
  const usedComponentIds = new Set();
  this.collectUsedComponents(figmaData, usedComponentIds);
  
  // 8. 生成主组件
  result[`components/${componentName}/${componentName}.tsx`] = 
    ReactTemplateGenerator.generate(...);
  result[`components/${componentName}/${componentName}.css`] = css;
  result[`components/${componentName}/${componentName}.types.ts`] = typesFile;
  
  // 9. 生成子组件
  for (const [componentId, componentInfo] of this.components.entries()) {
    const subResult = this.generateSubComponent(componentInfo, subComponentName);
    Object.assign(result, subResult);
  }
  
  return result;
}
```

### 子组件生成流程

```javascript
generateSubComponent(componentInfo, subComponentName) {
  // 1. 保存当前状态
  const originalState = this.saveState();
  
  // 2. 重置状态（为子组件创建独立上下文）
  this.resetState();
  
  // 3. 分析子组件的交互元素
  this.analyzeInteractiveElements(componentInfo.node);
  
  // 4. 识别子组件的子组件
  if (this.componentize) {
    ComponentAnalyzer.identify(componentInfo.node, ...);
  }
  
  // 5. 生成子组件代码
  const subJsx = this.jsxTransformer.transform(componentInfo.node, 1, subComponentName);
  const subCss = this.cssTransformer.generate(componentInfo.node, subComponentName);
  
  // 6. 组装子组件文件
  result[`components/${subComponentName}/${subComponentName}.tsx`] = 
    ReactTemplateGenerator.generate(...);
  result[`components/${subComponentName}/${subComponentName}.css`] = subCss;
  result[`components/${subComponentName}/${subComponentName}.types.ts`] = typesFile;
  
  // 7. 恢复主组件状态
  this.restoreState(originalState);
  
  return result;
}
```

---

## 配置选项

### CodeGenerator 配置

```javascript
const config = {
  format: 'react',              // 输出格式: 'react' | 'html' | 'vue'
  outputDir: './output',        // 输出目录
  cssFramework: 'none',        // CSS框架: 'none' | 'tailwind' | 'styled-components'
  useTypeScript: true,          // 是否使用 TypeScript
  componentize: true,          // 是否启用组件化
};

const generator = new CodeGenerator(config);
const result = generator.generate(figmaData);
```

### 输出文件结构

```
output/
├── components/
│   ├── MainComponent/
│   │   ├── MainComponent.tsx
│   │   ├── MainComponent.css
│   │   └── MainComponent.types.ts
│   ├── SubComponent1/
│   │   ├── SubComponent1.tsx
│   │   ├── SubComponent1.css
│   │   └── SubComponent1.types.ts
│   └── SubComponent2/
│       ├── SubComponent2.tsx
│       ├── SubComponent2.css
│       └── SubComponent2.types.ts
```

---

## 状态管理策略

### 单个状态模式（≤ 3 个状态变量）

```typescript
const [articleInformation, setArticleInformation] = useState<string>('');
const [additionalInformation, setAdditionalInformation] = useState<string>('');
const [textToggleMedium, setTextToggleMedium] = useState<boolean>(false);

// 使用
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setArticleInformation(e.target.value);
};
```

### 对象状态模式（> 3 个状态变量）

```typescript
const [state, setState] = useState<ComponentState>({
  articleInformation: '',
  additionalInformation: '',
  textToggleMedium: false,
  inputState: '',
  expand: false,
  toggle: false,
});

// 使用
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setState((prev: ComponentState) => ({ ...prev, articleInformation: e.target.value }));
};
```

**自动切换条件**：`this.useObjectState = this.stateVariables.length > 3;`

---

## 性能优化

### 自动优化策略

1. **useCallback 包装**
   - 当状态变量 > 3 或事件处理器 > 3 时，自动使用 `useCallback` 包装事件处理器

2. **useMemo 导入**
   - 当需要优化时，自动导入 `useMemo`（虽然当前未使用，但为未来扩展预留）

3. **组件化拆分**
   - 自动识别可组件化的节点，减少单个组件的复杂度

---

## 最佳实践

### 1. 命名规范

- 组件名称：PascalCase（`ProductRow`, `Checkout`）
- 变量名称：camelCase（`articleInformation`, `handleClick`）
- CSS 类名：kebab-case（`product-row`, `checkout`）

### 2. 组件化建议

- 使用有意义的节点名称（包含 `card`, `item`, `row` 等关键词）
- 将重复结构标记为组件
- 使用 Figma 的 Component/Instance 功能

### 3. 交互元素识别

- 按钮：名称包含 `button`, `btn`, `click`, `submit`
- 输入框：名称包含 `input`, `textfield`, `form`, `search`
- 折叠面板：名称包含 `accordion`, `collapse`, `expand`
- 切换开关：名称包含 `toggle`, `switch`

---

## 扩展性

### 添加新的输出格式

1. 创建新的模板生成器（如 `AngularTemplateGenerator.js`）
2. 在 `generate()` 方法中添加新的 case
3. 实现对应的生成逻辑

### 添加新的交互元素类型

1. 在 `InteractiveElementAnalyzer` 中添加识别逻辑
2. 在 `JSXTransformer` 中添加转换逻辑
3. 在 `ReactTemplateGenerator` 中添加事件处理器生成逻辑

---

## 总结

`CodeGenerator` 采用模块化、可扩展的架构设计，通过分离关注点实现了：

- ✅ **清晰的职责划分**：分析、转换、生成各司其职
- ✅ **灵活的配置**：支持多种输出格式和选项
- ✅ **智能的优化**：自动选择最佳的状态管理和性能优化策略
- ✅ **可扩展性**：易于添加新的功能和支持

整个系统通过状态管理和上下文隔离，确保了主组件和子组件的独立生成，避免了状态污染和命名冲突。
