# Web3 Wallet Connect Demo

This is a React application that demonstrates how to integrate RainbowKit for connecting Web3 wallets.

## Features

- Connect to multiple Web3 wallets using RainbowKit
- Support for multiple chains (Ethereum, Polygon, Optimism, Arbitrum)
- User-friendly wallet connection interface

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- A WalletConnect Project ID (get one from [WalletConnect Cloud](https://cloud.walletconnect.com))

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your WalletConnect Project ID:
   ```
   REACT_APP_WALLET_CONNECT_PROJECT_ID=YOUR_PROJECT_ID
   ```
   Replace `YOUR_PROJECT_ID` with the actual Project ID from WalletConnect Cloud.

## Running the Application

Start the development server:

```
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000) (or another port if 3000 is already in use).

## How to Use

1. Open the application in your browser
2. Click the "Connect Wallet" button in the top-right corner
3. Select your preferred wallet from the list
4. Follow the wallet's instructions to connect
5. Once connected, you'll see your wallet address and balance

## Technologies Used

- [React](https://reactjs.org/)
- [RainbowKit](https://www.rainbowkit.com/)
- [wagmi](https://wagmi.sh/)
- [viem](https://viem.sh/)

## Supported Chains

- Ethereum Mainnet
- Sepolia (Ethereum Testnet)
- Polygon
- Optimism
- Arbitrum

## Supported Wallets

RainbowKit supports a wide range of wallets including:

- MetaMask
- Rainbow
- Coinbase Wallet
- WalletConnect
- And many more!

## Customization

You can customize the supported chains by modifying the `chains` array in `src/index.js`.

## Learn More

- [RainbowKit Documentation](https://www.rainbowkit.com/docs/introduction)
- [wagmi Documentation](https://wagmi.sh/)
- [viem Documentation](https://viem.sh/)
