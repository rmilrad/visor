import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WalletSymbols.css';

// Local proxy server configuration
const PROXY_API_URL = 'http://localhost:3005';

/**
 * WalletSymbols component - Displays just the asset symbols from the user's wallet with prices
 * @param {Object} props - Component props
 * @param {Array} props.userAssets - Array of user's assets with symbols
 */
const WalletSymbols = ({ userAssets = [] }) => {
  const [tokenPrices, setTokenPrices] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchStatus, setFetchStatus] = useState({});

  // Function to fetch prices for multiple tokens in a batch
  const fetchTokenPrices = async (symbols) => {
    try {
      // Check sessionStorage cache first
      const cacheKey = 'wallet-symbols-price-cache';
      const cachedData = sessionStorage.getItem(cacheKey);
      let cachedPrices = {};
      
      if (cachedData) {
        try {
          const { prices, timestamp } = JSON.parse(cachedData);
          // Use cache if less than 2 minutes old
          if (Date.now() - timestamp < 2 * 60 * 1000) {
            console.log('Using cached price data for wallet symbols');
            
            // Update state with cached prices
            setTokenPrices(prices);
            
            // Update fetch status for each symbol
            const newFetchStatus = {};
            symbols.forEach(symbol => {
              newFetchStatus[symbol] = prices[symbol] ? 'success' : 'error';
            });
            setFetchStatus(newFetchStatus);
            
            return Object.keys(prices).length;
          }
          cachedPrices = prices; // Keep cached prices to use for symbols we can't fetch
        } catch (e) {
          console.warn('Error parsing cached price data:', e);
        }
      }
      
      // Batch symbols into groups of 5
      const batchSize = 5;
      const newPrices = { ...cachedPrices };
      let successCount = 0;
      
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const batchSymbols = batch.join(',');
        
        console.log(`Fetching prices for batch: ${batchSymbols}`);
        
        // Update status to loading for this batch
        const loadingStatus = {};
        batch.forEach(symbol => {
          loadingStatus[symbol] = 'loading';
        });
        setFetchStatus(prev => ({ ...prev, ...loadingStatus }));
        
        try {
          // Make API request to our local proxy server
          const response = await axios.get(`${PROXY_API_URL}/api/prices?symbols=${batchSymbols}`, {
            timeout: 5000
          });
          
          if (response.status === 200) {
            // Process each symbol in the response
            batch.forEach(symbol => {
              if (response.data[symbol]) {
                newPrices[symbol] = {
                  price: response.data[symbol].price,
                  percentChange24h: response.data[symbol].percentChange24h
                };
                
                setFetchStatus(prev => ({ ...prev, [symbol]: 'success' }));
                successCount++;
              } else {
                setFetchStatus(prev => ({ ...prev, [symbol]: 'error' }));
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching batch prices:`, error.message);
          
          // Mark all symbols in this batch as error
          const errorStatus = {};
          batch.forEach(symbol => {
            errorStatus[symbol] = 'error';
          });
          setFetchStatus(prev => ({ ...prev, ...errorStatus }));
        }
        
        // Add a small delay between batches
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Update state with all fetched prices
      setTokenPrices(newPrices);
      
      // Cache the results
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          prices: newPrices,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Error caching price data:', e);
      }
      
      return successCount;
    } catch (error) {
      console.error('Error in batch fetch process:', error);
      return 0;
    }
  };

  useEffect(() => {
    const fetchPrices = async () => {
      if (!userAssets || userAssets.length === 0) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Extract unique symbols from assets
        const symbols = [...new Set(userAssets.map(asset => asset.symbol))];
        console.log(`Fetching prices for ${symbols.length} tokens`);
        
        // Fetch prices in batches
        const successCount = await fetchTokenPrices(symbols);
        
        console.log(`Successfully retrieved prices for ${successCount} out of ${symbols.length} tokens`);
        
        if (successCount === 0 && symbols.length > 0) {
          setError('Failed to fetch price data for any tokens');
        }
      } catch (error) {
        console.error('Error in fetch prices process:', error);
        setError('Failed to fetch price data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPrices();
  }, [userAssets]);

  if (!userAssets || userAssets.length === 0) {
    return (
      <div className="wallet-symbols">
        <p>No assets found in wallet</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="wallet-symbols">
        <h3>Wallet Asset Symbols</h3>
        <p>Loading price data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-symbols">
        <h3>Wallet Asset Symbols</h3>
        <p className="error">{error}</p>
        <ul className="symbol-list">
          {userAssets.map((asset, index) => (
            <li key={`${asset.symbol}-${index}`} className="symbol-item">
              {asset.symbol} - N/A
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="wallet-symbols">
      <h3>Wallet Asset Symbols</h3>
      <ul className="symbol-list">
        {userAssets.map((asset, index) => (
          <li key={`${asset.symbol}-${index}`} className="symbol-item">
            {asset.symbol} - {tokenPrices[asset.symbol]
              ? `$${tokenPrices[asset.symbol].price.toFixed(2)}`
              : 'N/A'}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WalletSymbols;