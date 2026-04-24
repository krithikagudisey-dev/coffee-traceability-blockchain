import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, CheckCircle2, Loader2, AlertCircle, Camera, CameraOff } from "lucide-react";
import { ethers } from "ethers";

interface QRScannerProps {
  contract: ethers.Contract | null;
  address: string | null;
}

export default function QRScanner({ contract, address }: QRScannerProps) {
  const [scanning, setScanning]     = useState<boolean>(false);
  const [scannedId, setScannedId]   = useState<number | null>(null);
  const [txStatus, setTxStatus]     = useState<"pending" | "confirmed" | "error" | null>(null);
  const [txHash, setTxHash]         = useState<string | null>(null);
  const [txError, setTxError]       = useState<string | null>(null);
  const html5Ref   = useRef<Html5Qrcode | null>(null);

  // Start camera + scanning
  async function startScanner() {
    setScannedId(null);
    setTxStatus(null);
    setTxError(null);

    const qr = new Html5Qrcode("qr-reader");
    html5Ref.current = qr;

    try {
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        onScanSuccess,
        () => {} // ignore per-frame errors
      );
      setScanning(true);
    } catch (err: any) {
      setTxError("Camera access denied: " + (err.message || String(err)));
    }
  }

  async function stopScanner() {
    if (html5Ref.current) {
      await html5Ref.current.stop().catch(() => {});
      html5Ref.current = null;
    }
    setScanning(false);
  }

  // Called when QR code is successfully decoded
  async function onScanSuccess(decoded: string) {
    await stopScanner();

    const batchId = parseInt(decoded.trim());
    if (isNaN(batchId)) {
      setTxError(`Invalid QR content: "${decoded}" — expected a batch number`);
      return;
    }

    setScannedId(batchId);

    if (!contract || !address) {
      setTxError("Connect your wallet first before claiming custody.");
      return;
    }

    setTxStatus("pending");
    setTxError(null);

    try {
      // MetaMask popup opens here
      const tx = await contract.transferCustody(batchId);
      setTxHash(tx.hash);

      await tx.wait(); // wait for block confirmation
      setTxStatus("confirmed");
    } catch (err: any) {
      setTxStatus("error");
      setTxError(
        err.code === "ACTION_REJECTED"
          ? "Transaction rejected in MetaMask."
          : (err.message || String(err))
      );
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
          Claim Custody
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Scan the QR code on the coffee bag to record your wallet as the current custodian.
        </p>
      </div>

      {/* Wallet guard */}
      {!address && (
        <div className="card-sm flex gap-3 items-start" style={{ borderColor: "rgba(250,204,21,0.3)", marginBottom: "1.25rem", background: "rgba(250,204,21,0.05)" }}>
          <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#fbbf24" }}>Connect your wallet (top right) before scanning.</span>
        </div>
      )}

      {/* QR Reader box */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div
          id="qr-reader"
          style={{
            width: "100%",
            minHeight: scanning ? 280 : 0,
            borderRadius: 8,
            overflow: "hidden",
          }}
        />

        {!scanning && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "2.5rem 1rem", gap: "1rem"
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: "var(--accent-glow)", display: "flex",
              alignItems: "center", justifyContent: "center"
            }}>
              <ScanLine size={28} color="var(--accent)" />
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", margin: 0 }}>
              Camera is off. Press scan to activate.
            </p>
            <button className="btn-primary" onClick={startScanner} disabled={!address}>
              <Camera size={13} style={{ display: "inline", marginRight: 6 }} />
              Start Scanning
            </button>
          </div>
        )}

        {scanning && (
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <button className="btn-outline" onClick={stopScanner} style={{ fontSize: 12 }}>
              <CameraOff size={12} style={{ display: "inline", marginRight: 6 }} />
              Stop Camera
            </button>
          </div>
        )}
      </div>

      {/* Transaction status */}
      {scannedId !== null && (
        <div className="card" style={{
          borderColor: txStatus === "confirmed"
            ? "rgba(74,156,93,0.4)"
            : txStatus === "error"
            ? "rgba(248,113,113,0.3)"
            : "var(--border-bright)"
        }}>
          <div className="mono-label" style={{ marginBottom: "0.75rem" }}>Batch #{scannedId}</div>

          {txStatus === "pending" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 size={16} color="var(--accent)" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: "var(--text)" }}>Waiting for MetaMask confirmation...</div>
                {txHash && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    TX: {txHash.slice(0, 10)}...{txHash.slice(-6)}
                  </div>
                )}
              </div>
            </div>
          )}

          {txStatus === "confirmed" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <CheckCircle2 size={18} color="#4ade80" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 500 }}>Custody claimed on-chain!</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Transaction hash:</div>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "#60a5fa", wordBreak: "break-all" }}
              >
                {txHash}
              </a>
              <hr className="divider" />
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={startScanner}>
                <ScanLine size={12} style={{ display: "inline", marginRight: 6 }} />
                Scan another bag
              </button>
            </div>
          )}

          {txStatus === "error" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#f87171" }}>Transaction failed</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>{txError}</p>
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={startScanner}>
                Try again
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
