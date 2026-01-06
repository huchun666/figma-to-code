# Figma API数据与React组件结合的最佳实践

## 核心思路

将Figma的**设计数据结构**转换为React的**组件结构**，关键在于：

1. **理解Figma的树形结构** → 映射到React的组件树
2. **提取样式信息** → 转换为CSS样式
3. **识别交互元素** → 添加React事件处理
4. **优化组件结构** → 减少嵌套，提高可维护性

## 数据流程

```
Figma API
  ↓
原始节点数据（树形结构）
  ↓
数据预处理（计算相对位置、过滤无效数据）
  ↓
组件识别（识别可复用组件）
  ↓
样式提取（转换为CSS）
  ↓
JSX生成（转换为React组件）
  ↓
React组件代码
```

## 关键映射关系

### 1. 节点类型映射

| Figma类型 | React实现 | 说明 |
|----------|----------|------|
| `FRAME` | `<div>` + Flex布局 | 容器，通常有布局模式 |
| `GROUP` | `<div>` | 分组，通常可简化 |
| `TEXT` | `<p>` / `<span>` | 文本节点 |
| `RECTANGLE` | `<div>` | 矩形，通常作为容器 |
| `COMPONENT` | 自定义组件 | 可复用的组件 |
| `INSTANCE` | 自定义组件（实例） | 组件的实例 |

### 2. 布局模式映射

```javascript
// Figma Auto Layout → CSS Flexbox
{
  layoutMode: 'HORIZONTAL'  →  flex-direction: row
  layoutMode: 'VERTICAL'    →  flex-direction: column
  primaryAxisAlignItems     →  justify-content
  counterAxisAlignItems     →  align-items
  itemSpacing               →  gap
  paddingLeft/Right/Top/Bottom → padding
}
```

### 3. 样式属性映射

```javascript
// Figma样式 → CSS样式
{
  fills[0].color           →  background-color
  strokes[0]               →  border
  cornerRadius             →  border-radius
  opacity                  →  opacity
  effects                  →  box-shadow / filter
  style.fontSize           →  font-size
  style.fontWeight         →  font-weight
  style.lineHeightPx       →  line-height
}
```

## 优化策略

### 1. 数据预处理

在转换前对数据进行预处理，可以提高转换质量：

```javascript
// ✅ 好的做法
function preprocessNode(node, parentNode) {
  // 计算相对位置
  if (parentNode && node.absoluteBoundingBox) {
    node.relativeBoundingBox = calculateRelative(node, parentNode);
  }
  
  // 过滤不可见元素
  node.fills = node.fills?.filter(f => f.visible !== false);
  node.strokes = node.strokes?.filter(s => s.visible !== false);
  
  // 递归处理子节点
  if (node.children) {
    node.children = node.children.map(child => 
      preprocessNode(child, node)
    );
  }
  
  return node;
}
```

### 2. 智能组件识别

根据多个因素识别组件：

```javascript
function shouldBeComponent(node) {
  // 1. Figma原生组件
  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    return true;
  }
  
  // 2. 命名模式
  const name = node.name.toLowerCase();
  if (['card', 'button', 'input', 'modal'].some(kw => name.includes(kw))) {
    return true;
  }
  
  // 3. 结构特征
  if (node.layoutMode && 
      node.children?.length >= 2 &&
      hasClearBoundary(node)) {
    return true;
  }
  
  return false;
}
```

### 3. 样式优化

生成更准确的样式：

