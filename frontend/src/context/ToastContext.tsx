/**
 * HVRA Digital Platform — Toast Notification & History Context
 * Supports global toast stack (bottom-right) and persistent Notification Center history.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  timestamp: string;
  link?: string;
  duration?: number;
}

export interface NotificationItem extends ToastItem {
  read: boolean;
}

interface ToastContextType {
  toasts: ToastItem[];
  notifications: NotificationItem[];
  unreadCount: number;
  showToast: (toast: Omit<ToastItem, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const NOTIFICATIONS_STORAGE_KEY = 'hvra_notifications_history';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore JSON parse error
    }
    return [
      {
        id: 'init-1',
        title: 'Platform Initialized',
        message: 'HVRA Digital Platform is active with multi-hazard modules and Kerala administrative data.',
        type: 'info',
        timestamp: new Date().toISOString(),
        read: true,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // ignore storage error
    }
  }, [notifications]);

  const showToast = (toast: Omit<ToastItem, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const newToast: ToastItem = { ...toast, id, timestamp };

    setToasts((prev) => [...prev, newToast]);

    // Also persist into Notification Center history
    setNotifications((prev) => [
      { ...newToast, read: false },
      ...prev.slice(0, 49), // retain last 50
    ]);

    // Auto-dismiss toast
    const duration = toast.duration || 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ToastContext.Provider
      value={{
        toasts,
        notifications,
        unreadCount,
        showToast,
        removeToast,
        markAllRead,
        clearNotifications,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
