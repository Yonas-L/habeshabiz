import React, { createContext, useContext, useState, useCallback } from 'react';

interface BalancePrivacyContextType {
  isBalancesHidden: boolean;
  toggleHideBalances: () => void;
  setBalancesHidden: (hidden: boolean) => void;
  maskAmount: (amount: number | string | null | undefined, formattedValue?: string) => string;
}

const STORAGE_KEY = 'pos_dashboard_hide_balances';

const BalancePrivacyContext = createContext<BalancePrivacyContextType>({
  isBalancesHidden: false,
  toggleHideBalances: () => {},
  setBalancesHidden: () => {},
  maskAmount: (_amount, formattedValue) => String(formattedValue ?? ''),
});

export const BalancePrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBalancesHidden, setIsBalancesHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleHideBalances = useCallback(() => {
    setIsBalancesHidden((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // ignore storage error
        }
      }
      return next;
    });
  }, []);

  const setBalancesHidden = useCallback((hidden: boolean) => {
    setIsBalancesHidden(hidden);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, String(hidden));
      } catch {
        // ignore storage error
      }
    }
  }, []);

  const maskAmount = useCallback((amount: number | string | null | undefined, formattedValue?: string): string => {
    if (isBalancesHidden) {
      return '••••••';
    }
    if (formattedValue !== undefined) {
      return formattedValue;
    }
    if (amount === null || amount === undefined) {
      return '0';
    }
    if (typeof amount === 'number') {
      return amount.toLocaleString();
    }
    return String(amount);
  }, [isBalancesHidden]);

  return (
    <BalancePrivacyContext.Provider
      value={{
        isBalancesHidden,
        toggleHideBalances,
        setBalancesHidden,
        maskAmount,
      }}
    >
      {children}
    </BalancePrivacyContext.Provider>
  );
};

export const useBalancePrivacy = (): BalancePrivacyContextType => {
  return useContext(BalancePrivacyContext);
};
