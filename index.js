import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { FigmaAPI } from './src/figma-api.js';
import { CodeGenerator } from './src/generators/CodeGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    // 读取配置
    const configPath = path.join(__dirname, 'config.json');
    if (!await fs.pathExists(configPath)) {
      console.error('❌ 配置文件不存在！请先复制 config.example.json 为 config.json 并填入你的Figma访问令牌');
      process.exit(1);
    }

    const config = await fs.readJson(configPath);
    
    if (!config.figma.accessToken || config.figma.accessToken === 'YOUR_FIGMA_ACCESS_TOKEN') {
      console.error('❌ 请在 config.json 中设置你的 Figma Access Token');
      process.exit(1);
    }

    if (!config.figma.fileKey || config.figma.fileKey === 'YOUR_FIGMA_FILE_KEY') {
      console.error('❌ 请在 config.json 中设置你的 Figma File Key');
      process.exit(1);
    }

    console.log('🚀 开始从Figma获取设计稿...');

    // 初始化Figma API客户端
    const figmaAPI = new FigmaAPI(config.figma.accessToken);
    
    // 获取文件数据
    const fileData = await figmaAPI.getFile(config.figma.fileKey, config.figma.nodeId);
    // console.log("fileData: ", JSON.stringify(fileData));
    console.log('✅ 成功获取Figma设计稿数据');
    console.log(`📄 文件名: ${fileData.name}`);

    // 初始化代码生成器（默认使用TypeScript和组件化）
    const codeGenerator = new CodeGenerator({
      ...config.output,
      useTypeScript: config.output.useTypeScript !== false, // 默认启用TypeScript
      componentize: config.output.componentize !== false, // 默认启用组件化
    });

    // 生成代码
    console.log('🔨 开始生成代码...');
    const generatedCode = codeGenerator.generate(fileData);

    // 确保输出目录存在
    const outputDir = path.resolve(__dirname, config.output.outputDir || './output');
    await fs.ensureDir(outputDir);

    // 保存生成的文件
    for (const [filename, content] of Object.entries(generatedCode)) {
      const filePath = path.join(outputDir, filename);
      // 确保文件所在目录存在
      const fileDir = path.dirname(filePath);
      await fs.ensureDir(fileDir);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ 已生成: ${filename}`);
    }

    console.log(`\n🎉 代码生成完成！输出目录: ${outputDir}`);
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    if (error.response) {
      console.error('API响应:', error.response.data);
    }
    process.exit(1);
  }
}

main();
