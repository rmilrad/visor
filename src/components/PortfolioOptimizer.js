import React, { useMemo, useEffect } from 'react';
import './PortfolioOptimizer.css';
import { useWallet } from '../context/WalletContext';

/**
 * PortfolioOptimizer component - Displays portfolio optimization suggestions
 * @param {Object} props - Component props
 * @param {Array} props.userAssets - Array of user's assets with symbols and balances
 */
const PortfolioOptimizer = ({ userAssets = [] }) => {
  // Use the global wallet context for netWorth
  const { netWorth, formatCurrency, lastUpdated, assetBreakdown } = useWallet();
  
  // Log netWorth changes for debugging
  useEffect(() => {
    console.log('PortfolioOptimizer - netWorth:', netWorth);
    console.log('PortfolioOptimizer - assetBreakdown:', assetBreakdown);
  }, [netWorth, assetBreakdown]);
  
  // Format the last updated time
  const formatLastUpdated = (date) => {
    if (!date) return 'Not available';
    
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    }).format(date);
  };
  
  // Calculate total value from userAssets for comparison
  const calculateTotalFromAssets = () => {
    let total = 0;
    userAssets.forEach(asset => {
      if (asset.usdValue && !isNaN(asset.usdValue)) {
        total += asset.usdValue;
      }
    });
    return total;
  };
  
  // Log asset values for debugging
  useEffect(() => {
    if (userAssets && userAssets.length > 0) {
      console.log('PortfolioOptimizer - User assets:', userAssets);
      console.log('PortfolioOptimizer - Calculated total from assets:', calculateTotalFromAssets());
    }
  }, [userAssets]);
  
  // Fallback to calculating from userAssets if netWorth is not available
  const portfolioSummary = useMemo(() => {
    // Calculate total from assets for comparison
    const totalFromAssets = calculateTotalFromAssets();
    
    console.log('PortfolioOptimizer - Comparing netWorth vs totalFromAssets:', netWorth, totalFromAssets);
    
    // If we have global netWorth and it's reasonable, use it
    if (netWorth > 0 && (totalFromAssets === 0 || Math.abs(netWorth - totalFromAssets) / netWorth < 0.1)) {
      console.log('PortfolioOptimizer - Using global netWorth:', netWorth);
      return {
        totalValue: netWorth,
        assetCount: assetBreakdown.totalAssets || userAssets.length,
        assetsWithValue: assetBreakdown.assetsWithValue || 0,
        assetsWithoutValue: assetBreakdown.assetsWithoutValue || 0,
        hasValueData: true
      };
    }
    
    // If netWorth seems off but we have asset data, use that instead
    if (totalFromAssets > 0) {
      console.log('PortfolioOptimizer - Using calculated total from assets:', totalFromAssets);
      return {
        totalValue: totalFromAssets,
        assetCount: userAssets.length,
        assetsWithValue: userAssets.filter(a => a.usdValue && !isNaN(a.usdValue)).length,
        assetsWithoutValue: userAssets.filter(a => !a.usdValue || isNaN(a.usdValue)).length,
        hasValueData: true
      };
    }
    
    // Otherwise calculate from userAssets (fallback)
    if (!userAssets || userAssets.length === 0) {
      return {
        totalValue: 0,
        assetCount: 0,
        hasValueData: false
      };
    }

    let totalValue = 0;
    let assetsWithValue = 0;
    let assetsWithoutValue = 0;

    userAssets.forEach(asset => {
      if (!asset.balance || asset.balance === 'Error') return;

      const balance = parseFloat(asset.balance);
      if (isNaN(balance) || balance <= 0) return;

      let assetValue = 0;
      
      if (typeof asset.usdValue === 'number' && !isNaN(asset.usdValue)) {
        assetValue = asset.usdValue;
      } else if (asset.price && typeof asset.price === 'number') {
        assetValue = balance * asset.price;
      }
      
      if (assetValue > 0) {
        totalValue += assetValue;
        assetsWithValue++;
      } else {
        assetsWithoutValue++;
      }
    });

    return {
      totalValue,
      assetCount: userAssets.length,
      assetsWithValue,
      assetsWithoutValue,
      hasValueData: assetsWithValue > 0
    };
  }, [netWorth, assetBreakdown, userAssets, calculateTotalFromAssets]);

  // If no assets, show a message
  if (!userAssets || userAssets.length === 0) {
    return (
      <div className="portfolio-optimizer">
        <p className="no-data-message">
          Connect your wallet and load your assets to see optimization suggestions.
        </p>
      </div>
    );
  }

  // If assets don't have USD values, show a message
  if (!portfolioSummary.hasValueData) {
    return (
      <div className="portfolio-optimizer">
        <p className="no-data-message">
          Unable to calculate portfolio value. Price data may be unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="portfolio-optimizer">
      <div className="portfolio-summary">
        <h3>Portfolio Summary</h3>
        <div className="summary-item total-value">
          <span className="summary-label">Total Portfolio Value:</span>
          <span className="summary-value">{formatCurrency(portfolioSummary.totalValue)}</span>
        </div>
        {lastUpdated && (
          <div className="summary-item last-updated">
            <span className="summary-label">Last Updated:</span>
            <span className="summary-value">{formatLastUpdated(lastUpdated)}</span>
          </div>
        )}
        <div className="summary-item">
          <span className="summary-label">Total Assets:</span>
          <span className="summary-value">{portfolioSummary.assetCount}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Assets with Price Data:</span>
          <span className="summary-value">{portfolioSummary.assetsWithValue}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Assets without Price Data:</span>
          <span className="summary-value">{portfolioSummary.assetsWithoutValue}</span>
        </div>
      </div>
      
      <div className="optimization-suggestions">
        <h3>Optimization Suggestions</h3>
        <p>Based on your current portfolio:</p>
        <ul className="suggestions-list">
          <li>Consider consolidating smaller positions to reduce gas fees on future transactions</li>
          <li>Explore staking opportunities for your larger holdings to earn passive income</li>
          <li>Check lending platforms for competitive interest rates on your stablecoin holdings</li>
        </ul>
        <p className="note">Note: These are general suggestions. For personalized advice, consult a financial advisor.</p>
      </div>
    </div>
  );
};

export default PortfolioOptimizer;