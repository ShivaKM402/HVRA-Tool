import React from 'react';
import './MapIcon.css';

export const MapIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  return (
    <div className="uiverse-map-wrapper" style={style}>
      <div className="uiverse-map-loader"></div>
    </div>
  );
};
