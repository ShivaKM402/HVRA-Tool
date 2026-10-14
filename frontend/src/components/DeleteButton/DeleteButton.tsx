import React from 'react';
import { useAuth } from '@/context/AuthContext';
import './DeleteButton.css';

interface DeleteButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({ onClick, title = 'Delete item', className = '', ...props }) => {
  const { canDelete } = useAuth();
  if (!canDelete) {
    return null;
  }

  return (
    <button 
      aria-label={title} 
      title={title}
      className={`delete-button-uiverse ${className}`} 
      onClick={onClick}
      {...props}
    >
      <svg
        className="trash-svg"
        viewBox="0 -10 64 74"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g id="trash-can">
          <rect
            x="16"
            y="24"
            width="32"
            height="30"
            rx="3"
            ry="3"
            fill="#e74c3c"
          ></rect>

          <g transform-origin="12 18" id="lid-group">
            <rect
              x="12"
              y="12"
              width="40"
              height="6"
              rx="2"
              ry="2"
              fill="#c0392b"
            ></rect>
            <rect
              x="26"
              y="8"
              width="12"
              height="4"
              rx="2"
              ry="2"
              fill="#c0392b"
            ></rect>
          </g>
        </g>
      </svg>
    </button>
  );
};