```javascript
function generateStyles(node) {
  const styles = [];
  
  // 优先使用layoutMode
  if (node.layoutMode) {
    styles.push(`display: flex;`);
    styles.push(`flex-direction: ${node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'};`);
    
    // 对齐方式
    if (node.primaryAxisAlignItems) {
      styles.push(`justify-content: ${mapAlign(node.primaryAxisAlignItems)};`);
    }
    
    // 间距
    if (node.itemSpacing) {
      styles.push(`gap: ${node.itemSpacing}px;`);
    }
  }
  
  // 处理约束
  if (node.constraints) {
    if (node.constraints.horizontal === 'STRETCH') {
      styles.push('width: 100%;');
    }
    if (node.constraints.vertical === 'STRETCH') {
      styles.push('height: 100%;');
    }
  }
  
  return styles;
}
```

### 4. 减少嵌套

智能跳过无意义的节点：

```javascript
function shouldSkipNode(node) {
  // GROUP类型且无样式，只有一个子元素
  if (node.type === 'GROUP' && 
      !hasStyle(node) && 
      node.children?.length === 1) {
    return true;
  }
  
  // FRAME类型但只是容器作用
  if (node.type === 'FRAME' && 
      !node.layoutMode && 
      !hasStyle(node) &&
      node.children?.length === 1) {
    return true;
  }
  
  return false;
}
```

## 实际应用示例

### 示例：按钮组件转换

**Figma数据：**
```json
{
  "id": "123:456",
  "name": "Primary Button",
  "type": "FRAME",
  "layoutMode": "HORIZONTAL",
  "primaryAxisAlignItems": "CENTER",
  "counterAxisAlignItems": "CENTER",
  "paddingLeft": 24,
  "paddingRight": 24,
  "paddingTop": 12,
  "paddingBottom": 12,
  "itemSpacing": 8,
  "cornerRadius": 8,
  "fills": [{
    "type": "SOLID",
    "color": { "r": 0.2, "g": 0.4, "b": 0.8 },
    "visible": true
  }],
  "children": [
    {
      "type": "TEXT",
      "characters": "Click me",
      "style": {
        "fontSize": 16,
        "fontWeight": 600
      }
    }
  ]
}
```

**生成的React组件：**
```tsx
// Button.tsx
import React from 'react';
import './Button.css';

const Button: React.FC = () => {
  return (
    <button className="button">
      Click me
    </button>
  );
};

export default Button;
```

```css
/* Button.css */
.button {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 12px 24px;
  gap: 8px;
  border-radius: 8px;
  background-color: rgba(51, 102, 204, 1);
  border: none;
  cursor: pointer;
}

.button p {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
```

## 常见问题处理

### 1. 绝对定位
```javascript
// Figma使用绝对坐标，需要转换为相对定位
if (node.absoluteBoundingBox && parentNode?.absoluteBoundingBox) {
  const relativeX = node.absoluteBoundingBox.x - parentNode.absoluteBoundingBox.x;
  const relativeY = node.absoluteBoundingBox.y - parentNode.absoluteBoundingBox.y;
  
  styles.push(`position: absolute;`);
  styles.push(`left: ${relativeX}px;`);
  styles.push(`top: ${relativeY}px;`);
}
```

### 2. 文本样式
```javascript
// 文本节点的fills是文字颜色，不是背景色
if (node.type === 'TEXT' && node.fills?.[0]) {
  const color = rgbaToCSS(node.fills[0].color, node.fills[0].opacity);
  styles.push(`color: ${color};`);
}
```

### 3. 嵌套组件
```javascript
// 避免循环引用
if (componentName === currentComponentName) {
  // 不生成组件标签，继续正常渲染
  return renderAsDiv(node);
}
```

## 工具改进建议

1. **添加数据验证**：验证Figma数据的完整性
2. **缓存机制**：缓存已计算的样式和位置
3. **配置化**：允许用户自定义转换规则
4. **错误处理**：提供有意义的错误信息
5. **增量更新**：只转换变更的节点

## 总结

将Figma API数据转换为React组件的关键是：

1. **理解数据结构**：熟悉Figma节点的各种属性
2. **智能映射**：将Figma概念映射到React/CSS概念
3. **优化处理**：预处理数据，减少嵌套，提高代码质量
4. **持续改进**：根据实际使用情况不断优化转换规则

通过这种方式，可以生成更准确、更易维护的React组件代码。
