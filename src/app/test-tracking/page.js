"use client";

import { useState } from "react";

export default function DebugPage() {
  const [debug, setDebug] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runDebug() {
    setLoading(true);
    setDebug(null);

    const res = await fetch("/api/debug-tracking");
    const data = await res.json();

    setDebug(data);
    setLoading(false);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Bring Tracking Debug</h1>

      <button
        onClick={runDebug}
        style={{
          padding: "12px 20px",
          background: "black",
          color: "white",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Run Debug Test
      </button>

      {loading && <p>Loading…</p>}

      {debug && (
        <pre
          style={{
            marginTop: 20,
            background: "#eee",
            padding: 20,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
{JSON.stringify(debug, null, 2)}
        </pre>
      )}
    </div>
  );
}
