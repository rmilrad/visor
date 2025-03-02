import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// RainbowKit and Wagmi imports
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet } from 'wagmi/chains'; // Only import mainnet to reduce bundle size
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a Wagmi configuration with only necessary chains
const config = getDefaultConfig({
  appName: 'Ethereum Wallet Viewer',
  projectId: process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID,
  chains: [mainnet], // Only use mainnet to reduce bundle size and improve performance
  ssr: false,
});

// Create a React Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Disable refetching when window regains focus
      retry: 1, // Limit retries on failure
      staleTime: 60000, // Consider data fresh for 60 seconds (increased from 30s)
      cacheTime: 300000, // Cache for 5 minutes
    },
  },
});

// Create root and render app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
