# Ethereum Wallet Viewer and Investment Opportunities Dashboard

This React application allows users to connect their Ethereum wallet, view their assets, and explore various investment opportunities including staking and lending options. It also provides portfolio optimization suggestions.

## Features

- Connect to multiple Web3 wallets using RainbowKit
- View your Ethereum and ERC20 token balances with USD values
- Explore staking opportunities for your tokens
- Discover lending options across various DeFi platforms
- Analyze your portfolio with the Optimize tab
- Filter out spam tokens and scam attempts automatically
- Responsive design for desktop and mobile use

## Architecture Overview

### Component Structure

The application follows a modular component-based architecture:

```
App
├── WalletProvider (Context)
├── WalletAssets
│   └── Asset Items
└── InvestmentOpportunities
    ├── StakingData
    ├── LendingData
    ├── WalletSymbols
    └── PortfolioOptimizer
```

### Key Components

1. **App.js**: The main container component that manages the overall layout and state.

2. **WalletContext.js**: A React Context that provides global state for wallet-related data, including:
   - Total net worth calculation
   - Asset breakdown statistics
   - Formatting utilities for currency display
   - Last updated timestamp

3. **WalletAssets.js**: Displays the user's Ethereum and token balances, including:
   - Fetches balances from the Ethereum blockchain
   - Retrieves price data from external APIs
   - Calculates USD values for all assets
   - Filters out spam tokens using URL pattern detection
   - Updates the global netWorth state

4. **InvestmentOpportunities.js**: A tabbed container for various investment-related components:
   - Manages tab state and navigation
   - Lazy loads tab content for performance optimization
   - Persists the active tab in sessionStorage

5. **StakingData.js**: Displays staking opportunities for the user's tokens:
   - Fetches data from the StakingWatch API
   - Filters opportunities based on user's holdings
   - Displays APY and other relevant staking information

6. **LendingData.js**: Shows lending options across various DeFi platforms:
   - Fetches data from the DeFiLlama API
   - Displays lending rates and platform information
   - Filters options based on user's tokens

7. **WalletSymbols.js**: A simple component that displays the symbols of tokens in the user's wallet.

8. **PortfolioOptimizer.js**: Analyzes the user's portfolio and provides optimization suggestions:
   - Uses the global netWorth data from WalletContext
   - Provides fallback calculations if global data is unavailable
   - Displays portfolio summary statistics
   - Offers general optimization suggestions

## Data Flow

1. **User connects wallet** → RainbowKit handles authentication and provides the wallet address
2. **WalletAssets fetches data**:
   - Retrieves ETH balance from the blockchain
   - Gets token transaction history from Etherscan API
   - Fetches token balances using the ERC20 contract interface
   - Retrieves price data from CoinMarketCap via the local proxy server
3. **WalletAssets calculates values**:
   - Computes USD value for each asset
   - Calculates total portfolio value (netWorth)
   - Updates the WalletContext with this information
4. **WalletAssets passes data to App** → App updates userAssets state
5. **App passes userAssets to InvestmentOpportunities** → Distributed to tab components
6. **Tab components fetch additional data** from external APIs as needed
7. **PortfolioOptimizer uses WalletContext** to display portfolio summary

## API Integrations

### 1. Etherscan API

- **Purpose**: Fetches token transaction history for the connected wallet
- **Endpoint**: `https://api.etherscan.io/api?module=account&action=tokentx`
- **Configuration**: Requires an API key stored in `.env` as `REACT_APP_ETHERSCAN_API_KEY`
- **Rate Limiting**: Has usage limits; the app implements caching and rate limit detection
- **File**: Used in `WalletAssets.js`

### 2. CoinMarketCap API (via Local Proxy)

- **Purpose**: Retrieves current price data for tokens
- **Local Proxy**: `http://localhost:3005/api/price/:symbol`
- **Backend Script**: `scripts/price-api-server.js`
- **Configuration**: Requires an API key stored in `.env` as `REACT_APP_COINMARKETCAP_API_KEY`
- **Rate Limiting**: Has strict usage limits; the app implements caching and fallback mechanisms
- **File**: Used in `WalletAssets.js` and the proxy server

