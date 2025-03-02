import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './StakingData.css';

// API endpoints for stakingwatch.io
const API_BASE_URL = 'https://data.stakingwatch.io/api/v1';
const ENDPOINTS = {
  protocols: `${API_BASE_URL}/protocols/`,
  tokens: `${API_BASE_URL}/tokens/`,
  chains: `${API_BASE_URL}/chains/`,
  stats: `${API_BASE_URL}/stats/overview?filters[interval]=7d`
};

/**
 * StakingData component - Fetches and displays staking opportunities from stakingwatch.io API
 * @param {Object} props - Component props
 * @param {string} props.walletAddress - The connected wallet address
 * @param {Array} props.userAssets - Array of user's assets with symbols
 */
const StakingData = ({ walletAddress, userAssets = [] }) => {
  const [stakingData, setStakingData] = useState([]);
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

  // Filter staking opportunities to only include assets the user owns
  const filteredStakingData = useMemo(() => {
    if (!userAssets || userAssets.length === 0) {
      return [];
    }

    return stakingData.filter(item =>
      userAssetSymbols.has(item.asset.toUpperCase())
    );
  }, [stakingData, userAssetSymbols]);
  
  // Find highest APR for each asset
  const findHighestAprByAsset = useMemo(() => {
    const highestAprMap = new Map();
    
    // Group by asset and find highest APR for each
    filteredStakingData.forEach(item => {
      const asset = item.asset;
      const aprValue = parseFloat(item.apr) || 0;
      
      if (!highestAprMap.has(asset) || aprValue > highestAprMap.get(asset)) {
        highestAprMap.set(asset, aprValue);
      }
    });
    
    return highestAprMap;
  }, [filteredStakingData]);

  /**
   * Fetch staking data from stakingwatch.io API with caching
   */
  const fetchStakingData = useCallback(async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    // Check sessionStorage cache first
    const cacheKey = 'staking-data-cache';
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        // Use cache if less than 10 minutes old
        if (Date.now() - timestamp < 10 * 60 * 1000) {
          console.log('Using cached staking data');
          setStakingData(data);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Error parsing cached staking data:', e);
      }
    }
    
    try {
      console.log('🚀 Fetching staking data from stakingwatch.io API...');
      
      // Fetch data from all endpoints in parallel
      const [protocols, tokens, chains, stats] = await Promise.all([
        axios.get(ENDPOINTS.protocols),
        axios.get(ENDPOINTS.tokens),
        axios.get(ENDPOINTS.chains),
        axios.get(ENDPOINTS.stats)
      ]);
      
      // Create lookup maps for protocols, tokens, and chains
      const protocolMap = new Map(protocols.data.map(p => [p.id, p]));
      const tokenMap = new Map(tokens.data.map(t => [t.slug, t]));
      
      // Process only the necessary staking data
      const processedData = stats.data.reduce((acc, item) => {
        // Extract token information
        const tokenSlug = item.staking_token?.slug;
        const token = tokenMap.get(tokenSlug) || {};
        const assetName = item.staking_token?.symbol || token.symbol || 'Unknown';
        
        // Skip processing if we don't have a valid asset name
        if (assetName === 'Unknown') return acc;
        
        // Extract protocol information
        const protocolId = item.protocol?.id;
        const protocolObj = protocolMap.get(protocolId) || {};
        const protocolName = protocolObj.name || item.protocol?.name || 'Unknown';
        
        // Extract APR/APY
        const aprValue = item.apy !== undefined ? item.apy : 0;
        const apr = aprValue !== 0 ? `${aprValue.toFixed(2)}%` : 'N/A';
        
        // Only include items with valid APR values
        if (aprValue <= 0) return acc;
        
        acc.push({
          protocol: protocolName,
          asset: assetName,
          apr: apr,
          aprValue: aprValue, // Store numeric value for sorting
          chains: item.chains?.map(chain => chain.name || 'Unknown') || [],
          tvl: item.tvl ? `$${(item.tvl / 1000000).toFixed(2)}M` : 'N/A',
        });
        
        return acc;
      }, []);
      
      // Sort by APR (descending)
      const sortedData = processedData.sort((a, b) => b.aprValue - a.aprValue);
      
      // Cache the result
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data: sortedData,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Error caching staking data:', e);
      }
      
      setStakingData(sortedData);
      console.log(`Processed ${sortedData.length} staking opportunities`);
      
    } catch (error) {
      console.error('❌ Error fetching staking data:', error.message);
      setError('Failed to fetch staking data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Fetch staking data when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      fetchStakingData();
    } else {
      setStakingData([]);
    }
  }, [walletAddress, fetchStakingData]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="staking-data">
        <p className="loading-message">Loading staking opportunities...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="staking-data">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  // Render no data state
  if (!stakingData.length) {
    return (
      <div className="staking-data">
        <p className="no-data-message">No staking opportunities found.</p>
      </div>
    );
  }
  
  // If user has no assets or no staking opportunities for their assets
  if (userAssetSymbols.size === 0 || filteredStakingData.length === 0) {
    return (
      <div className="staking-data">
        <p className="no-data-message">
          {userAssetSymbols.size === 0
            ? "Connect your wallet and load your assets to see staking opportunities."
            : "No staking opportunities found for your assets."}
        </p>
      </div>
    );
  }

  // Render staking data table
  return (
    <div className="staking-data">
      {filteredStakingData.length > 0 ? (
        <table className="staking-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Protocol</th>
              <th>APR</th>
            </tr>
          </thead>
          <tbody>
            {filteredStakingData.map((item, index) => {
              // Check if this item has the highest APR for its asset
              const aprValue = parseFloat(item.apr) || 0;
              const isHighestApr = aprValue === findHighestAprByAsset.get(item.asset);
              
              return (
                <tr key={`${item.protocol}-${item.asset}-${index}`}>
                  <td>{item.asset}</td>
                  <td>{item.protocol}</td>
                  <td className={isHighestApr ? 'highest-apr' : ''}>{item.apr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="no-data-message">No staking opportunities found for your assets.</p>
      )}
    </div>
  );
};

export default StakingData;