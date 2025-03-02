import React, { useState, lazy, Suspense, memo } from 'react';
import './InvestmentOpportunities.css';

// Lazy load components to improve initial load time
const StakingData = lazy(() => import('./StakingData'));
const LendingData = lazy(() => import('./LendingData'));
const WalletSymbols = lazy(() => import('./WalletSymbols'));
const PortfolioOptimizer = lazy(() => import('./PortfolioOptimizer'));

// Loading fallback component
const TabLoader = memo(() => (
  <div className="tab-loader">
    <p>Loading data...</p>
  </div>
));

/**
 * InvestmentOpportunities component - Container for StakingData and LendingData with navigation tabs
 * Optimized with lazy loading and memoization
 *
 * @param {Object} props - Component props
 * @param {string} props.walletAddress - The connected wallet address
 * @param {Array} props.userAssets - Array of user's assets with symbols
 */
const InvestmentOpportunities = memo(({ walletAddress, userAssets = [] }) => {
  // State to track the active tab
  const [activeTab, setActiveTab] = useState('staking');

  // Tab button click handler
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    
    // Store the last active tab in sessionStorage
    try {
      sessionStorage.setItem('investment-active-tab', tab);
    } catch (e) {
      console.warn('Error saving active tab to sessionStorage:', e);
    }
  };

  // Load the last active tab from sessionStorage on initial render
  React.useEffect(() => {
    try {
      const savedTab = sessionStorage.getItem('investment-active-tab');
      if (savedTab) {
        setActiveTab(savedTab);
      }
    } catch (e) {
      console.warn('Error reading active tab from sessionStorage:', e);
    }
  }, []);

  return (
    <div className="investment-opportunities">
      <h3>Investment Opportunities</h3>
      
      {/* Navigation tabs */}
      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'staking' ? 'active' : ''}`}
          onClick={() => handleTabClick('staking')}
        >
          Staking
        </button>
        <button
          className={`tab-button ${activeTab === 'lending' ? 'active' : ''}`}
          onClick={() => handleTabClick('lending')}
        >
          Lending
        </button>
        <button
          className={`tab-button ${activeTab === 'wallet-symbols' ? 'active' : ''}`}
          onClick={() => handleTabClick('wallet-symbols')}
        >
          Wallet Symbols
        </button>
        <button
          className={`tab-button ${activeTab === 'optimize' ? 'active' : ''}`}
          onClick={() => handleTabClick('optimize')}
        >
          Optimize
        </button>
      </div>
      
      {/* Tab content with Suspense for lazy loading */}
      <div className="tab-content">
        <Suspense fallback={<TabLoader />}>
          {activeTab === 'staking' && (
            <StakingData walletAddress={walletAddress} userAssets={userAssets} />
          )}
          {activeTab === 'lending' && (
            <LendingData walletAddress={walletAddress} userAssets={userAssets} />
          )}
          {activeTab === 'wallet-symbols' && (
            <WalletSymbols userAssets={userAssets} />
          )}
          {activeTab === 'optimize' && (
            <PortfolioOptimizer userAssets={userAssets} />
          )}
        </Suspense>
      </div>
    </div>
  );
});

export default InvestmentOpportunities;