/**
 * Section 组件属性
 */
export interface SectionProps {
  className?: string;
  // TODO: 根据实际需求添加props
}

export interface SectionState {
  contentButton: boolean;
}

/**
 * Section 组件事件处理器类型
 */
export interface SectionHandlers {
  handleContentButton: () => void;
}
