import React, { createContext, useContext, useState } from 'react';

// Create the context
const WalletContext = createContext();

// Create a provider component
export const WalletProvider = ({ children }) => {
  const [netWorth, setNetWorth] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [assetBreakdown, setAssetBreakdown] = useState({
    totalAssets: 0,
    assetsWithValue: 0,
    assetsWithoutValue: 0
  });

  // Update net worth and related data
  const updateNetWorth = (value, breakdown = {}) => {
    console.log(`Updating netWorth to: ${value}`);
    
    // Use functional updates to avoid stale state issues
    setNetWorth(value);
    setLastUpdated(new Date());
    
    if (breakdown) {
      console.log(`Updating asset breakdown:`, breakdown);
      setAssetBreakdown(prevBreakdown => ({
        ...prevBreakdown,
        ...breakdown
      }));
    }
  };

  // Format currency with commas and 2 decimal places
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <WalletContext.Provider 
      value={{ 
        netWorth, 
        updateNetWorth, 
        lastUpdated,
        assetBreakdown,
        formatCurrency
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// Create a custom hook to use the wallet context
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export default WalletContext;