import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import axios from 'axios';
import './WalletAssets.css';
import { useWallet } from '../context/WalletContext';

// Local proxy server configuration
const PROXY_API_URL = 'http://localhost:3005';

// ERC20 ABI for token balance checking - minimal ABI for better performance
const erc20Abi = [
  // Only include necessary functions to reduce contract initialization time
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  }
];

// Provider configuration with optimized timeouts
const providerConfig = {
  staticNetwork: ethers.Network.from('mainnet'),
  batchStallTime: 25, // Reduced from 50
  pollingInterval: 10000, // Increased from 5000 to reduce network load
  cacheTimeout: 5000, // Increased from 2000
  timeout: 4000 // Reduced from 5000
};

// Create a global token balance cache with expiration
const globalTokenBalanceCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Optimized URL pattern detection using regex instead of array iteration
const URL_PATTERN_REGEX = /http|https|www\.|\.com|\.net|\.org|\.io|\.xyz|\.eth|\.app|\.finance|\.exchange|\.crypto|:\/\/|\.me|\.co|\.site|\.info|url=|link=|website|telegram|twitter|discord|t\.me\/|github/i;

// Function to check if a string contains URL-like patterns
const containsUrlPattern = (str) => {
  if (!str || typeof str !== 'string') return false;
  return URL_PATTERN_REGEX.test(str);
};

