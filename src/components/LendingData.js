import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './LendingData.css';

// DeFiLlama Yield API base URL
const YIELD_API_BASE_URL = 'https://yields.llama.fi';

// List of known lending protocols on Ethereum
const LENDING_PROTOCOLS = [
  'aave-v2',
  'aave-v3',
  'compound-v2',
  'compound-v3',
  'euler',
  'morpho-aave',
  'morpho-compound',
  'spark',
  'venus',
  'cream',
  'iron-bank',
  'maker',
  'clearpool-lending',
  'maple',
  'notional-v3',
  'silo-finance',
  'solend',
  'tenderfi',
  'benqi',
  'geist',
  'granary',
  'radiant',
  'seamless-protocol'
];

/**
 * LendingData component - Fetches and displays lending opportunities from DeFiLlama Yield API
 * @param {Object} props - Component props
 * @param {string} props.walletAddress - The connected wallet address
 * @param {Array} props.userAssets - Array of user's assets with symbols
 */
const LendingData = ({ walletAddress, userAssets = [] }) => {
  const [lendingData, setLendingData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Create a set of user asset symbols for efficient lookup
  const userAssetSymbols = useMemo(() => {
    const symbols = new Set();
    if (userAssets && userAssets.length > 0) {
      userAssets.forEach(asset => {
        if (asset.symbol) {
          symbols.add(asset.symbol.toUpperCase());
        }
      });
    }
    return symbols;
  }, [userAssets]);
  
  // State to toggle between showing all opportunities or just user's assets
  const [showOnlyUserAssets, setShowOnlyUserAssets] = useState(false);
  
  // Filter lending opportunities based on user's preference
  const filteredLendingData = useMemo(() => {
    // If not filtering or user has no assets, show all lending data
    if (!showOnlyUserAssets || !userAssets || userAssets.length === 0) {
      return lendingData;
    }

    // Otherwise, filter to only show user's assets
    return lendingData.filter(item =>
      userAssetSymbols.has(item.symbol.toUpperCase())
    );
  }, [lendingData, userAssetSymbols, showOnlyUserAssets, userAssets]);
  
  // Find highest APY for each asset
  const findHighestApyByAsset = useMemo(() => {
    const highestApyMap = new Map();
    
    // Group by asset and find highest APY for each
    filteredLendingData.forEach(item => {
      const asset = item.symbol;
      const apyValue = item.apy || 0;
      
      if (!highestApyMap.has(asset) || apyValue > highestApyMap.get(asset)) {
        highestApyMap.set(asset, apyValue);
      }
    });
    
    return highestApyMap;
  }, [filteredLendingData]);

  /**
   * Fetch lending data from DeFiLlama Yield API with caching and improved error handling
   */
  const fetchLendingData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // Check sessionStorage cache first
    const cacheKey = 'lending-data-cache';
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        // Use cache if less than 15 minutes old
        if (Date.now() - timestamp < 15 * 60 * 1000) {
          console.log('Using cached lending data');
          setLendingData(data);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Error parsing cached lending data:', e);
      }
    }
    
    try {
      console.log('🚀 Fetching lending data from DeFiLlama Yield API...');
      
      // Fetch data from the pools endpoint with increased timeout
      const endpoint = `${YIELD_API_BASE_URL}/pools`;
      
      const response = await axios.get(endpoint, {
        timeout: 15000, // Increased timeout to 15 seconds
        headers: {
          'Accept': 'application/json'
          // Removed 'Cache-Control': 'no-cache' which might cause issues
        }
      });
      
      // Check if we got a successful response
      if (response.status === 200 && response.data) {
        // Check if the data structure is as expected
        if (!response.data.data || !Array.isArray(response.data.data)) {
          console.error('Unexpected API response structure:', response.data);
          
          // Try to handle different response structures
          const poolsData = response.data.data || response.data.pools || response.data;
          
          if (!Array.isArray(poolsData)) {
            throw new Error('Unable to parse API response: data is not an array');
          }
          
          console.log(`Found alternative data structure with ${poolsData.length} pools`);
        }
        
        // Get the pools data, handling potential structure changes
        const poolsData = Array.isArray(response.data.data)
          ? response.data.data
          : (Array.isArray(response.data.pools) ? response.data.pools : []);
        
        console.log(`📊 Received data for ${poolsData.length} yield pools`);
        
        // Filter the data based on our criteria with a more efficient approach
        const filteredData = poolsData.reduce((acc, pool) => {
          // Skip if pool doesn't have required properties
          if (!pool || typeof pool !== 'object') return acc;
          
          // Handle potential structure changes
          const apy = typeof pool.apy === 'number' ? pool.apy :
                     (typeof pool.apr === 'number' ? pool.apr : 0);
          const chain = pool.chain || '';
          const project = pool.project || pool.protocol || '';
          
          if (apy > 0.01 &&
              chain.toLowerCase() === 'ethereum' &&
              LENDING_PROTOCOLS.includes(project)) {
            
            acc.push({
              symbol: pool.symbol || 'Unknown',
              protocol: project,
              apy: apy,
              tvlUsd: pool.tvlUsd || 0,
              chain: chain
            });
          }
          return acc;
        }, []);
        
        // Sort by APY (highest first)
        filteredData.sort((a, b) => b.apy - a.apy);
        
        // Cache the result
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: filteredData,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Error caching lending data:', e);
        }
        
        setLendingData(filteredData);
        console.log(`Processed ${filteredData.length} lending opportunities`);
      } else {
        setError('Failed to fetch lending data. Unexpected response format.');
      }
    } catch (error) {
      console.error('❌ Error fetching lending data:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      // Try to use cached data even if it's older than the normal threshold
      try {
        if (cachedData) {
          const { data } = JSON.parse(cachedData);
          console.log('Using older cached data as fallback');
          setLendingData(data);
          setError('Using cached data. Latest data could not be fetched.');
          return;
        }
      } catch (e) {
        console.warn('Error using fallback cache:', e);
      }
      
      setError('Failed to fetch lending data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch lending data when component mounts
  useEffect(() => {
    fetchLendingData();
  }, [fetchLendingData]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="lending-data">
        <p className="loading-message">Loading lending opportunities...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="lending-data">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  // Render no data state
  if (!lendingData.length) {
    return (
      <div className="lending-data">
        <p className="no-data-message">No lending opportunities found.</p>
      </div>
    );
  }

  // Format TVL as USD with commas for thousands
  const formatTVL = (tvl) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(tvl);
  };

  // Render lending data table
  return (
    <div className="lending-data">
      {userAssets && userAssets.length > 0 && (
        <div className="filter-controls">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showOnlyUserAssets}
              onChange={() => setShowOnlyUserAssets(!showOnlyUserAssets)}
            />
            <span>Show only my assets</span>
          </label>
        </div>
      )}
      
      <div className="data-summary">
        <p>Showing {filteredLendingData.length} lending opportunities</p>
      </div>
      
      <table className="lending-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Protocol</th>
            <th>APY (%)</th>
          </tr>
        </thead>
        <tbody>
          {filteredLendingData.map((item, index) => {
            // Check if this item has the highest APY for its asset
            const isHighestApy = item.apy === findHighestApyByAsset.get(item.symbol);
            
            return (
              <tr key={`${item.protocol}-${item.symbol}-${index}`}>
                <td>{item.symbol}</td>
                <td>{item.protocol}</td>
                <td className={isHighestApy ? 'highest-apr' : ''}>{item.apy.toFixed(2)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LendingData;