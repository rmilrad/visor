/**
 * Script to fetch cryptocurrency price data from CoinMarketCap API
 * 
 * This script connects to the CoinMarketCap API to retrieve current price data
 * for specified cryptocurrencies.
 * 
 * API Documentation: https://coinmarketcap.com/api/documentation/v1/
 */

const axios = require('axios');
require('dotenv').config({ path: '../.env' });

// CoinMarketCap API configuration
const CMC_API_KEY = '96978c3a-d7b9-430e-8b99-5baf8c6b61d7'; // Using the provided API key
const CMC_API_URL = 'https://pro-api.coinmarketcap.com';

/**
 * Fetches the current price for a specific cryptocurrency
 * @param {string} symbol - Cryptocurrency symbol (e.g., 'BTC', 'ETH')
 * @returns {Promise<Object>} - Price data for the specified cryptocurrency
 */
async function fetchCryptoPriceData(symbol) {
  try {
    console.log(`🔍 Fetching price data for ${symbol}...`);
    
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
      }
    });
    
    // Check if we got a successful response
    if (response.status === 200 && response.data) {
      console.log('✅ Successfully connected to CoinMarketCap API');
      
      // Extract the price data
      const data = response.data.data[symbol];
      const price = data.quote.USD.price;
      
      console.log(`💰 Current price of ${symbol}: $${price.toFixed(2)} USD`);
      
      return {
        symbol: symbol,
        name: data.name,
        price: price,
        lastUpdated: data.quote.USD.last_updated,
        percentChange24h: data.quote.USD.percent_change_24h
      };
    } else {
      console.error('⚠️ Received response but with unexpected format');
      console.error(response.data);
      throw new Error('Unexpected response format');
    }
  } catch (error) {
    console.error('❌ Error fetching price data:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    // Fetch price data for ETH, BTC, and AVAX
    console.log('Fetching prices for ETH, BTC, and AVAX...');
    
    const ethData = await fetchCryptoPriceData('ETH');
    console.log('📊 Ethereum Price Data:', ethData);
    
    const btcData = await fetchCryptoPriceData('BTC');
    console.log('📊 Bitcoin Price Data:', btcData);
    
    const avaxData = await fetchCryptoPriceData('AVAX');
    console.log('📊 Avalanche Price Data:', avaxData);
    
    // Summary
    console.log('\n💰 Price Summary:');
    console.log(`ETH: $${ethData.price.toFixed(2)}`);
    console.log(`BTC: $${btcData.price.toFixed(2)}`);
    console.log(`AVAX: $${avaxData.price.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Script execution failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();