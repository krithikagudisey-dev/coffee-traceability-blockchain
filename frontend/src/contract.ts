import { ethers } from "ethers";

// contract.ts
// Single source of truth for address + ABI.
// Used by both frontend (import.meta.env) and backend (process.env).

export const WALLET_ROLES: Record<string, string> = {
  "0xD0e391706eA0c702525AB873294f72e53fF1A46B": "Farmer",
  "0x611A7adA52343d7c6CE8016B77e7225D9723204e": "Processor",
  "0x55A4b7Fe8D1B07a6a84FdfFBdF0780Db0b12714C": "Transporter",
  "0xD2fb76630d89f2A7e541C13534bB8017E7af7b4d": "Roaster",
};

/**
 * Normalizes an address using ethers.getAddress and returns its human-readable role.
 * If no role is found, returns null.
 */
export function getRole(addr: string | null): string | null {
  if (!addr) return null;
  try {
    const normalized = ethers.getAddress(addr);
    return WALLET_ROLES[normalized] ?? null;
  } catch {
    return null;
  }
}

function getEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

export const CONTRACT_ADDRESS: string =
  getEnv("VITE_CONTRACT_ADDRESS") ??
  getEnv("CONTRACT_ADDRESS") ??
  "0xF2bD6E3693de3AA87d7a95D6be61870aaf833317"; // ← replace with your Sepolia address

export const SEPOLIA_RPC: string =
  getEnv("VITE_RPC_URL") ??
  getEnv("RPC_URL") ??
  ""; // intentionally empty — must be set in .env

export const CONTRACT_ABI = [
  // ── Custom errors (ethers decodes these into readable revert reasons) ────
  {
    name: "AlreadyOwner",
    type: "error",
    inputs: [
      { name: "batchId", type: "uint256" },
      { name: "caller",  type: "address" },
    ],
  },
  {
    name: "BatchNotFound",
    type: "error",
    inputs: [
      { name: "batchId", type: "uint256" },
    ],
  },
  {
    name: "EmptyOrigin",
    type: "error",
    inputs: [],
  },
  {
    name: "InvalidHumidity",
    type: "error",
    inputs: [
      { name: "humidity", type: "uint256" },
    ],
  },

  // ── Write functions ───────────────────────────────────────────────────────
  {
    name: "createBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "_origin", type: "string" }],
    outputs: [{ name: "newId",   type: "uint256" }],
  },
  {
    name: "logSensorData",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_batchId",     type: "uint256" },
      { name: "_temperature", type: "int256"  },
      { name: "_humidity",    type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "transferCustody",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "_batchId", type: "uint256" }],
    outputs: [],
  },

  // ── Read (view) functions ─────────────────────────────────────────────────
  {
    name: "getBatch",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_batchId", type: "uint256" }],
    outputs: [
      { name: "batchId_",      type: "uint256" },
      { name: "origin_",       type: "string"  },
      { name: "currentOwner_", type: "address" },
      { name: "readingCount",  type: "uint256" },
      { name: "custodyCount",  type: "uint256" },
    ],
  },
  {
    name: "getCustodyTrail",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "_batchId", type: "uint256"  }],
    outputs: [{ name: "trail",    type: "address[]" }],
  },
  {
    name: "getSensorData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_batchId", type: "uint256" }],
    outputs: [
      { name: "temps_",      type: "int256[]"  },
      { name: "humidities_", type: "uint256[]" },
      { name: "timestamps_", type: "uint256[]" },
    ],
  },
  {
    name: "batchExistsView",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "_batchId", type: "uint256" }],
    outputs: [{ name: "exists",   type: "bool"    }],
  },
  {
    name: "batchCounter",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    name: "BatchCreated",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true,  name: "batchId", type: "uint256" },
      { indexed: false, name: "origin",  type: "string"  },
      { indexed: true,  name: "creator", type: "address" },
    ],
  },
  {
    name: "SensorDataLogged",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true,  name: "batchId",     type: "uint256" },
      { indexed: false, name: "temperature", type: "int256"  },
      { indexed: false, name: "humidity",    type: "uint256" },
    ],
  },
  {
    name: "CustodyTransferred",
    type: "event",
    anonymous: false,
    inputs: [
      { indexed: true, name: "batchId",  type: "uint256" },
      { indexed: true, name: "oldOwner", type: "address" },
      { indexed: true, name: "newOwner", type: "address" },
    ],
  },
] as const;