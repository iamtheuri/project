// @ts-nocheck
"use client";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

// Prevent multiple instances during hot module reloading in development
let web3authInstance: Web3Auth | null = null;

export function getWeb3AuthInstance(): Web3Auth | null {
  // Only initialize in browser environment
  if (typeof window === "undefined") {
    return null;
  }

  // Return existing instance if already initialized
  if (web3authInstance) {
    return web3authInstance;
  }

  const clientId = process.env.NEXT_PUBLIC_WEB3_AUTH_CLIENT_ID;

  if (!clientId) {
    console.error("Missing Web3Auth client ID");
    return null;
  }

  const chainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0xaa36a7",
    rpcTarget: `https://rpc.ankr.com/eth_sepolia/${process.env.NEXT_PUBLIC_ETH_SEPOLIA_API_KEY}`,
    displayName: "Ethereum Sepolia Testnet",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    ticker: "ETH",
    tickerName: "Ethereum",
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  };

  const privateKeyProvider = new EthereumPrivateKeyProvider({
    config: { chainConfig },
  });

  try {
    web3authInstance = new Web3Auth({
      clientId,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      privateKeyProvider,
      chainConfig,
      uiConfig: {
        appName: "Trash2Token",
        theme: "light",
        loginMethodsOrder: ["google"],
      },
      loginConfig: {
        google: {
          verifier: "Trash2Token",
          typeOfLogin: "google",
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CONSOLE_CLIENT_ID,
        },
      },
    });

    return web3authInstance;
  } catch (error) {
    console.error("Failed to initialize Web3Auth:", error);
    return null;
  }
}

// Initialize Web3Auth
export const initWeb3Auth = async (): Promise<Web3Auth | null> => {
  const web3auth = getWeb3AuthInstance();

  if (!web3auth) {
    return null;
  }

  try {
    await web3auth.initModal();
    return web3auth;
  } catch (error) {
    console.error("Error initializing Web3Auth:", error);
    return null;
  }
};

// Export an auth context provider for React components
export { useAuthStatus } from "../hooks/useAuthStatus";
