const axios = require('axios');

// DefiLlama Yield API base URL
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

// Function to test the DefiLlama Yield API
async function testDefiLlamaYieldApi() {
  console.time('API connection test');
  console.log('🚀 Testing connection to DefiLlama Yield API...');
  
  try {
    // Test with the pools endpoint to get yield data
    const endpoint = `${YIELD_API_BASE_URL}/pools`;
    console.log(`📡 Connecting to endpoint: ${endpoint}`);
    
    const response = await axios.get(endpoint);
    
    // Check if we got a successful response
    if (response.status === 200 && response.data) {
      console.log('✅ Successfully connected to DefiLlama Yield API');
      console.log(`📊 Received data for ${response.data.data.length} yield pools`);
      
      // Filter the data based on our criteria:
      // 1. APY > 0.01 (to avoid showing pools with 0.00% when rounded)
      // 2. Chain is Ethereum
      // 3. Project is a known lending protocol
      const filteredData = response.data.data.filter(pool =>
        pool.apy > 0.01 &&
        pool.chain === 'Ethereum' &&
        LENDING_PROTOCOLS.includes(pool.project)
      );
      
      console.log(`🔍 Filtered to ${filteredData.length} Ethereum lending pools with APY > 0.01`);
      
      // Extract only the data we're interested in
      const yieldData = filteredData.map(pool => ({
        symbol: pool.symbol,
        protocol: pool.project,
        apy: pool.apy,
        tvlUsd: pool.tvlUsd || 0,
        chain: pool.chain,
        exposure: pool.exposure || 'N/A',
        ilRisk: pool.ilRisk || 'N/A'
      }));
      
      // Sort by APY (highest first)
      yieldData.sort((a, b) => b.apy - a.apy);
      
      // Display filtered pools with the requested information
      console.log('\n📋 Ethereum lending pools with APY > 0.01% (sorted by APY):');
      console.log('Symbol | Protocol | Chain | Exposure | IL Risk | TVL (USD) | APY (%)');
      console.log('-------------------------------------------------------------------------');
      
      yieldData.forEach(pool => {
        // Format TVL as USD with commas for thousands
        const formattedTVL = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(pool.tvlUsd);
        
        console.log(`${pool.symbol} | ${pool.protocol} | ${pool.chain} | ${pool.exposure} | ${pool.ilRisk} | ${formattedTVL} | ${pool.apy.toFixed(2)}%`);
      });
      
      console.log(`\nTotal pools displayed: ${yieldData.length}`);
    } else {
      console.log('⚠️ Received response but with unexpected format');
    }
    
    console.timeEnd('API connection test');
  } catch (error) {
    console.error('❌ Error connecting to DefiLlama Yield API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.timeEnd('API connection test');
    throw error;
  }
}

// Run the test
testDefiLlamaYieldApi()
  .then(() => {
    console.log('\n✅ Test completed successfully');
  })
  .catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });