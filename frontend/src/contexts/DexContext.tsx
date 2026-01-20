import React, { createContext, useContext, useMemo } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { SuiService } from '../services/sui';
import { SUI_CONFIG } from '../config/sui';

interface DexContextType {
  service: SuiService;
  config: typeof SUI_CONFIG;
}

const DexContext = createContext<DexContextType | null>(null);

export const DexProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Create a singleton SuiService instance
  const service = useMemo(() => new SuiService('testnet'), []);

  return (
    <DexContext.Provider value={{ service, config: SUI_CONFIG }}>
      {children}
    </DexContext.Provider>
  );
};

export const useDex = () => {
  const context = useContext(DexContext);
  if (!context) throw new Error("useDex must be used within DexProvider");
  return context;
};
