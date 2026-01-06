# Figma to Code - 自动化设计稿转代码工具

一个强大的自动化工具，可以将Figma设计稿自动转换为前端代码（支持React、HTML、Vue）。

## 功能特性

- ✅ 自动从Figma API获取设计稿数据
- ✅ 支持多种输出格式（React、HTML、Vue）
- ✅ **支持React + TypeScript**（默认启用）
- ✅ **自动组件化拆分**（默认启用，将设计稿拆分为多个可复用组件）
- ✅ **自动识别交互元素**（按钮、输入框、折叠面板等）
- ✅ **自动生成状态管理和事件处理逻辑**
- ✅ 自动生成CSS样式
- ✅ 保留设计稿的布局、颜色、字体等样式
- ✅ 支持节点级别的代码生成

## 安装

```bash
npm install
```

## 配置

1. 复制配置文件模板：
```bash
cp config.example.json config.json
```

2. 编辑 `config.json`，填入你的Figma信息：

```json
{
  "figma": {
    "accessToken": "你的Figma访问令牌",
    "fileKey": "你的Figma文件ID",
    "nodeId": "可选：特定节点ID"
  },
  "output": {
    "format": "react",
    "outputDir": "./output",
    "cssFramework": "none"
  }
}
```

### 如何获取Figma Access Token（访问令牌）

**方法一：通过网页设置（推荐）**

