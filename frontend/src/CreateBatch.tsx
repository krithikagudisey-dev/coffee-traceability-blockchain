import { useState } from "react";
import { PackagePlus, Loader2, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { ethers } from "ethers";

interface CreateBatchProps {
  contract: ethers.Contract | null;
  address: string | null;
}

export default function CreateBatch({ contract, address }: CreateBatchProps) {
  const [origin, setOrigin] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "confirmed" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [newBatchId, setNewBatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!contract || !address) return;
    if (!origin.trim()) { setError("Origin name is required."); return; }

    setStatus("pending");
    setError(null);

    try {
      // Step 1: Call contract
      const tx = await contract.createBatch(origin.trim());
      setTxHash(tx.hash);

      // Step 2: Wait for confirmation
      const receipt = await tx.wait();

      // Step 3: Extract Batch ID from event logs
      // The BatchCreated event is the first event usually
      const event = receipt.logs
        .map((log: any) => {
          try { return contract.interface.parseLog(log); } catch { return null; }
        })
        .find((e: any) => e?.name === "BatchCreated");

      if (event) {
        setNewBatchId(Number(event.args.batchId));
      }

      setStatus("confirmed");
      setOrigin(""); // clear input
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setError(err.code === "ACTION_REJECTED" 
        ? "Transaction rejected in MetaMask." 
        : (err.reason || err.message || "Blockchain error"));
    }
  }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "0.75rem 1.5rem 2rem" }}>
      
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
          Farmer Portal
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Initialize a new coffee batch on the blockchain to begin its journey.
        </p>
      </div>

      {/* Wallet guard */}
      {!address && (
        <div className="card-sm" style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "0.75rem", 
          borderColor: "rgba(180, 83, 9, 0.25)", 
          marginBottom: "1.25rem", 
          background: "rgba(180, 83, 9, 0.04)" 
        }}>
          <AlertCircle size={16} color="#b45309" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>
            Connect your wallet to create a new batch.
          </span>
        </div>
      )}

      {/* Create Form */}
      <div className="card">
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label className="mono-label" style={{ display: "block", marginBottom: "0.5rem" }}>
              ORIGIN NAME
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. Test Farm Alpha"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              disabled={status === "pending" || !address}
              style={{ width: "100%" }}
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={status === "pending" || !address || !origin.trim()}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {status === "pending" ? (
              <><Loader2 size={14} className="animate-spin" style={{ marginRight: 8 }} /> Creating...</>
            ) : (
              <><PackagePlus size={14} style={{ marginRight: 8 }} /> Create New Batch</>
            )}
          </button>
        </form>
      </div>

      {/* Results / Status */}
      {(status === "pending" || status === "confirmed" || status === "error") && (
        <div className="card" style={{ 
          marginTop: "1.25rem",
          borderColor: status === "confirmed" ? "rgba(74,156,93,0.4)" : status === "error" ? "rgba(248,113,113,0.3)" : "var(--border-bright)"
        }}>
          {status === "pending" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Loader2 size={18} color="var(--accent)" className="animate-spin" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Confirm in MetaMask...</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Mining your transaction on Sepolia...
                </div>
              </div>
            </div>
          )}

          {status === "confirmed" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
                <CheckCircle2 size={20} color="#4ade80" />
                <span style={{ fontSize: 14, color: "#4ade80", fontWeight: 600 }}>Batch Successfully Created!</span>
              </div>
              
              <div className="card-sm" style={{ background: "rgba(255,255,255,0.03)", marginBottom: "1rem" }}>
                <div className="mono-label" style={{ fontSize: 10, marginBottom: 4 }}>ASSIGNED BATCH ID</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>#{newBatchId}</div>
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Transaction Hash:</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all", background: "var(--surface)", padding: "4px 8px", borderRadius: 4, flex: 1 }}>
                  {txHash}
                </code>
                <button 
                  onClick={() => navigator.clipboard.writeText(txHash!)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  <Copy size={12} />
                </button>
              </div>
              
              <hr className="divider" />
              <button className="btn-outline" style={{ width: "100%", fontSize: 12 }} onClick={() => setStatus("idle")}>
                Create Another Batch
              </button>
            </div>
          )}

          {status === "error" && (
            <div style={{ display: "flex", gap: 12 }}>
              <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ overflow: "hidden", width: "100%" }}>
                <div style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>Creation Failed</div>
                <div style={{ 
                  fontSize: 11, 
                  color: "var(--text-muted)", 
                  marginTop: 6,
                  wordBreak: "break-word",
                  lineHeight: 1.5,
                  maxHeight: "150px",
                  overflowY: "auto",
                  paddingRight: "4px"
                }}>
                  {error}
                </div>
                <button className="btn-outline" style={{ marginTop: 12, fontSize: 11 }} onClick={() => setStatus("idle")}>
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
