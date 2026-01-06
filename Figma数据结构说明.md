# Figma API 数据结构说明

## 概述

Figma API 返回的数据是一个树形结构，每个节点（Node）代表设计稿中的一个元素。理解这个数据结构对于准确转换为React组件至关重要。

## 核心数据结构

### 1. 节点（Node）基础结构

```typescript
interface Node {
  id: string;                    // 节点唯一ID，格式如 "123:456"
  name: string;                  // 节点名称
  type: string;                  // 节点类型：FRAME, GROUP, TEXT, RECTANGLE, ELLIPSE, VECTOR, COMPONENT, INSTANCE等
  visible?: boolean;             // 是否可见
  locked?: boolean;              // 是否锁定
  children?: Node[];             // 子节点数组
  absoluteBoundingBox?: {       // 绝对位置和尺寸
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### 2. 样式相关属性

```typescript
interface StyleProperties {
  // 填充
  fills?: Fill[];                // 填充数组
  fillStyleId?: string;          // 填充样式ID
  
  // 描边
  strokes?: Paint[];              // 描边数组
  strokeWeight?: number;         // 描边宽度
  strokeAlign?: 'INSIDE' | 'CENTER' | 'OUTSIDE';  // 描边对齐
  strokeStyleId?: string;         // 描边样式ID
  
  // 效果
  effects?: Effect[];            // 效果数组（阴影、模糊等）
  effectStyleId?: string;        // 效果样式ID
  
  // 圆角
  cornerRadius?: number;         // 圆角半径
  cornerRadii?: number[];        // 各角圆角半径（如果不同）
  
  // 透明度
  opacity?: number;              // 透明度 0-1
  
  // 混合模式
  blendMode?: string;            // 混合模式
}
```

### 3. 布局相关属性

```typescript
interface LayoutProperties {
  // 布局模式
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';  // Auto Layout方向
  layoutWrap?: 'NO_WRAP' | 'WRAP';                 // 是否换行
  
  // 对齐方式
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH';
  
  // 间距
  itemSpacing?: number;          // 子元素间距
  paddingLeft?: number;          // 内边距
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  
  // 约束
  constraints?: {
    horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  };
}
```

### 4. 文本相关属性

```typescript
interface TextProperties {
  characters?: string;            // 文本内容
  style?: {
    fontFamily: string;           // 字体
    fontPostScriptName?: string;  // PostScript字体名
    fontSize: number;             // 字体大小
    fontWeight: number;           // 字重 100-900
    lineHeightPx?: number;        // 行高（像素）
    lineHeightPercent?: number;   // 行高（百分比）
    letterSpacing?: number;       // 字间距
    textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
    textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  };
  textStyleId?: string;          // 文本样式ID
}
```

### 5. 组件相关属性

```typescript
interface ComponentProperties {
  // Component类型特有
  componentPropertyDefinitions?: {
    [key: string]: {
      type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
      defaultValue?: any;
    };
  };
  
  // Instance类型特有
  componentId?: string;          // 引用的Component ID
  componentProperties?: {        // 组件属性值
    [key: string]: any;
  };
}
```

## 完整节点示例

```json
{
  "id": "123:456",
  "name": "Button",
  "type": "FRAME",
  "visible": true,
  "absoluteBoundingBox": {
    "x": 100,
    "y": 200,
    "width": 200,
    "height": 48
  },
  "fills": [
    {
      "type": "SOLID",
      "color": { "r": 0.2, "g": 0.4, "b": 0.8, "a": 1 },
      "opacity": 1,
      "visible": true
    }
  ],
  "strokes": [],
  "cornerRadius": 8,
  "layoutMode": "HORIZONTAL",
  "primaryAxisAlignItems": "CENTER",
  "counterAxisAlignItems": "CENTER",
  "paddingLeft": 16,
  "paddingRight": 16,
  "paddingTop": 12,
  "paddingBottom": 12,
  "itemSpacing": 8,
  "children": [
    {
      "id": "123:457",
      "name": "Label",
      "type": "TEXT",
      "characters": "Click me",
      "style": {
        "fontFamily": "Inter",
        "fontSize": 16,
        "fontWeight": 600,
        "lineHeightPx": 24
      },
      "fills": [
        {
          "type": "SOLID",
          "color": { "r": 1, "g": 1, "b": 1, "a": 1 }
        }
      ]
    }
  ]
}
```

## 数据结构的层次关系

```
Document (根节点)
  └── Page (页面)
      └── Frame/Component (框架/组件)
          └── Group/Frame (组/框架)
              └── Text/Rectangle/Vector (具体元素)
```

## 关键字段说明

### absoluteBoundingBox
- **用途**：元素的绝对位置和尺寸
- **注意**：这是相对于画布的绝对坐标，不是相对于父元素
- **计算相对位置**：需要减去父元素的 `absoluteBoundingBox.x/y`

### layoutMode
- **HORIZONTAL**：水平方向的Auto Layout（类似 `flex-direction: row`）
- **VERTICAL**：垂直方向的Auto Layout（类似 `flex-direction: column`）
- **NONE**：没有Auto Layout

### constraints
- **MIN/MAX**：固定在父容器的开始/结束位置
- **CENTER**：居中
- **STRETCH**：拉伸填充
- **SCALE**：按比例缩放

### fills 和 strokes
- 数组格式，可以有多个填充/描边
- `visible: false` 的填充/描边应该被忽略
- 颜色使用 RGBA 格式，值在 0-1 之间

## 最佳实践

1. **优先使用 layoutMode**：如果节点有 `layoutMode`，应该使用 Flexbox 布局
2. **计算相对位置**：对于绝对定位，需要计算相对于父元素的位置
3. **处理嵌套结构**：递归处理 `children` 数组
4. **识别组件**：`COMPONENT` 和 `INSTANCE` 类型应该被识别为可复用组件
5. **文本处理**：`TEXT` 类型的 `characters` 包含实际文本内容
6. **样式继承**：某些样式可能从父节点继承，需要处理

## 常见节点类型映射

| Figma类型 | HTML标签 | React组件建议 |
|----------|---------|-------------|
| FRAME | div | div（带布局样式） |
| GROUP | div | div（容器） |
| TEXT | p/span | p/span |
| RECTANGLE | div | div |
| ELLIPSE | div | div（border-radius: 50%） |
| VECTOR | svg | svg |
| COMPONENT | div | 自定义组件 |
| INSTANCE | div | 自定义组件（引用） |
