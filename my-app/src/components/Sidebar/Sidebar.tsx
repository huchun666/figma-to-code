import React, { useState } from 'react';
import './Sidebar.css';
import type { SidebarProps } from './Sidebar.types';

const Sidebar: React.FC<SidebarProps> = () => {
  const handleBrushesTypeStroke = () => {
    // TODO: 实现按钮点击逻辑
  };
  return (
  <div className="sidebar">
    <div className="copy">
      <p  className="draw-with-brushes">Draw with brushes</p>
      <div className="list">
        <button  className="brushes-are-a-new-type-of-stroke-that-feel-more-hand-drawn-to-use-brushes" onClick={handleBrushesTypeStroke}>Brushes are a new type of stroke that feel more hand-drawn.   To use brushes:</button>
        <div className="step">
          <div className="number">
            <div className="bullet"></div>
            <p  className="el-1">1</p>
          </div>
          <div className="column">
            <div className="list-item">
              <p  className="select-the-brush-tool-in-the-toolbar-or-use-shortcut-b-to-open-the-secondary-brush-menu">Select the brush tool in the toolbar or use shortcut B to open the secondary brush menu.</p>
            </div>
          </div>
        </div>
        <div className="step">
          <div className="number">
            <div className="bullet"></div>
            <p  className="el-2">2</p>
          </div>
          <div className="column">
            <div className="list-item">
              <p  className="choose-which-brush-you-d-like-to-use-as-well-as-its-weight-and-color">Choose which brush you’d like to use, as well as its weight and color.</p>
            </div>
          </div>
        </div>
        <div className="step">
          <div className="number">
            <div className="bullet"></div>
            <p  className="el-3">3</p>
          </div>
          <div className="column">
            <div className="list-item">
              <p  className="start-drawing">Start drawing.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p  className="try-it-out">Try it out</p>
  </div>
  );
};

export { Sidebar };
export default Sidebar;
