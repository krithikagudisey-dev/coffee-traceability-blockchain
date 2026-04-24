import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";

// Fix: closing brace was missing on Window interface in original file
declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider & { isMetaMask?: boolean };
  }
}

export function useWallet() {
  const [address,  setAddress]  = useState<string | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);

    if (!window.ethereum) {
      setError("MetaMask not detected. Install it from metamask.io");
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        setError("Wrong network — switch MetaMask to Sepolia Testnet.");
        setLoading(false);
        return;
      }

      const signer   = await provider.getSigner();
      const addr     = await signer.getAddress();
      const instance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setAddress(addr);
      setContract(instance);
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        setError("Connection rejected in MetaMask.");
      } else {
        setError(err.message ?? "An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setContract(null);
    setError(null);
  }, []);

  return { address, contract, loading, error, connect, disconnect };
}