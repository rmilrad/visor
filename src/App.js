import React, { memo, useState } from 'react';
import './App.css';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import WalletAssets from './components/WalletAssets';
import InvestmentOpportunities from './components/InvestmentOpportunities';
import { WalletProvider } from './context/WalletContext';

// Memoized component to prevent unnecessary re-renders
const ConnectPrompt = memo(() => (
  <div className="connect-prompt">
    <p>Connect your wallet to view your Ethereum assets</p>
  </div>
));

// Main App component
function App() {
  const { isConnected, address } = useAccount();
  const [userAssets, setUserAssets] = useState([]);

  // Callback function to receive assets from WalletAssets component
  const handleAssetsLoaded = (assets) => {
    setUserAssets(assets);
  };

  return (
    <WalletProvider>
      <div className="App">
        <div className="wallet-container">
          <header className="header">
            <h1>Ethereum Wallet Viewer</h1>
            <ConnectButton />
          </header>
          
          {!isConnected ? (
            <ConnectPrompt />
          ) : (
            <div className="content-container">
              <div className="left-panel">
                <WalletAssets onAssetsLoaded={handleAssetsLoaded} />
              </div>
              <div className="right-panel">
                <InvestmentOpportunities walletAddress={address} userAssets={userAssets} />
              </div>
            </div>
          )}
        </div>
      </div>
    </WalletProvider>
  );
}

export default App;