1. 登录 [Figma](https://www.figma.com/)
2. 点击右上角的头像图标
3. 选择 **Settings（设置）**
4. 在左侧菜单中找到 **Account（账户）**
5. 滚动到 **Personal access tokens（个人访问令牌）** 部分
6. 点击 **Create new token（创建新令牌）**
7. 输入一个描述性的名称（例如：`figma-to-code-tool`）
8. 点击 **Create token（创建令牌）**
9. **重要**：立即复制生成的token（格式类似：`figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`），因为之后无法再次查看
10. 将token粘贴到 `config.json` 的 `accessToken` 字段

**方法二：直接访问链接**

直接访问：https://www.figma.com/settings 然后按照上述步骤4-10操作

**注意事项：**
- Token一旦创建，只显示一次，请妥善保存
- 如果忘记token，需要删除旧token并创建新的
- Token具有访问你所有Figma文件的权限，请勿泄露

### 如何获取Figma File Key（文件ID）

**步骤：**

1. 在浏览器中打开你想要转换的Figma设计文件
2. 查看浏览器地址栏的URL，格式如下：
   ```
   https://www.figma.com/file/XXXXXXXXXXXXXX/文件名
   ```
   或者
   ```
   https://www.figma.com/design/XXXXXXXXXXXXXX/文件名
   ```
3. URL中的 `XXXXXXXXXXXXXX` 部分就是 **File Key**（通常是一串字母和数字的组合）
4. 复制这个File Key到 `config.json` 的 `fileKey` 字段

**示例：**
- 如果URL是：`https://www.figma.com/file/abc123def456ghi789/我的设计稿`
- 那么 File Key 就是：`abc123def456ghi789`

**提示：**
- File Key通常在URL的 `/file/` 或 `/design/` 之后
- 如果文件在团队中，URL可能包含团队信息，但File Key的位置不变

### 如何获取Node ID（节点ID，可选）

如果你只想转换文件中的某个特定组件或节点，而不是整个文件，需要获取Node ID：

**步骤：**

1. 在Figma中打开你的设计文件
2. 在画布上选中你想要转换的节点/组件/框架
3. 查看浏览器地址栏，URL会自动更新，会看到类似这样的参数：
   ```
   https://www.figma.com/file/XXXXXXXXXXXXXX/文件名?node-id=123%3A456
   ```
   或者
   ```
   https://www.figma.com/design/XXXXXXXXXXXXXX/文件名?node-id=123%3A456
   ```
4. URL中的 `node-id=123%3A456` 中的 `123:456` 就是Node ID（注意：`%3A` 是URL编码的冒号 `:`）
5. 将 `123:456` 填入 `config.json` 的 `nodeId` 字段

**示例：**
- 如果URL是：`https://www.figma.com/file/abc123/设计?node-id=789%3A012`
- 那么 Node ID 就是：`789:012`

**提示：**
- 如果不填写 `nodeId`，将转换整个文件
- Node ID格式通常是 `数字:数字`
- 可以通过选中不同的元素来获取不同的Node ID

## 使用方法

```bash
npm start
```

或者：

```bash
node index.js
```

生成的代码会保存在 `output` 目录中。

## 输出格式

### React格式（TypeScript + 组件化）
默认生成组件化的代码结构：

**主组件：**
- `Component.tsx` - 主React TypeScript组件
- `Component.types.ts` - TypeScript类型定义
- `Component.css` - 主组件样式

**子组件（自动识别并拆分）：**
- `components/SubComponent/SubComponent.tsx` - 子组件
- `components/SubComponent/SubComponent.css` - 子组件样式
- `components/SubComponent/SubComponent.types.ts` - 子组件类型定义

**组件识别规则：**
工具会自动识别以下类型的节点并拆分为独立组件：
- **Figma Component/Instance**：Figma中的组件和实例
- **命名关键词**：包含 `card`、`item`、`list-item`、`header`、`footer`、`sidebar`、`modal`、`accordion`、`tab` 等关键词的节点
- **重复结构**：具有相似结构的多个子节点（如列表项）

**自动生成的交互逻辑：**
- **按钮**：自动识别包含 `button`、`btn`、`click` 等关键词的元素，生成点击事件处理
- **输入框**：自动识别包含 `input`、`textfield`、`form` 等关键词的元素，生成受控输入组件
- **折叠面板**：自动识别包含 `accordion`、`collapse` 等关键词的元素，生成展开/收起逻辑
- **切换开关**：自动识别包含 `toggle`、`switch` 等关键词的元素，生成切换状态逻辑

### HTML格式
生成单个 `index.html` 文件，包含内联样式。

### Vue格式
生成 `.vue` 单文件组件。

## 配置选项

### output.format
- `react` - 生成React组件（默认，支持TypeScript）
- `html` - 生成HTML文件
- `vue` - 生成Vue组件

### output.outputDir
输出目录路径，默认为 `./output`

### output.useTypeScript
是否使用TypeScript，默认为 `true`。设置为 `false` 将生成 `.jsx` 文件

### output.componentize
是否启用组件化拆分，默认为 `true`。设置为 `false` 将生成单个大组件文件

### output.cssFramework
CSS框架选项（未来支持），当前为 `none`

## 示例

### 转换整个文件
```json
{
  "figma": {
    "accessToken": "figd_xxx",
    "fileKey": "abc123def456"
  },
  "output": {
    "format": "react"
  }
}
```

### 转换特定节点
```json
{
  "figma": {
    "accessToken": "figd_xxx",
    "fileKey": "abc123def456",
    "nodeId": "123:456"
  },
  "output": {
    "format": "react"
  }
}
```

## 交互元素识别规则

工具会自动识别以下类型的交互元素：

| 元素类型 | 识别关键词 | 生成的功能 |
|---------|----------|-----------|
| 按钮 | button, btn, click, submit, confirm, cancel | onClick事件处理函数 |
| 输入框 | input, textfield, form, search, textarea | 受控输入组件（useState + onChange） |
| 折叠面板 | accordion, collapse, collapsible, expand | 展开/收起状态切换 |
| 切换开关 | toggle, switch | 布尔状态切换 |

**提示**：在Figma中为元素命名时，使用上述关键词可以帮助工具自动识别并生成相应的交互逻辑。

## 组件化说明

### 如何让工具识别组件

在Figma中为节点命名时，使用以下关键词可以帮助工具自动识别并拆分为组件：

**推荐命名模式：**
- `Card`、`ListItem`、`Item` - 卡片/列表项
- `Header`、`Footer`、`Sidebar` - 布局组件
- `Button`、`ButtonGroup` - 按钮组件
- `Input`、`InputGroup`、`FormGroup` - 表单组件
- `Modal`、`Dialog`、`Popup` - 弹窗组件
- `Accordion`、`Tab`、`TabItem` - 交互组件
- `Widget`、`Block`、`Panel` - 通用容器组件

**Figma原生组件：**
- 在Figma中创建的 Component 和 Instance 会自动识别为组件

### 组件目录结构示例

```
output/
├── MainComponent.tsx
├── MainComponent.css
├── MainComponent.types.ts
└── components/
    ├── Card/
    │   ├── Card.tsx
    │   ├── Card.css
    │   └── Card.types.ts
    ├── Header/
    │   ├── Header.tsx
    │   ├── Header.css
    │   └── Header.types.ts
    └── Button/
        ├── Button.tsx
        ├── Button.css
        └── Button.types.ts
```

## 注意事项

1. **API限制**：Figma API有速率限制，请避免频繁调用
2. **样式还原**：某些复杂的Figma效果可能无法完全还原
3. **图片资源**：当前版本不自动下载图片，需要手动处理
4. **响应式布局**：生成的代码可能需要手动调整响应式布局
5. **交互逻辑**：自动生成的交互逻辑是基础实现，可能需要根据实际需求进行调整
6. **TypeScript**：生成的TypeScript代码需要项目支持TypeScript，确保安装了相关依赖
7. **组件化**：组件拆分基于命名和结构分析，可能需要手动调整组件边界

## 未来计划

- [ ] 支持图片自动下载
- [ ] 支持更多CSS框架（Tailwind、Bootstrap等）
- [ ] 支持TypeScript
- [ ] 改进布局算法
- [ ] 支持动画和交互效果

## 许可证

MIT
