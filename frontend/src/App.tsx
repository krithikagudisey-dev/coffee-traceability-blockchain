import { useState } from "react";
import { useWallet } from "./useWallet";
import WalletBar from "./WalletBar";
import Dashboard from "./Dashboard";
import QRScanner from "./QRScanner";
import CreateBatch from "./CreateBatch";
import "./index.css";

type TabType = "dashboard" | "scan" | "create";

const TABS = [
  { id: "dashboard" as TabType, label: "Track Batch"   },
  { id: "scan"      as TabType, label: "Claim Custody" },
  { id: "create"    as TabType, label: "Create Batch"  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const { address, contract, loading, initialLoading, error, connect, disconnect } = useWallet();

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem" }}>

      <header style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        paddingBottom:  "1.25rem",
        marginBottom:   "0",
        borderBottom:   "1px solid var(--border)",
      }}>
        <div>
          <h1 style={{
            fontSize:      "1.1rem",
            fontWeight:    700,
            color:         "var(--accent)",
            letterSpacing: "0.04em",
            margin:        0,
          }}>
            ☕ COFFEE TRACE
          </h1>
          <p style={{
            fontSize:   "0.72rem",
            color:      "var(--text-muted)",
            marginTop:  "0.15rem",
            marginBottom: 0,
          }}>
            Sepolia Testnet · On-chain Supply Chain
          </p>
        </div>

        <WalletBar
          address={address}
          loading={loading}
          initialLoading={initialLoading}
          error={error}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      </header>

      <nav className="tab-bar" style={{ marginTop: "1.5rem" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "dashboard" && <Dashboard />}
      {activeTab === "scan"      && <QRScanner   contract={contract} address={address} />}
      {activeTab === "create"    && <CreateBatch contract={contract} address={address} />}

    </div>
  );
}