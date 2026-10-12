/**
 * AI Key Context — global state for the OpenAI API key.
 * Key is stored in sessionStorage so it never hits the server
 * and is cleared when the browser tab closes.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../services/aiService';

interface AIKeyContextType {
  apiKey: string;
  isKeySet: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const AIKeyContext = createContext<AIKeyContextType>({
  apiKey: '',
  isKeySet: false,
  setApiKey: () => {},
  clearApiKey: () => {},
});

export const AIKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string>(() => getStoredApiKey());

  const setApiKey = useCallback((key: string) => {
    setStoredApiKey(key);
    setApiKeyState(key);
  }, []);

  const clearApiKey = useCallback(() => {
    clearStoredApiKey();
    setApiKeyState('');
  }, []);

  return (
    <AIKeyContext.Provider value={{ apiKey, isKeySet: apiKey.length > 10, setApiKey, clearApiKey }}>
      {children}
    </AIKeyContext.Provider>
  );
};

export const useAIKey = () => useContext(AIKeyContext);
