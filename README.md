# CoffeeTrace — Person 3 (Web3 Integrator)

React + shadcn frontend · Express backend bridge · ethers.js · Sepolia testnet

---

## JSON Payload Spec

This is the exact JSON the ESP32 (Person 2) must POST to `POST /api/sensor`.

```json
{
  "batchId":     1,
  "temperature": 24.5,
  "humidity":    60.3,
  "timestamp":   1714000000,
  "deviceId":    "ESP32-A1"
}
```

### Field reference

| Field         | Type    | Required | Description                                              |
|---------------|---------|----------|----------------------------------------------------------|
| `batchId`     | integer | YES      | Which batch this reading belongs to. Must exist on-chain first. |
| `temperature` | float   | YES      | Celsius. Range: -50 to 100. Stored on-chain as `int256` × 100 (e.g. 24.5 → 2450). |
| `humidity`    | float   | YES      | Percentage. Range: 0–100. Stored on-chain as `uint256` × 10 (e.g. 60.3 → 603). |
| `timestamp`   | integer | no       | Unix epoch seconds from the ESP32's RTC. Optional — the smart contract also records `block.timestamp`. |
| `deviceId`    | string  | no       | Identifier for the sensor device. Used for server logs only, not stored on-chain. |

### Why ×100 / ×10?

Solidity has no floating-point types. We scale before storing:
- `temperature 24.5` → backend sends `int256 2450` → frontend divides back: `2450 / 100 = 24.5`
- `humidity 60.3` → backend sends `uint256 603` → frontend divides back: `603 / 10 = 60.3`

Person 1's Solidity contract must use `int256` for temperature (allows negatives) and `uint256` for humidity.

---

## Project Structure

```
coffee-trace/
├── backend/
│   ├── server.js        ← Express bridge: receives ESP32 data, pushes to blockchain
│   ├── abi.json         ← Paste full ABI from Person 1 here
│   ├── .env             ← Secrets (never commit this)
│   ├── .env.example     ← Template to share with team
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx               ← Root: tabs, wallet state
    │   ├── main.jsx              ← Vite entry point
    │   ├── index.css             ← Global styles + CSS vars
    │   ├── lib/
    │   │   ├── contract.js       ← ABI + address + RPC config
    │   │   └── useWallet.js      ← MetaMask connect/disconnect hook
    │   └── components/
    │       ├── WalletBar.jsx     ← Top nav with connect button
    │       ├── Dashboard.jsx     ← Read-only batch + custody viewer
    │       └── QRScanner.jsx     ← Scan QR → transferCustody() on-chain
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Setup

### Step 1 — Get info from teammates

Before touching any code:

1. **From Person 2 (ESP32):** Confirm they're using the exact JSON payload above.
2. **From Person 1 (Blockchain):**
   - Contract address after Sepolia deployment (looks like `0xAb12...`)
   - Full ABI JSON from their Hardhat `artifacts/` folder

### Step 2 — Backend setup

```bash
cd backend
npm install

# Copy env template
cp .env.example .env
# Edit .env — fill in PRIVATE_KEY, CONTRACT_ADDRESS, RPC_URL
```

Paste Person 1's full ABI into `backend/abi.json`.

Also paste it into `frontend/src/lib/contract.js` in the `CONTRACT_ABI` array,
and update `CONTRACT_ADDRESS` in the same file.

### Step 3 — Get a backend wallet + Sepolia ETH

1. Open MetaMask → click your account icon → **Add account**
2. Name it "CoffeeTrace Backend"
3. Click the three dots → **Account details** → **Export private key**
4. Paste into `.env` as `PRIVATE_KEY`
5. Get free Sepolia ETH: https://sepoliafaucet.com (needs Alchemy account) or https://faucet.quicknode.com/ethereum/sepolia

### Step 4 — Get an RPC URL

**Infura (easiest):**
1. Go to https://app.infura.io → sign up
2. Create a new project
3. Go to project → **Endpoints** → copy the **Sepolia** HTTPS URL
4. Paste into `.env` as `RPC_URL`

### Step 5 — Frontend setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Step 6 — Run backend

```bash
cd backend
node server.js
# Should print: Bridge server running on port 3000
# Should print: Backend wallet: 0x...
```

---

## Testing

### Test the backend alone (before ESP32 is ready)

```bash
curl -X POST http://localhost:3000/api/sensor \
  -H "Content-Type: application/json" \
  -d '{"batchId": 1, "temperature": 24.5, "humidity": 60.3, "deviceId": "test"}'
```

Expected response:
```json
{
  "success": true,
  "txHash": "0xabc123...",
  "stored": { "tempInt": 2450, "humInt": 603 }
}
```

Paste the `txHash` at https://sepolia.etherscan.io to confirm it landed on-chain.

### Full end-to-end test sequence

1. Person 1 calls `createBatch(1)` on the deployed contract
2. Start backend: `node server.js`
3. Give Person 2 your local IP (`ifconfig` on Mac/Linux, `ipconfig` on Windows)
4. Person 2 powers on ESP32 — it POSTs to `http://YOUR_IP:3000/api/sensor`
5. Watch backend terminal — should see `TX CONFIRMED`
6. Open frontend → Track Batch → enter `1` → sensor data appears
7. Switch MetaMask to a second account, scan QR on bag, confirm in MetaMask
8. Refresh dashboard → second wallet address appears in custody trail

---

## Common Errors

| Error | Fix |
|-------|-----|
| "Switch MetaMask to Sepolia" | MetaMask is on wrong network. Open MetaMask → switch to Sepolia Testnet |
| `execution reverted` in MetaMask | The batchId doesn't exist on-chain. Person 1 must create it first. |
| CORS error in browser console | Make sure `app.use(cors())` is before routes in `server.js`. Open frontend via `npm run dev`, not by opening the file directly. |
| ESP32 can't reach server | Check same Wi-Fi. Re-run `ifconfig` — IP may have changed. Temporarily disable firewall. |
| Temperature shows 0 on dashboard | Field name mismatch. ESP32 might be sending `"temp"` but backend expects `"temperature"`. |
| `Cannot read properties of undefined (ABI)` | ABI is wrong or incomplete. Get the full compiled ABI from Person 1's Hardhat `artifacts/contracts/YourContract.sol/YourContract.json` → the `"abi"` array. |

---

## Demo tip

Open https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS on a second screen during the demo. Every transaction (sensor log, custody transfer) shows up in real time. Evaluators can visually see the blockchain updating live.
