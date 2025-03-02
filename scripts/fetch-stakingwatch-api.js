const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API endpoints for stakingwatch.io
const API_BASE_URL = 'https://data.stakingwatch.io/api/v1';
const ENDPOINTS = {
  protocols: `${API_BASE_URL}/protocols/`,
  tokens: `${API_BASE_URL}/tokens/`,
  chains: `${API_BASE_URL}/chains/`,
  stats: `${API_BASE_URL}/stats/overview?filters[interval]=7d`
};

/**
 * Fetch staking data from stakingwatch.io API
 * @returns {Promise<Array>} - Array of staking data objects
 */
async function fetchStakingData() {
  console.time('API fetch time');
  console.log('🚀 Fetching staking data from stakingwatch.io API...');
  
  try {
    // Fetch data from all endpoints in parallel
    console.log('📡 Fetching data from API endpoints...');
    const [protocols, tokens, chains, stats] = await Promise.all([
      axios.get(ENDPOINTS.protocols),
      axios.get(ENDPOINTS.tokens),
      axios.get(ENDPOINTS.chains),
      axios.get(ENDPOINTS.stats)
    ]);
    
    console.log('✅ Successfully fetched data from all endpoints');
    
    // Create lookup maps for protocols, tokens, and chains
    const protocolMap = new Map(protocols.data.map(p => [p.id, p]));
    const tokenMap = new Map(tokens.data.map(t => [t.slug, t]));
    const chainMap = new Map(chains.data.map(c => [c.id, c]));
    
    console.log(`Found ${protocols.data.length} protocols`);
    console.log(`Found ${tokens.data.length} tokens`);
    console.log(`Found ${chains.data.length} chains`);
    console.log(`Found ${stats.data.length} staking pools`);
    
    // Process all staking data
    const stakingData = stats.data.map(item => {
      // Extract protocol information
      const protocolId = item.protocol?.id;
      const protocolObj = protocolMap.get(protocolId) || {};
      const protocolName = protocolObj.name || item.protocol?.name || 'Unknown';
      
      // Extract token information
      const tokenSlug = item.staking_token?.slug;
      const token = tokenMap.get(tokenSlug) || {};
      const assetName = item.staking_token?.symbol || token.symbol || 'Unknown';
      
      // Extract chain information
      let chainNames = [];
      if (item.chains && item.chains.length > 0) {
        chainNames = item.chains.map(chain => chain.name || 'Unknown');
      }
      
      // Extract APR/APY
      const apr = item.apy !== undefined ? `${item.apy.toFixed(2)}%` : 'N/A';
      
      return {
        protocol: protocolName,
        asset: assetName,
        apr: apr,
        chains: chainNames,
        tvl: item.tvl || 'N/A',
        category: item.category || 'Unknown'
      };
    });
    
    // Save the data to a file
    const outputPath = path.join(__dirname, 'stakingwatch-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(stakingData, null, 2));
    console.log(`\n💾 Complete data saved to ${outputPath}`);
    
    // Group by asset for better visualization
    const assetGroups = {};
    stakingData.forEach(item => {
      if (!assetGroups[item.asset]) {
        assetGroups[item.asset] = [];
      }
      assetGroups[item.asset].push(item);
    });
    
    console.log('\n📋 Assets Summary:');
    Object.keys(assetGroups).forEach(assetName => {
      console.log(`${assetName}: ${assetGroups[assetName].length} providers`);
    });
    
    // Display a sample of each asset group
    console.log('\n📋 Sample Providers by Asset:');
    Object.keys(assetGroups).slice(0, 5).forEach(assetName => {
      console.log(`\n${assetName} Providers:`);
      console.log('Protocol\tAPR\tChains');
      assetGroups[assetName].slice(0, 3).forEach(provider => {
        console.log(`${provider.protocol}\t${provider.apr}\t${provider.chains.join(', ')}`);
      });
      if (assetGroups[assetName].length > 3) {
        console.log(`...and ${assetGroups[assetName].length - 3} more providers for ${assetName}`);
      }
    });
    
    console.timeEnd('API fetch time');
    return stakingData;
  } catch (error) {
    console.error('❌ Error fetching staking data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.timeEnd('API fetch time');
    throw error;
  }
}

/**
 * Filter staking data by asset, protocol, or chain
 * @param {Array} data - The staking data to filter
 * @param {Object} filters - The filters to apply
 * @param {string} [filters.asset] - Filter by asset symbol (e.g., 'ETH')
 * @param {string} [filters.protocol] - Filter by protocol name
 * @param {string} [filters.chain] - Filter by chain name
 * @returns {Array} - The filtered staking data
 */
function filterStakingData(data, filters = {}) {
  const { asset, protocol, chain } = filters;
  let filteredData = [...data];
  
  if (asset) {
    console.log(`🔍 Filtering by asset: ${asset}`);
    filteredData = filteredData.filter(item => 
      item.asset.toLowerCase() === asset.toLowerCase()
    );
  }
  
  if (protocol) {
    console.log(`🔍 Filtering by protocol: ${protocol}`);
    filteredData = filteredData.filter(item => 
      item.protocol.toLowerCase().includes(protocol.toLowerCase())
    );
  }
  
  if (chain) {
    console.log(`🔍 Filtering by chain: ${chain}`);
    filteredData = filteredData.filter(item => 
      item.chains.some(c => c.toLowerCase().includes(chain.toLowerCase()))
    );
  }
  
  console.log(`📊 Found ${filteredData.length} staking providers after filtering`);
  return filteredData;
}

// Main function
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const filters = {};
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--asset' && i + 1 < args.length) {
        filters.asset = args[i + 1];
        i++;
      } else if (args[i] === '--protocol' && i + 1 < args.length) {
        filters.protocol = args[i + 1];
        i++;
      } else if (args[i] === '--chain' && i + 1 < args.length) {
        filters.chain = args[i + 1];
        i++;
      } else if (args[i] === '--help') {
        console.log(`
Usage: node fetch-stakingwatch-api.js [options]

Options:
  --asset SYMBOL     Filter by asset symbol (e.g., ETH)
  --protocol NAME    Filter by protocol name (e.g., Lido)
  --chain NAME       Filter by chain name (e.g., Ethereum)
  --help             Show this help message
        `);
        return;
      }
    }
    
    // Fetch all staking data
    const stakingData = await fetchStakingData();
    
    // Apply filters if any
    if (Object.keys(filters).length > 0) {
      const filteredData = filterStakingData(stakingData, filters);
      
      // Save filtered data to a file
      const filterSuffix = filters.asset ? `-${filters.asset.toLowerCase()}` : '';
      const outputPath = path.join(__dirname, `stakingwatch-data-filtered${filterSuffix}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(filteredData, null, 2));
      console.log(`\n💾 Filtered data saved to ${outputPath}`);
    }
    
    console.log('\n✅ Script completed successfully');
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();