import axios from 'axios';

export class FigmaAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://api.figma.com/v1';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Figma-Token': accessToken,
      },
    });
  }

  /**
   * 获取Figma文件数据
   * @param {string} fileKey - Figma文件ID
   * @param {string} nodeId - 可选的节点ID（用于获取特定节点）
   * @returns {Promise<Object>} 文件数据
   */
  async getFile(fileKey, nodeId = null) {
    try {
      let url = `/files/${fileKey}`;
      if (nodeId) {
        url += `/nodes?ids=${nodeId}`;
      }

      const response = await this.client.get(url);
      
      if (nodeId) {
        // 如果指定了节点ID，返回节点数据
        const nodes = response.data.nodes;
        const nodeKey = Object.keys(nodes)[0];
        return nodes[nodeKey].document;
      }
      
      return response.data.document;
    } catch (error) {
      if (error.response) {
        throw new Error(`Figma API错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * 获取文件的所有页面
   * @param {string} fileKey - Figma文件ID
   * @returns {Promise<Array>} 页面列表
   */
  async getFilePages(fileKey) {
    const fileData = await this.getFile(fileKey);
    return fileData.children || [];
  }

  /**
   * 获取图片资源
   * @param {string} fileKey - Figma文件ID
   * @param {Array<string>} nodeIds - 节点ID数组
   * @param {string} format - 图片格式 (png, jpg, svg, pdf)
   * @param {number} scale - 缩放比例
   * @returns {Promise<Object>} 图片URL映射
   */
  async getImages(fileKey, nodeIds, format = 'png', scale = 2) {
    try {
      const ids = nodeIds.join(',');
      const response = await this.client.get(
        `/images/${fileKey}?ids=${ids}&format=${format}&scale=${scale}`
      );
      return response.data.images;
    } catch (error) {
      if (error.response) {
        throw new Error(`获取图片失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
}
