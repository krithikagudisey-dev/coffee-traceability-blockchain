import { useState, useEffect } from "react";
import { Wallet, Unplug, Loader2 } from "lucide-react";

interface WalletBarProps {
  address:      string | null;
  loading:      boolean;
  error:        string | null;
  onConnect:    () => void;
  onDisconnect: () => void;
}

export default function WalletBar({
  address, loading, error, onConnect, onDisconnect,
}: WalletBarProps) {
  const short = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  // Auto-dismiss the error after 4 seconds
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!error) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      alignItems:    "flex-end",
      gap:           "0.35rem",
    }}>

      {address ? (
        /* ── Connected: single inline pill ── */
        <div style={{
          display:      "flex",
          alignItems:   "center",
          gap:          "0.5rem",
          background:   "var(--surface)",
          border:       "1px solid var(--border-bright)",
          borderRadius: "8px",
          padding:      "6px 10px 6px 12px",
          whiteSpace:   "nowrap",   // ← prevents any wrapping inside the pill
        }}>
          {/* Green dot */}
          <span style={{
            width:        7,
            height:       7,
            borderRadius: "50%",
            background:   "var(--green)",
            flexShrink:   0,
          }} />

          {/* Short address */}
          <span style={{
            fontSize:   "0.78rem",
            fontFamily: "monospace",
            color:      "var(--text-muted)",
            userSelect: "none",
          }}>
            {short}
          </span>

          {/* Sepolia badge */}
          <span className="badge badge-green">Sepolia</span>

          {/* Divider */}
          <span style={{
            width:      1,
            height:     16,
            background: "var(--border-bright)",
            margin:     "0 2px",
            flexShrink: 0,
          }} />

          {/* Disconnect icon button */}
          <button
            onClick={onDisconnect}
            title="Disconnect wallet"
            style={{
              background:   "transparent",
              border:       "none",
              padding:      "2px 4px",
              cursor:       "pointer",
              color:        "var(--text-muted)",
              display:      "flex",
              alignItems:   "center",
              borderRadius: "4px",
              transition:   "color 0.15s",
              flexShrink:   0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Unplug size={13} />
          </button>
        </div>

      ) : (
        /* ── Disconnected: single clean button ── */
        <button
          className="btn-primary"
          onClick={onConnect}
          disabled={loading}
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        "0.4rem",
            padding:    "8px 16px",
            whiteSpace: "nowrap",   // ← prevents "Connect Wallet" from wrapping
          }}
        >
          {loading
            ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />
            : <Wallet size={13} />
          }
          {loading ? "Connecting…" : "Connect Wallet"}
        </button>
      )}

      {/* Error — single line, auto-dismisses after 4s */}
      {visible && error && (
        <p style={{
          fontSize:   "0.7rem",
          color:      "var(--text-muted)",
          fontStyle:  "italic",
          margin:     0,
          lineHeight: 1.4,
          whiteSpace: "nowrap",   // ← the key fix — no wrapping
        }}>
          ⚠ {error}
        </p>
      )}

    </div>
  );
}