### 3. StakingWatch API (via Local Proxy)

- **Purpose**: Fetches staking opportunities data
- **Local Proxy**: Uses the fetch script to retrieve and cache data
- **Backend Script**: `scripts/fetch-stakingwatch-api.js`
- **Configuration**: May require authentication in some cases
- **File**: Used in `StakingData.js`

### 4. DeFiLlama API (via Local Proxy)

- **Purpose**: Retrieves lending rates and platform information
- **Local Proxy**: Uses the fetch script to retrieve and cache data
- **Backend Script**: `scripts/fetch-defillama-api.js`
- **File**: Used in `LendingData.js`

## State Management

### Global State (Context API)

- **WalletContext**: Manages global wallet-related state:
  - `netWorth`: Total portfolio value in USD
  - `lastUpdated`: Timestamp of the last data update
  - `assetBreakdown`: Statistics about assets with/without price data
  - `updateNetWorth`: Function to update the global state
  - `formatCurrency`: Utility function for consistent currency formatting

### Local Component State

- **App.js**: 
  - `userAssets`: Array of assets with balances and USD values

- **WalletAssets.js**:
  - `assets`: Processed and sorted token assets
  - `ethBalance`: User's ETH balance
  - `priceData`: Token price information
  - `isLoading`, `error`, `loadingProgress`: UI state
  - `filteredTokens`: Statistics about filtered spam tokens
  - `isRateLimited`: Flag to prevent API calls when rate limits are hit
  - `initialFetchDone`: Flag to prevent redundant data fetching

- **InvestmentOpportunities.js**:
  - `activeTab`: Currently selected tab

## Performance Optimizations

1. **Caching Mechanisms**:
   - Session storage for ETH balance, token balances, and price data
   - In-memory cache for token balances with expiration
   - Cache validation to prevent unnecessary API calls

2. **Rate Limit Handling**:
   - Detection of API rate limiting
   - Fallback to cached data when rate limits are hit
   - User feedback when operating with limited data

3. **Code Optimizations**:
   - Memoization of expensive calculations with `useMemo` and `useCallback`
   - Batch processing of token balance requests
   - Prioritization of common tokens for faster loading
   - URL pattern detection using optimized regex
   - Reduced re-renders with careful dependency management

4. **Lazy Loading**:
   - Tab components are lazy loaded with React.lazy and Suspense
   - Only the active tab content is loaded

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- API keys for:
  - WalletConnect Project ID (for RainbowKit)
  - Etherscan API
  - CoinMarketCap API (optional, for price data)

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your API keys:
   ```
   REACT_APP_WALLET_CONNECT_PROJECT_ID=YOUR_WALLETCONNECT_PROJECT_ID
   REACT_APP_ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
   REACT_APP_COINMARKETCAP_API_KEY=YOUR_COINMARKETCAP_API_KEY
   ```

## Running the Application

1. Start the price API proxy server:
   ```
   node scripts/price-api-server.js
   ```

2. In a separate terminal, start the React application:
   ```
   npm start
   ```

3. The application will be available at [http://localhost:3000](http://localhost:3000)

## Troubleshooting

### API Rate Limiting

If you encounter "Rate limit reached" messages:
- The application will use cached data when available
- Wait a few minutes before trying again
- Consider upgrading to a higher tier API plan for production use

### Missing Price Data

If token prices are not showing:
- Ensure the price API server is running
- Check your CoinMarketCap API key
- Some tokens may not have price data available

### Slow Loading Times

- The initial load fetches data from multiple sources
- Subsequent loads will be faster due to caching
- Consider implementing additional optimizations for large portfolios

## Technologies Used

- [React](https://reactjs.org/)
- [RainbowKit](https://www.rainbowkit.com/)
- [wagmi](https://wagmi.sh/)
- [ethers.js](https://docs.ethers.org/)
- [axios](https://axios-http.com/)

## Supported Chains

Currently, the application primarily supports:
- Ethereum Mainnet

## Future Enhancements

- Support for additional EVM-compatible chains
- Integration with more DeFi protocols
- Historical portfolio performance tracking
- Custom investment strategy recommendations
- Mobile app version

## License

This project is licensed under the MIT License - see the LICENSE file for details.
