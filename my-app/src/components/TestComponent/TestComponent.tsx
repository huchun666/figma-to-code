import React, { useState } from 'react';
import { Sidebar } from '../Sidebar/Sidebar';
import './TestComponent.css';
import type { TestComponentProps } from './TestComponent.types';

const TestComponent: React.FC<TestComponentProps> = () => {
  const handleBrushesTypeStroke = () => {
    // TODO: 实现按钮点击逻辑
  };
  return (
  <Sidebar className="sidebar" />
  );
};

export { TestComponent };
export default TestComponent;
