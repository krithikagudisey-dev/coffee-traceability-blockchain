import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the current address to avoid dependency loops in listeners
  const addressRef = useRef<string | null>(null);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setContract(null);
    setError(null);
    localStorage.removeItem("wallet_connected");
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected. Install it from metamask.io");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request accounts - triggers MetaMask popup if not authorized
      await provider.send("eth_requestAccounts", []);

      const network = await provider.getNetwork();
      // Sepolia chainId is 11155111
      if (network.chainId !== 11155111n) {
        setError(`Wrong network (Chain ID: ${network.chainId}) — switch MetaMask to Sepolia Testnet.`);
        setLoading(false);
        return;
      }

      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const instance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setAddress(addr);
      setContract(instance);
      localStorage.setItem("wallet_connected", "true");
    } catch (err: any) {
      console.error("Connection error:", err);
      if (err.code === 4001 || err.message?.includes("rejected")) {
        setError("Connection rejected in MetaMask.");
      } else {
        setError(err.message ?? "An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync with MetaMask-side changes (Account switching / Disconnecting)
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log("MetaMask accountsChanged:", accounts);
      if (accounts.length === 0) {
        // User disconnected from MetaMask
        disconnect();
      } else if (addressRef.current && accounts[0].toLowerCase() !== addressRef.current.toLowerCase()) {
        // User switched accounts in MetaMask - re-run connect to update signer/contract
        connect();
      }
    };

    const handleChainChanged = () => {
      // Recommended way to handle chain changes is a full page reload
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [connect, disconnect]);

  // Initial check for existing connection
  useEffect(() => {
    let mounted = true;

    async function checkConnection() {
      if (!window.ethereum) {
        if (mounted) setInitialLoading(false);
        return;
      }

      const wasConnected = localStorage.getItem("wallet_connected") === "true";
      if (!wasConnected) {
        if (mounted) setInitialLoading(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        // check if we still have authorized accounts
        const accounts = await provider.listAccounts();
        if (accounts.length > 0 && mounted) {
          await connect();
        }
      } catch (err) {
        console.error("Auto-connect failed:", err);
      } finally {
        if (mounted) setInitialLoading(false);
      }
    }

    checkConnection();
    return () => { mounted = false; };
  }, [connect]);

  return { address, contract, loading, initialLoading, error, connect, disconnect };
}