const WalletAssets = ({ onAssetsLoaded }) => {
  const { address, isConnected } = useAccount();
  const { updateNetWorth } = useWallet();
  const [assets, setAssets] = useState([]);
  const [ethBalance, setEthBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [filteredTokens, setFilteredTokens] = useState({ urlFiltered: 0, symbolFiltered: 0 });
  const [priceData, setPriceData] = useState({});
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Memoize a single provider to reduce connection overhead
  const provider = useMemo(() =>
    new ethers.JsonRpcProvider('https://rpc.ankr.com/eth', undefined, providerConfig),
  []);

  // Simple delay function
  const delay = useCallback((ms) => new Promise(resolve => setTimeout(resolve, ms)), []);

  // Fetch ETH balance with caching
  const fetchEthBalance = useCallback(async (walletAddress) => {
    try {
      // Check sessionStorage cache first
      const cacheKey = `eth-balance-${walletAddress}`;
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const { balance, timestamp } = JSON.parse(cachedData);
          // Use cache if less than 2 minutes old
          if (Date.now() - timestamp < 2 * 60 * 1000) {
            console.log('Using cached ETH balance');
            return balance;
          }
        } catch (e) {
          console.warn('Error parsing cached ETH balance:', e);
        }
      }

      const balance = await provider.getBalance(walletAddress);
      const formattedBalance = ethers.formatEther(balance);
      
      // Cache the result
      sessionStorage.setItem(cacheKey, JSON.stringify({
        balance: formattedBalance,
        timestamp: Date.now()
      }));
      
      return formattedBalance;
    } catch (err) {
      console.error('Failed to fetch ETH balance:', err);
      return 'Error';
    }
  }, [provider]);

  // Fetch token data from Etherscan
  const fetchTokenData = useCallback(async (walletAddress) => {
    setLoadingStatus('Fetching token data from Etherscan...');
    
    const etherscanApiKey = process.env.REACT_APP_ETHERSCAN_API_KEY;
    if (!etherscanApiKey) {
      throw new Error('REACT_APP_ETHERSCAN_API_KEY is not defined in .env file');
    }
    
    try {
      const etherscanUrl = `https://api.etherscan.io/api?module=account&action=tokentx&address=${walletAddress}&sort=desc&apikey=${etherscanApiKey}`;
      const response = await axios.get(etherscanUrl, { timeout: 10000 });
      
      if (response.data.status !== '1') {
        console.error('Etherscan API error:', response.data);
        throw new Error(`Etherscan API error: ${response.data.message || 'Unknown error'}`);
      }
      
      const result = response.data.result || [];
      console.log(`Fetched ${result.length} token transactions from Etherscan`);
      return result;
    } catch (err) {
      console.error('Error fetching from Etherscan:', err);
      
      // Check if this is a rate limiting error
      const isRateLimitError =
        err.message?.includes('rate limit') ||
        err.message?.includes('too many requests') ||
        err.message?.includes('429') ||
        (err.response?.status === 429);
      
      if (isRateLimitError) {
        console.warn('Etherscan rate limit detected');
        setIsRateLimited(true);
        
        // Return empty array instead of throwing to allow the app to continue
        return [];
      }
      
      throw new Error(`Failed to fetch token data: ${err.message}`);
    }
  }, []);

  // Process token transactions to get unique tokens with symbols - optimized version
  const processTokenTransactions = useCallback((tokenTxs) => {
    setLoadingStatus('Processing token transactions...');
    
    const uniqueTokens = {};
    let tokensWithSymbols = 0;
    let tokensWithoutSymbols = 0;
    let tokensWithUrlPatterns = 0;
    
    // Use a Set to track processed addresses for faster lookups
    const processedAddresses = new Set();
    
    for (const tx of tokenTxs) {
      // Skip if transaction doesn't have required fields
      if (!tx || !tx.contractAddress) {
        continue;
      }
      
      const tokenAddress = tx.contractAddress.toLowerCase();
      
      // Skip if already processed this address
      if (processedAddresses.has(tokenAddress)) {
        continue;
      }
      
      processedAddresses.add(tokenAddress);
      
      const hasSymbol = tx.tokenSymbol && tx.tokenSymbol.trim() !== '';
      
      // Check if token name or symbol contains URL-like patterns
      const containsUrl =
        containsUrlPattern(tx.tokenSymbol) ||
        containsUrlPattern(tx.tokenName);
      
      if (containsUrl) {
        tokensWithUrlPatterns++;
        // Reduce console logging to improve performance
        if (tokensWithUrlPatterns < 5) {
          console.warn(`Filtered out token with URL pattern: ${tx.tokenSymbol || 'unknown'}`);
        }
        continue;
      }
      
      if (hasSymbol) {
        tokensWithSymbols++;
        uniqueTokens[tokenAddress] = {
          address: tx.contractAddress,
          symbol: tx.tokenSymbol,
          name: tx.tokenName || tx.tokenSymbol, // Use symbol as fallback if name is missing
          decimals: parseInt(tx.tokenDecimal, 10) || 18, // Default to 18 decimals if missing
        };
      } else {
        tokensWithoutSymbols++;
      }
    }
    
    // Only log summary information
    console.log(`Found ${Object.keys(uniqueTokens).length} unique tokens with valid symbols`);
    
    setFilteredTokens({
      urlFiltered: tokensWithUrlPatterns,
      symbolFiltered: tokensWithoutSymbols
    });
    
    return uniqueTokens;
  }, []);

  // Fetch a single token balance with improved error handling and caching
  const fetchTokenBalance = useCallback(async (walletAddress, token, tokenAddress) => {
    try {
      // Check cache first
      const cacheKey = `${walletAddress}-${tokenAddress}`;
      if (globalTokenBalanceCache.has(cacheKey)) {
        const cachedData = globalTokenBalanceCache.get(cacheKey);
        const cacheTime = cachedData.cacheTime || 0;
        
        // Use cache if less than 5 minutes old
        if (Date.now() - cacheTime < CACHE_EXPIRY) {
          return cachedData;
        }
      }
      
      // Double-check for URL patterns (in case they were missed earlier)
      if (containsUrlPattern(token.symbol) || containsUrlPattern(token.name)) {
        console.warn(`Skipping token with URL pattern: ${token.symbol}`);
        return null;
      }
      
      // Verify token has a symbol before proceeding
      if (!token.symbol || token.symbol.trim() === '') {
        console.warn(`Skipping token without symbol`);
        return null;
      }
      
      // Use a timeout to prevent hanging requests
      const fetchWithTimeout = async () => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 4000)
        );
        
        const contract = new ethers.Contract(token.address, erc20Abi, provider);
        const balancePromise = contract.balanceOf(walletAddress);
        
        return Promise.race([balancePromise, timeoutPromise]);
      };
      
      const balance = await fetchWithTimeout();
      const formattedBalance = ethers.formatUnits(balance, token.decimals);
      
      const tokenData = {
        ...token,
        balance: formattedBalance,
        balanceRaw: balance.toString(),
        cacheTime: Date.now()
      };
      
      // Cache the result
      globalTokenBalanceCache.set(cacheKey, tokenData);
      return tokenData;
    } catch (err) {
      console.error(`Error fetching balance for ${token.symbol}:`, err);
      return {
        ...token,
        balance: 'Error',
        balanceRaw: '0',
        error: true
      };
    }
  }, [provider]);

  // Fetch token balances in parallel with optimized batching
  const fetchTokenBalances = useCallback(async (walletAddress, uniqueTokens) => {
    const tokenAddresses = Object.keys(uniqueTokens);
    const totalTokens = tokenAddresses.length;
    
    setLoadingStatus(`Fetching balances for ${totalTokens} tokens...`);
    
    if (totalTokens === 0) {
      console.log('No tokens with valid symbols found');
      return [];
    }
    
    // Check sessionStorage for cached batch results
    const batchCacheKey = `token-balances-${walletAddress}`;
    const cachedBatchData = sessionStorage.getItem(batchCacheKey);
    let cachedBalances = [];
    
    if (cachedBatchData) {
      try {
        const { balances, timestamp } = JSON.parse(cachedBatchData);
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          console.log('Using cached token balances');
          cachedBalances = balances;
          
          // Filter out tokens that are not in the current uniqueTokens list
          const validCachedBalances = cachedBalances.filter(token =>
            token && token.address && uniqueTokens[token.address.toLowerCase()]
          );
          
          if (validCachedBalances.length > 0) {
            return validCachedBalances;
          }
        }
      } catch (e) {
        console.warn('Error parsing cached token balances:', e);
      }
    }
    
    // Process tokens in larger batches for better performance
    const batchSize = 5; // Increased from 3 to 5
    const tokenBalances = [];
    
    // Sort tokens by potential importance (e.g., common tokens first)
    const priorityTokens = ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'LINK'];
    const sortedAddresses = [...tokenAddresses].sort((a, b) => {
      const tokenA = uniqueTokens[a];
      const tokenB = uniqueTokens[b];
      
      const priorityA = priorityTokens.indexOf(tokenA.symbol);
      const priorityB = priorityTokens.indexOf(tokenB.symbol);
      
      if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
      if (priorityA !== -1) return -1;
      if (priorityB !== -1) return 1;
      return 0;
    });
    
    for (let i = 0; i < sortedAddresses.length; i += batchSize) {
      const batch = sortedAddresses.slice(i, i + batchSize);
      
      // Only update status every few batches to reduce re-renders
      if (i % (batchSize * 2) === 0) {
        setLoadingStatus(`Fetching token batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sortedAddresses.length/batchSize)}...`);
      }
      
      // Process batch in parallel
      const batchPromises = batch.map(tokenAddress =>
        fetchTokenBalance(walletAddress, uniqueTokens[tokenAddress], tokenAddress)
      );
      
      // Wait for all promises in the batch to resolve
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out null results (tokens without symbols or with URL patterns)
      const validResults = batchResults.filter(result => result !== null);
      tokenBalances.push(...validResults);
      
      // Update loading progress less frequently
      if (i % (batchSize * 2) === 0) {
        setLoadingProgress(Math.min(90, Math.round((i / sortedAddresses.length) * 90)));
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < sortedAddresses.length) {
        await delay(200); // Reduced from 300ms to 200ms
      }
    }
    
    // Cache the results in sessionStorage
    try {
      sessionStorage.setItem(batchCacheKey, JSON.stringify({
        balances: tokenBalances,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Error caching token balances:', e);
    }
    
    return tokenBalances;
  }, [fetchTokenBalance, delay]);

  // Fetch price data using our local proxy server with improved caching
  const fetchPriceData = useCallback(async (assets) => {
    if (!assets || assets.length === 0) {
      return {};
    }

    setLoadingStatus('Fetching price data...');
    
    try {
      // Extract unique symbols from assets
      const symbols = [...new Set(assets.map(asset => asset.symbol))];
      
      // Add ETH if not already included
      if (!symbols.includes('ETH')) {
        symbols.push('ETH');
      }
      
      // Check sessionStorage cache first
      const cacheKey = 'price-data-cache';
      const cachedData = sessionStorage.getItem(cacheKey);
      let priceCache = {};
      
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          // Use cache if less than 2 minutes old
          if (Date.now() - timestamp < 2 * 60 * 1000) {
            priceCache = data;
            console.log('Using cached price data');
          }
        } catch (e) {
          console.warn('Error parsing cached price data:', e);
        }
      }
      
      // Filter out symbols that are already in the cache
      const symbolsToFetch = symbols.filter(symbol => !priceCache[symbol]);
      
      if (symbolsToFetch.length === 0) {
        console.log('All price data available in cache');
        return priceCache;
      }
      
      console.log(`Fetching prices for ${symbolsToFetch.length} tokens`);
      
      // Process tokens in batches to reduce API calls
      const batchSize = 3;
      const priceData = { ...priceCache };
      
      for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
        const batch = symbolsToFetch.slice(i, i + batchSize);
        const batchPromises = batch.map(symbol => {
          return axios.get(`${PROXY_API_URL}/api/price/${symbol}`)
            .then(response => {
              if (response.status === 200 && response.data) {
                return { symbol, data: response.data };
              }
              return null;
            })
            .catch(err => {
              console.error(`Error fetching price for ${symbol}:`, err.message);
              return null;
            });
        });
        
        const results = await Promise.all(batchPromises);
        
        // Process results
        results.forEach(result => {
          if (result && result.data) {
            priceData[result.symbol] = {
              price: result.data.price,
              percentChange24h: result.data.percentChange24h,
              lastUpdated: result.data.lastUpdated
            };
          }
        });
        
        // Add a small delay between batches
        if (i + batchSize < symbolsToFetch.length) {
          await delay(300);
        }
      }
      
      // Cache the results
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: priceData,
        timestamp: Date.now()
      }));
      
      console.log(`Retrieved prices for ${Object.keys(priceData).length} tokens`);
      return priceData;
    } catch (error) {
      console.error('Error in fetch prices process:', error);
      
      // Check if this is a rate limiting error
      const isRateLimitError =
        error.message?.includes('rate limit') ||
        error.message?.includes('too many requests') ||
        error.message?.includes('429') ||
        (error.response?.status === 429);
      
      if (isRateLimitError) {
        console.warn('Price API rate limit detected');
        setIsRateLimited(true);
        
        // Try to use cached data if available
        try {
          const priceCacheKey = 'price-data-cache';
          const cachedData = sessionStorage.getItem(priceCacheKey);
          if (cachedData) {
            const { data } = JSON.parse(cachedData);
            console.log('Using cached price data due to rate limiting');
            return data;
          }
        } catch (e) {
          console.warn('Error parsing cached price data:', e);
        }
      }
      
      return {};
    }
  }, [delay]);

  // Main fetch assets function
  const fetchAssets = useCallback(async () => {
    if (!isConnected || !address) {
      setAssets([]);
      setEthBalance('0');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingStatus('Initializing...');
    setFilteredTokens({ urlFiltered: 0, symbolFiltered: 0 });

    try {
      // Fetch ETH balance and token data in parallel
      setLoadingProgress(10);
      setLoadingStatus('Fetching ETH balance and token data...');
      
      const [balance, tokenTxs] = await Promise.all([
        fetchEthBalance(address),
        fetchTokenData(address)
      ]);
      
      setEthBalance(balance);
      setLoadingProgress(30);
      
      // Process token transactions
      const uniqueTokens = processTokenTransactions(tokenTxs);
      setLoadingProgress(40);
      
      // Fetch token balances
      const tokenBalances = await fetchTokenBalances(address, uniqueTokens);
      setLoadingProgress(80);
      
      // Filter out tokens with zero balance, errors, missing symbols, and URL patterns
      const validBalances = tokenBalances
        .filter(token =>
          token &&
          !token.error &&
          parseFloat(token.balance) > 0 &&
          token.symbol &&
          token.symbol.trim() !== '' &&
          !containsUrlPattern(token.symbol) &&
          !containsUrlPattern(token.name)
        );
      console.log(`Found ${validBalances.length} tokens with non-zero balances and valid symbols`);
      
      // Prepare the complete asset list including ETH
      const allAssets = [
        { symbol: 'ETH', name: 'Ethereum', balance: ethBalance },
        ...validBalances
      ];
      
      // Fetch price data from CoinMarketCap
      setLoadingProgress(85);
      setLoadingStatus('Fetching price data...');
      const prices = await fetchPriceData(allAssets);
      setPriceData(prices);
      setLoadingProgress(90);
      
      // Calculate total USD value for each asset and add it to the asset object
      setLoadingStatus('Calculating asset values...');
      const assetsWithValue = [
        // Calculate ETH value
        {
          symbol: 'ETH',
          name: 'Ethereum',
          balance: ethBalance,
          usdValue: prices.ETH ? parseFloat(ethBalance) * prices.ETH.price : 0
        },
        // Calculate values for other tokens
        ...validBalances.map(asset => {
          const price = prices[asset.symbol] ? prices[asset.symbol].price : 0;
          const usdValue = parseFloat(asset.balance) * price;
          return {
            ...asset,
            usdValue
          };
        })
      ];
      
      // Sort assets by USD value (highest to lowest)
      const sortedAssets = assetsWithValue.slice(1).sort((a, b) => b.usdValue - a.usdValue);
      
      // Calculate total net worth and update the global context
      let totalNetWorth = 0;
      let assetsWithValueCount = 0;
      let assetsWithoutValueCount = 0;
      
      assetsWithValue.forEach(asset => {
        if (asset.usdValue && !isNaN(asset.usdValue)) {
          totalNetWorth += asset.usdValue;
          assetsWithValueCount++;
        } else {
          assetsWithoutValueCount++;
        }
      });
      
      console.log(`Total Net Worth: $${totalNetWorth.toFixed(2)}`);
      
      // Update the global net worth context
      updateNetWorth(totalNetWorth, {
        totalAssets: assetsWithValue.length,
        assetsWithValue: assetsWithValueCount,
        assetsWithoutValue: assetsWithoutValueCount
      });
      
      setAssets(sortedAssets);
      setLoadingProgress(95);
      setLoadingStatus('Finalizing...');
      
      // Call the onAssetsLoaded callback with the assets data
      if (onAssetsLoaded && typeof onAssetsLoaded === 'function') {
        console.log('WalletAssets - Calling onAssetsLoaded with:', assetsWithValue);
        console.log('WalletAssets - Total netWorth calculated:', totalNetWorth);
        
        // Make sure all assets have usdValue property
        const assetsWithUsdValue = assetsWithValue.map(asset => {
          if (asset.usdValue === undefined) {
            const price = prices[asset.symbol] ? prices[asset.symbol].price : 0;
            const balance = parseFloat(asset.balance);
            return {
              ...asset,
              usdValue: !isNaN(balance) && price ? balance * price : 0
            };
          }
          return asset;
        });
        
        onAssetsLoaded(assetsWithUsdValue);
      }
      setLoadingProgress(100);
    } catch (err) {
      console.error('Error fetching assets:', err);
      
      // Check if this is a rate limiting error
      const isRateLimitError =
        err.message?.includes('rate limit') ||
        err.message?.includes('too many requests') ||
        err.message?.includes('429');
      
      if (isRateLimitError) {
        console.warn('Rate limit detected, will use cached data and stop refreshing');
        setIsRateLimited(true);
        
        // Try to use cached data if available
        try {
          const cachedPriceData = sessionStorage.getItem('price-data-cache');
          if (cachedPriceData) {
            const { data } = JSON.parse(cachedPriceData);
            setPriceData(data);
            console.log('Using cached price data due to rate limiting');
          }
          
          // If we have some assets already, keep displaying them
          if (assets.length > 0) {
            setError('Rate limit reached. Displaying cached data.');
          } else {
            setError('Rate limit reached. Please try again later.');
          }
        } catch (cacheErr) {
          console.error('Error using cached data:', cacheErr);
          setError('Rate limit reached and no cached data available. Please try again later.');
        }
      } else {
        setError(`Failed to fetch wallet assets: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, [
    address,
    isConnected,
    fetchEthBalance,
    fetchTokenData,
    processTokenTransactions,
    fetchTokenBalances,
    fetchPriceData,
    updateNetWorth
  ]);

  // Fetch assets only on component mount or when address changes
  useEffect(() => {
    // Skip fetching if we've hit a rate limit
    if (isRateLimited) {
      console.log('Skipping asset fetch due to rate limiting');
      return;
    }
    
    // Only fetch once when the component mounts or when address changes
    if (!initialFetchDone || address) {
      console.log('Performing asset fetch');
      fetchAssets();
      setInitialFetchDone(true);
    }
    
    // Cleanup function to prevent memory leaks
    return () => {
      console.log('Cleaning up asset fetch effect');
    };
  }, [address, isRateLimited, initialFetchDone]);

  // Render loading state with progress
  if (isLoading) {
    return (
      <div className="wallet-assets">
        <p>Loading assets... {loadingProgress}%</p>
        <p className="loading-status">{loadingStatus}</p>
        <div className="loading-bar">
          <div 
            className="loading-progress" 
            style={{ width: `${loadingProgress}%` }}
          ></div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="wallet-assets">
        <p className="error">{error}</p>
      </div>
    );
  }

  // Render disconnected state
  if (!isConnected) {
    return (
      <div className="wallet-assets">
        <p>Connect your wallet to view your assets</p>
      </div>
    );
  }

  // Render assets
  return (
    <div className="wallet-assets">
      <h2>Your Assets</h2>
      <div className="wallet-address">
        <span>Address: </span>
        <a
          href={`https://etherscan.io/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {address.substring(0, 6)}...{address.substring(address.length - 4)}
        </a>
      </div>
      
      {(filteredTokens.urlFiltered > 0 || filteredTokens.symbolFiltered > 0) && (
        <div className="filter-info">
          <p>
            {filteredTokens.symbolFiltered > 0 && `${filteredTokens.symbolFiltered} tokens without symbols filtered. `}
            {filteredTokens.urlFiltered > 0 && `${filteredTokens.urlFiltered} tokens with URL patterns filtered.`}
          </p>
        </div>
      )}
      
      <div className="asset-list">
        <div className="asset-item">
          <div className="asset-info">
            <span className="asset-name">Ethereum</span>
            <span className="asset-symbol">ETH</span>
          </div>
          <div className="asset-details">
            <div className="asset-balance">
              {ethBalance === 'Error' ? 'Error' : parseFloat(ethBalance).toFixed(4)}
            </div>
            {priceData && priceData.ETH && (
              <div className="asset-price">
                <div className="price-value">${priceData.ETH.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <div className="asset-total-value">
                  Total: ${(parseFloat(ethBalance) * priceData.ETH.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {assets.length > 0 ? (
          assets.map((asset, index) => (
            <div className="asset-item" key={`${asset.address}-${index}`}>
              <div className="asset-info">
                <span className="asset-name">{asset.name}</span>
                <span className="asset-symbol">{asset.symbol}</span>
                <a
                  href={`https://etherscan.io/token/${asset.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="asset-link"
                >
                  View on Etherscan
                </a>
              </div>
              <div className="asset-details">
                <div className="asset-balance">
                  {asset.balance === 'Error' ? 'Error' : parseFloat(asset.balance).toFixed(4)}
                </div>
                {priceData && priceData[asset.symbol] && (
                  <div className="asset-price">
                    <div className="price-value">${priceData[asset.symbol].price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className="asset-total-value">
                      Total: ${asset.usdValue ? asset.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No ERC20 tokens found with valid symbols in this wallet</p>
        )}
      </div>
    </div>
  );
};

export default WalletAssets;