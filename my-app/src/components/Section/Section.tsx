import React, { useState } from 'react';
import './Section.css';
import type { SectionProps } from './Section.types';

const Section: React.FC<SectionProps> = () => {
  const [contentButton, setContentButton] = useState<boolean>(false);
  const handleContentButton = () => {
    // TODO: 实现按钮点击逻辑
  };
  return (
<div className="section">
  <div className="content">
    <p  className="text-eyebrow">Eyebrow</p>
    <p  className="text-title">Brushes &amp; strokes</p>
    <p  className="description">Explore the new brush styles and other stroke updates</p>
    <button className="content-button" onClick={handleContentButton}>
      <p  className="cta">Continue</p>
      <p  className="node-I20-9731-41-24-41-27">-&gt;</p>
    </button>
  </div>
</div>
  );
};

export { Section };
export default Section;
