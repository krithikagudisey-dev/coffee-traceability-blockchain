import { useState } from "react";
import { ethers } from "ethers";
import {
  Search, Thermometer, Droplets, Clock,
  Package, Loader2, AlertCircle, ExternalLink
} from "lucide-react";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_RPC } from "./contract";

const readProvider = SEPOLIA_RPC
  ? new ethers.JsonRpcProvider(SEPOLIA_RPC)
  : null;

const readContract = readProvider
  ? new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider)
  : null;

interface SensorReading {
  temperature: number; // display value = raw / 10
  humidity:    number; // display value = raw integer %
  timestamp:   number; // UNIX seconds
}

interface BatchData {
  batchId:      number;
  origin:       string;
  currentOwner: string;
  trail:        string[];
  readings:     SensorReading[];
}

const CUSTODY_LABELS: Record<number, string> = {
  0: "Farmer", 1: "Processor", 2: "Distributor", 3: "Retailer", 4: "Recipient",
};

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const formatTs  = (u: number) => u ? new Date(u * 1000).toLocaleString() : "—";

export default function Dashboard() {
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [data,    setData]    = useState<BatchData | null>(null);

  async function fetchBatch() {
    const id = parseInt(batchId.trim(), 10);
    if (!id || id <= 0) { setError("Enter a valid Batch ID."); return; }
    if (!readContract)  { setError("Set VITE_RPC_URL in frontend/.env"); return; }

    setLoading(true); setError(null); setData(null);

    try {
      const [batch, trail, sensor] = await Promise.all([
        readContract.getBatch(id),
        readContract.getCustodyTrail(id),
        readContract.getSensorData(id),
      ]);

      const temps  = [...sensor.temps_].map(Number);
      const hums   = [...sensor.humidities_].map(Number);
      const times  = [...sensor.timestamps_].map(Number);

      setData({
        batchId:      Number(batch.batchId_),
        origin:       batch.origin_,
        currentOwner: batch.currentOwner_,
        trail:        [...trail],
        readings: temps.map((t, i) => ({
          temperature: t / 10,   // undo ×10 from server.ts
          humidity:    hums[i],
          timestamp:   times[i],
        })),
      });
    } catch (err: any) {
      const msg = err.reason ?? err.shortMessage ?? err.message ?? String(err);
      setError(msg.includes("BatchNotFound")
        ? `Batch #${id} does not exist on-chain.`
        : "Contract error: " + msg);
    } finally {
      setLoading(false);
    }
  }

  const latest = data?.readings.at(-1) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
          Batch Tracker
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
          No wallet required. Enter a Batch ID to view origin, custody trail, and sensor history.
        </p>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <input
          className="input-field"
          type="number" min="1"
          placeholder="Batch ID (e.g. 1)"
          value={batchId}
          onChange={e => setBatchId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchBatch()}
          style={{ maxWidth: 200 }}
        />
        <button
          className="btn-primary"
          onClick={fetchBatch}
          disabled={loading || !batchId.trim()}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          {loading
            ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Fetching…</>
            : <><Search size={14} /> Track</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ display: "flex", gap: "0.6rem",
                                       alignItems: "center", color: "var(--accent)",
                                       borderColor: "var(--accent)" }}>
          <AlertCircle size={16} />
          <span style={{ fontSize: "0.88rem" }}>{error}</span>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Batch summary card */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between",
                          flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              <div>
                <p className="mono-label">BATCH #{data.batchId}</p>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700,
                             color: "var(--accent)", marginTop: "0.2rem" }}>
                  {data.origin}
                </h3>
              </div>
              <div style={{ textAlign: "right" }}>
                <p className="mono-label">CURRENT OWNER</p>
                <a href={`https://sepolia.etherscan.io/address/${data.currentOwner}`}
                   target="_blank" rel="noopener noreferrer"
                   style={{ fontSize: "0.82rem", color: "var(--accent)",
                            display: "flex", alignItems: "center", gap: "0.3rem",
                            justifyContent: "flex-end", marginTop: "0.2rem" }}>
                  {shortAddr(data.currentOwner)} <ExternalLink size={11} />
                </a>
              </div>
            </div>
            {latest ? (
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <SensorCard icon={<Thermometer size={14} />} label="LATEST TEMP"
                            value={`${latest.temperature.toFixed(1)}°C`} />
                <SensorCard icon={<Droplets size={14} />}    label="LATEST HUMIDITY"
                            value={`${latest.humidity}%`} />
                <SensorCard icon={<Clock size={14} />}       label="LAST READING"
                            value={formatTs(latest.timestamp)} small />
              </div>
            ) : (
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                No sensor readings logged yet.
              </p>
            )}
          </div>

          {/* Custody trail */}
          <div className="card">
            <h4 style={{ marginBottom: "1rem", display: "flex",
                         alignItems: "center", gap: "0.5rem" }}>
              <Package size={15} />
              Custody Trail — {data.trail.length} checkpoint{data.trail.length !== 1 ? "s" : ""}
            </h4>
            {data.trail.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                No custody transfers recorded.
              </p>
            ) : (
              <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
                {data.trail.map((addr, i) => (
                  <li key={i} style={{ display: "flex", gap: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column",
                                  alignItems: "center", flexShrink: 0 }}>
                      <div className="timeline-node" />
                      {i < data.trail.length - 1 && (
                        <div className="timeline-line" style={{ height: 28 }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < data.trail.length - 1 ? "0.5rem" : 0,
                                  display: "flex", alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  width: "100%", flexWrap: "wrap", gap: "0.25rem" }}>
                      <div>
                        <span className="badge badge-orange" style={{ marginRight: "0.4rem" }}>
                          {CUSTODY_LABELS[i] ?? `Handler ${i + 1}`}
                        </span>
                        {i === data.trail.length - 1 && (
                          <span className="badge badge-green">Current</span>
                        )}
                      </div>
                      <a href={`https://sepolia.etherscan.io/address/${addr}`}
                         target="_blank" rel="noopener noreferrer"
                         style={{ fontSize: "0.78rem", color: "var(--text-muted)",
                                  fontFamily: "monospace", display: "flex",
                                  alignItems: "center", gap: "0.25rem" }}>
                        {shortAddr(addr)} <ExternalLink size={10} />
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Full sensor history table */}
          {data.readings.length > 0 && (
            <div className="card">
              <h4 style={{ marginBottom: "1rem", display: "flex",
                           alignItems: "center", gap: "0.5rem" }}>
                <Thermometer size={15} />
                Sensor History — {data.readings.length} reading{data.readings.length !== 1 ? "s" : ""}
              </h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["#", "Temperature", "Humidity", "Recorded At"].map(h => (
                        <th key={h} className="mono-label"
                            style={{ padding: "0.4rem 0.75rem", textAlign: "left", fontWeight: 600 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.readings.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.55rem 0.75rem", color: "var(--text-muted)" }}>{i + 1}</td>
                        <td style={{ padding: "0.55rem 0.75rem", color: "var(--accent)", fontWeight: 600 }}>
                          {r.temperature.toFixed(1)}°C
                        </td>
                        <td style={{ padding: "0.55rem 0.75rem" }}>{r.humidity}%</td>
                        <td style={{ padding: "0.55rem 0.75rem", color: "var(--text-muted)",
                                     fontFamily: "monospace", fontSize: "0.78rem" }}>
                          {formatTs(r.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div style={{ textAlign: "center", padding: "3rem 1rem",
                      color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Enter a Batch ID above to trace the coffee's journey.
        </div>
      )}
    </div>
  );
}

function SensorCard({ icon, label, value, small = false }:
  { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <div className="card-sm" style={{ flex: 1, minWidth: 120 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem",
                    marginBottom: "0.4rem", color: "var(--text-muted)" }}>
        {icon}
        <span className="mono-label">{label}</span>
      </div>
      <p style={{ fontWeight: 700, fontSize: small ? "0.85rem" : "1.25rem",
                  color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}