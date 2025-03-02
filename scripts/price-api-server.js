/**
 * Optimized Express server to proxy requests to CoinMarketCap API
 * This avoids CORS issues when calling the API directly from the browser
 * and implements caching and rate limiting protection
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = 3005;

// CoinMarketCap API configuration
const CMC_API_KEY = '96978c3a-d7b9-430e-8b99-5baf8c6b61d7';
const CMC_API_URL = 'https://pro-api.coinmarketcap.com';

// Enhanced cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minute cache (increased from 1 minute)
const priceCache = new Map();

// Save cache to disk periodically to persist between server restarts
const fs = require('fs');
const path = require('path');
const CACHE_FILE = path.join(__dirname, 'price-cache.json');

// Load cache from disk on startup
try {
  if (fs.existsSync(CACHE_FILE)) {
    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    Object.entries(cacheData).forEach(([key, value]) => {
      priceCache.set(key, value);
    });
    console.log(`Loaded ${priceCache.size} cached items from disk`);
  }
} catch (err) {
  console.error('Error loading cache from disk:', err.message);
}

// Save cache to disk periodically
setInterval(() => {
  try {
    const cacheObj = {};
    priceCache.forEach((value, key) => {
      cacheObj[key] = value;
    });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObj));
    console.log(`Saved ${priceCache.size} cached items to disk`);
  } catch (err) {
    console.error('Error saving cache to disk:', err.message);
  }
}, 5 * 60 * 1000); // Save every 5 minutes

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 25; // Max 25 requests per minute
let requestCount = 0;
let windowStart = Date.now();

// Reset rate limit counter every minute
setInterval(() => {
  requestCount = 0;
  windowStart = Date.now();
  console.log('Rate limit window reset');
}, RATE_LIMIT_WINDOW);

// Enable CORS for all routes
app.use(cors());

// Simple rate limiting middleware
const rateLimiter = (req, res, next) => {
  // Check if we're in a new window
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT_WINDOW) {
    requestCount = 0;
    windowStart = now;
  }
  
  // Check if we've exceeded the rate limit
  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later'
    });
  }
  
  // Increment request count and proceed
  requestCount++;
  next();
};

// Apply rate limiting to all routes
app.use(rateLimiter);

// Batch endpoint to get prices for multiple symbols
app.get('/api/prices', async (req, res) => {
  try {
    const symbols = req.query.symbols;
    
    if (!symbols) {
      return res.status(400).json({
        error: 'Missing symbols parameter',
        message: 'Please provide a comma-separated list of symbols'
      });
    }
    
    const symbolArray = symbols.split(',').map(s => s.trim().toUpperCase());
    
    if (symbolArray.length === 0) {
      return res.status(400).json({
        error: 'Invalid symbols parameter',
        message: 'Please provide at least one symbol'
      });
    }
    
    // Check cache first for all symbols
    const now = Date.now();
    const result = {};
    const symbolsToFetch = [];
    
    symbolArray.forEach(symbol => {
      if (priceCache.has(symbol) && now - priceCache.get(symbol).timestamp < CACHE_DURATION) {
        result[symbol] = priceCache.get(symbol).data;
      } else {
        symbolsToFetch.push(symbol);
      }
    });
    
    // If all symbols were in cache, return immediately
    if (symbolsToFetch.length === 0) {
      console.log(`📋 Using cached data for all symbols: ${symbolArray.join(', ')}`);
      return res.json(result);
    }
    
    console.log(`🔍 Fetching price data for: ${symbolsToFetch.join(', ')}`);
    
    // Endpoint for latest quotes
    const endpoint = '/v1/cryptocurrency/quotes/latest';
    
    // Make the API request
    const response = await axios.get(`${CMC_API_URL}${endpoint}`, {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        'Accept': 'application/json'
      },
      params: {
        symbol: symbolsToFetch.join(',')
      },
      timeout: 8000 // 8 second timeout (increased from 5s)
    });
    
    // Process the response
    if (response.status === 200 && response.data && response.data.data) {
      console.log('✅ Successfully connected to CoinMarketCap API');
      
      // Process each symbol
      for (const symbol of symbolsToFetch) {
        try {
          const data = response.data.data[symbol];
          
          if (data && data.quote && data.quote.USD && data.quote.USD.price !== undefined) {
            const price = data.quote.USD.price;
            
            // Prepare the response data
            const responseData = {
              symbol: symbol,
              name: data.name || symbol,
              price: price,
              lastUpdated: data.quote.USD.last_updated || new Date().toISOString(),
              percentChange24h: data.quote.USD.percent_change_24h || 0
            };
            
            // Cache the result
            priceCache.set(symbol, {
              timestamp: now,
              data: responseData
            });
            
            // Add to result
            result[symbol] = responseData;
          } else {
            console.error('⚠️ Missing required price data for', symbol);
          }
        } catch (err) {
          console.error('❌ Error processing price data for', symbol, err.message);
        }
      }
    }
    
    return res.json(result);
  } catch (error) {
    console.error('❌ Error fetching batch price data:');
    if (error.response) {
      // Handle rate limiting specifically
      if (error.response.status === 429) {
        console.error('Rate limit exceeded on CoinMarketCap API');
        return res.status(429).json({
          error: 'Rate limit exceeded on upstream API',
          message: 'Try again later'
        });
      }
      
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
      return res.status(error.response.status).json({
        error: 'API Error',
        details: error.response.data
      });
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
      return res.status(504).json({ error: 'Request timeout' });
    } else {
      console.error(error.message);
      return res.status(500).json({ error: error.message });
    }
  }
});

// Endpoint to get price for a specific symbol
app.get('/api/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Check cache first
    const cacheKey = symbol.toUpperCase();
    const now = Date.now();
    if (priceCache.has(cacheKey)) {
      const cachedData = priceCache.get(cacheKey);
      if (now - cachedData.timestamp < CACHE_DURATION) {
        console.log(`📋 Using cached data for ${symbol}`);
        return res.json(cachedData.data);
      }
    }
    
    console.log(`� Fetching price data for ${symbol}...`);
    
    // Endpoint for latest quotes
    const endpoint = '/v1/cryptocurrency/quotes/latest';
    
    // Make the API request
    const response = await axios.get(`${CMC_API_URL}${endpoint}`, {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        'Accept': 'application/json'
      },
      params: {
        symbol: symbol
      },
      timeout: 5000 // 5 second timeout
    });
    
    // Check if we got a successful response
    if (response.status === 200 && response.data && response.data.data && response.data.data[symbol]) {
      console.log('✅ Successfully connected to CoinMarketCap API');
      
      try {
        // Extract the price data
        const data = response.data.data[symbol];
        
        // Check if all required data is present
        if (data && data.quote && data.quote.USD && data.quote.USD.price !== undefined) {
          const price = data.quote.USD.price;
          
          console.log(`💰 Current price of ${symbol}: $${price.toFixed(2)} USD`);
          
          // Prepare the response data
          const responseData = {
            symbol: symbol,
            name: data.name || symbol,
            price: price,
            lastUpdated: data.quote.USD.last_updated || new Date().toISOString(),
            percentChange24h: data.quote.USD.percent_change_24h || 0
          };
          
          // Cache the result
          priceCache.set(cacheKey, {
            timestamp: now,
            data: responseData
          });
          
          // Return the price data
          return res.json(responseData);
        } else {
          console.error('⚠️ Missing required price data for', symbol);
          return res.status(404).json({
            symbol: symbol,
            error: 'Price data not available',
            price: null
          });
        }
      } catch (err) {
        console.error('❌ Error processing price data for', symbol, err);
        return res.status(500).json({
          symbol: symbol,
          error: 'Error processing price data',
          price: null
        });
      }
    } else {
      console.error('⚠️ Received response but with unexpected format');
      return res.status(404).json({
        symbol: symbol,
        error: 'Token not found or invalid format',
        price: null
      });
    }
  } catch (error) {
    console.error('❌ Error fetching price data:');
    if (error.response) {
      // Handle rate limiting specifically
      if (error.response.status === 429) {
        console.error('Rate limit exceeded on CoinMarketCap API');
        
        // Check if we have cached data for this symbol
        const cacheKey = req.params.symbol.toUpperCase();
        if (priceCache.has(cacheKey)) {
          console.log(`📋 Using cached data for ${req.params.symbol} due to rate limiting`);
          return res.json(priceCache.get(cacheKey).data);
        }
        
        return res.status(429).json({
          error: 'Rate limit exceeded on upstream API',
          message: 'Try again later'
        });
      }
      
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
      return res.status(error.response.status).json({
        error: 'API Error',
        details: error.response.data
      });
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
      return res.status(504).json({ error: 'Request timeout' });
    } else {
      console.error(error.message);
      return res.status(500).json({ error: error.message });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Price API server running at http://localhost:${PORT}`);
  console.log(`Cache duration: ${CACHE_DURATION / 1000} seconds`);
  console.log(`Rate limit: ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW / 1000} seconds`);
});