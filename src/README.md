# 代码生成器模块化架构

## 目录结构

```
src/
├── utils/                    # 工具函数模块
│   ├── nameUtils.js         # 命名转换工具（PascalCase, camelCase, kebab-case等）
│   ├── styleUtils.js        # 样式工具（颜色转换、CSS变量等）
│   └── nodeUtils.js         # 节点处理工具（预处理、类型映射等）
│
├── analyzers/                # 分析器模块
│   ├── ComponentAnalyzer.js # 组件识别分析器
│   └── InteractiveElementAnalyzer.js # 交互元素分析器
│
├── transformers/             # 转换器模块
│   ├── JSXTransformer.js    # JSX转换器
│   └── CSSTransformer.js    # CSS转换器
│
├── templates/                # 模板生成器模块
│   ├── ReactTemplateGenerator.js  # React模板生成器
│   ├── HTMLTemplateGenerator.js   # HTML模板生成器
│   └── VueTemplateGenerator.js   # Vue模板生成器
│
├── generators/               # 生成器模块
│   └── CodeGenerator.js     # 主代码生成器（整合所有模块）
│
├── figma-api.js             # Figma API客户端
└── code-generator.js        # 旧版代码生成器（已废弃，保留用于兼容）
```

## 模块职责

### utils/ - 工具函数模块
- **nameUtils.js**: 提供命名转换功能
  - `toPascalCase()`: 转换为PascalCase
  - `toCamelCase()`: 转换为camelCase
  - `toKebabCase()`: 转换为kebab-case
  - `sanitizeVariableName()`: 清理变量名，避免保留关键字

- **styleUtils.js**: 提供样式相关工具
  - `rgbaToCSS()`: RGBA转CSS颜色
  - `getSpacingVar()`: 获取间距CSS变量
  - `getRadiusVar()`: 获取圆角CSS变量
  - `getBaseResetStyles()`: 获取基础重置样式

- **nodeUtils.js**: 提供节点处理工具
  - `preprocessNode()`: 预处理Figma节点
  - `mapFigmaTypeToHTML()`: 映射Figma类型到HTML标签
  - `isSelfClosing()`: 判断是否为自闭合标签
  - `escapeHTML()`: 转义HTML
  - `detectHorizontalLayout()`: 检测水平布局

### analyzers/ - 分析器模块
- **ComponentAnalyzer.js**: 组件识别分析器
  - `identify()`: 识别可组件化的节点
  - `isComponentCandidate()`: 判断是否为组件候选
  - `hasRepeatedStructure()`: 检查是否有重复结构

- **InteractiveElementAnalyzer.js**: 交互元素分析器
  - `analyze()`: 分析交互元素
  - `isButton()`: 判断是否为按钮
  - `isInput()`: 判断是否为输入框
  - `isAccordion()`: 判断是否为手风琴
  - `isToggle()`: 判断是否为切换开关

### transformers/ - 转换器模块
- **JSXTransformer.js**: JSX转换器
  - `transform()`: 将Figma节点转换为JSX
  - `format()`: 格式化JSX代码
  - `shouldSkipNode()`: 判断是否跳过节点
  - `hasMeaningfulStyle()`: 判断是否有有意义的样式

- **CSSTransformer.js**: CSS转换器
  - `generate()`: 生成CSS样式
  - `nodeToCSS()`: 将节点转换为CSS
  - `extractStyles()`: 提取样式
  - `getStyleKey()`: 获取样式键（用于合并相似样式）

### templates/ - 模板生成器模块
- **ReactTemplateGenerator.js**: React模板生成器
  - `generate()`: 生成React组件完整代码

- **HTMLTemplateGenerator.js**: HTML模板生成器
  - `generate()`: 生成HTML文件

- **VueTemplateGenerator.js**: Vue模板生成器
  - `generate()`: 生成Vue组件

### generators/ - 生成器模块
- **CodeGenerator.js**: 主代码生成器
  - 整合所有模块
  - 提供统一的代码生成接口
  - 管理状态和上下文

## 设计原则

1. **单一职责原则**: 每个模块只负责一个特定功能
2. **依赖注入**: 通过构造函数或参数传递依赖
3. **可测试性**: 每个模块都可以独立测试
4. **可扩展性**: 易于添加新的转换器或生成器
5. **向后兼容**: 保持与旧版API的兼容性

## 使用示例

```javascript
import { CodeGenerator } from './src/generators/CodeGenerator.js';

const generator = new CodeGenerator({
  format: 'react',
  useTypeScript: true,
  componentize: true
});

const code = generator.generate(figmaData);
```

## 迁移指南

从旧版 `code-generator.js` 迁移到新架构：

1. 更新导入路径：
   ```javascript
   // 旧版
   import { CodeGenerator } from './src/code-generator.js';
   
   // 新版
   import { CodeGenerator } from './src/generators/CodeGenerator.js';
   ```

2. API保持不变，无需修改调用代码

3. 如需扩展功能，可以：
   - 添加新的转换器到 `transformers/`
   - 添加新的分析器到 `analyzers/`
   - 添加新的模板生成器到 `templates/`
