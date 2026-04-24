import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { ethers } from "ethers";
import { CONTRACT_ABI } from "./contract";

const app = express();

// CORS — allow Vite dev server (5173) and Vite preview (4173)
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[],
  methods: ["GET", "POST"],
}));

app.use(express.json());

// ── Boot-time env validation ──────────────────────────────────────────────────
const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error(
    "[FATAL] Missing env vars: RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS\n" +
    "        Copy backend/.env.example → backend/.env and fill in values."
  );
  process.exit(1);
}

// ── Ethers setup ──────────────────────────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

console.log(`[INFO] Signer wallet: ${wallet.address}`);

interface SensorPayload {
  batchId?:     number;
  temperature?: number; // real float e.g. 24.5
  humidity?:    number; // real float e.g. 63.0
  deviceId?:    string;
}

// ── POST /api/sensor ──────────────────────────────────────────────────────────
// Temperature convention: multiply by 10 before Solidity.
//   24.5°C → 245 (int256, supports negatives)
// Humidity: round to nearest integer percentage.
//   63.7%  → 64  (uint256)
app.post("/api/sensor", async (req: Request<{}, {}, SensorPayload>, res: Response) => {
  const { batchId, temperature, humidity, deviceId } = req.body;

  if (batchId == null || temperature == null || humidity == null) {
    return res.status(400).json({ error: "Missing fields: batchId, temperature, humidity" });
  }
  if (!Number.isFinite(batchId) || batchId <= 0) {
    return res.status(400).json({ error: "batchId must be a positive number" });
  }
  if (!Number.isFinite(temperature) || temperature < -50 || temperature > 150) {
    return res.status(400).json({ error: "temperature out of range (-50 to 150 °C)" });
  }
  if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
    return res.status(400).json({ error: "humidity out of range (0-100 %)" });
  }

  const tempInt = Math.round(temperature * 10); // e.g. 24.5 → 245
  const humInt  = Math.round(humidity);          // e.g. 63.7 → 64

  console.log(
    `[SENSOR] batchId=${batchId} | ` +
    `temp=${temperature}°C (→${tempInt}) | ` +
    `humidity=${humidity}% (→${humInt}) | ` +
    `device=${deviceId ?? "unknown"}`
  );

  try {
    const tx      = await contract.logSensorData(batchId, tempInt, humInt);
    console.log(`[TX SENT]      ${tx.hash}`);
    const receipt = await tx.wait(1);
    console.log(`[TX CONFIRMED] block ${receipt.blockNumber}`);

    return res.status(200).json({
      success: true,
      txHash:  tx.hash,
      blockNumber: receipt.blockNumber,
      stored: { tempInt, humInt },
    });
  } catch (err: any) {
    const msg = err.reason ?? err.shortMessage ?? err.message ?? String(err);
    console.error("[BLOCKCHAIN ERROR]", msg);
    return res.status(500).json({ error: msg });
  }
});

// ── GET /api/health ───────────────────────────────────────────────────────────
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", signerAddress: wallet.address });
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, () => {
  console.log(`[INFO] IoT Bridge  → http://localhost:${PORT}`);
  console.log(`[INFO] Frontend    → http://localhost:5173`);
});