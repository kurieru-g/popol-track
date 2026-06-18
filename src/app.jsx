import { useState, useEffect } from "react";

// ── constants ────────────────────────────────────────────────────────────────
const PATTERNS = {
  "2-2-3": [2, 2, 3],
  "3-2-2": [3, 2, 2],
  "2-3-2": [2, 3, 2],
};

// PvP slots per cycle
// Cycle 1: R1B2 R1B3 R1B4 R1B5 R2B1 R2B2 R2B4
// Cycle 2+: starts R2B5, then R3B1 R3B2 R3B4 R3B5 R4B1 R4B2 etc.
function generateSlots(numCycles = 4) {
  const slots = [];
  // Cycle 1
  const c1 = ["R1B2","R1B3","R1B4","R1B5","R2B1","R2B2","R2B4"];
  c1.forEach(s => slots.push({ label: s, cycle: 1 }));
  // Cycle 2 starts at R2B5
  for (let c = 2; c <= numCycles; c++) {
    const rBase = c === 2 ? 2 : c; // round offset
    // Cycle 2: R2B5, R3B1, R3B2, R3B4, R3B5, R4B1, R4B2
    // Cycle 3: R4B5, R5B1, R5B2, R5B4, R5B5, R6B1, R6B2
    const r = c + 1; // round that this cycle starts continuation from
    const cycleSlots = [
      `R${c}B5`,
      `R${r}B1`, `R${r}B2`, `R${r}B4`, `R${r}B5`,
      `R${r+1}B1`, `R${r+1}B2`,
    ];
    cycleSlots.forEach(s => slots.push({ label: s, cycle: c }));
  }
  return slots;
}

const ALL_SLOTS = generateSlots(5);

// ── helpers ──────────────────────────────────────────────────────────────────
function detectPattern(cycleOpponents) {
  // cycleOpponents: array of opponent names in order, 7 items
  if (cycleOpponents.length < 3) return null;
  for (const [patKey, pat] of Object.entries(PATTERNS)) {
    // Check if observed sequence fits this pattern
    // Group 1: indices 0..pat[0]-1
    // Group 2: pat[0]..pat[0]+pat[1]-1
    // Group 3: pat[0]+pat[1]..6
    const g1 = cycleOpponents.slice(0, pat[0]);
    const g2 = cycleOpponents.slice(pat[0], pat[0] + pat[1]);
    const g3 = cycleOpponents.slice(pat[0] + pat[1]);
    const allUnique = new Set([...g1, ...g2, ...g3]).size === cycleOpponents.length;
    if (allUnique) return { patKey, groups: [g1, g2, g3], pat };
  }
  return null;
}

function predictNext(cycleOpponents, opponents, patternInfo) {
  if (!patternInfo) return [];
  const { pat, groups } = patternInfo;
  const seen = cycleOpponents.length;
  // Find which group position we're in
  const g1end = pat[0];
  const g2end = pat[0] + pat[1];

  let currentGroupIdx;
  if (seen <= g1end) currentGroupIdx = 0;
  else if (seen <= g2end) currentGroupIdx = 1;
  else currentGroupIdx = 2;

  // Remaining in current group
  const groupStart = currentGroupIdx === 0 ? 0 : currentGroupIdx === 1 ? g1end : g2end;
  const groupEnd = currentGroupIdx === 0 ? g1end : currentGroupIdx === 1 ? g2end : 7;
  const remaining = groupEnd - seen;

  // Opponents not yet seen this cycle
  const notSeen = opponents.filter(o => o && !cycleOpponents.includes(o));

  if (remaining > 0 && groups[currentGroupIdx]) {
    // Predict: remaining slots in current group = opponents already in that group that haven't appeared
    return groups[currentGroupIdx].filter(o => !cycleOpponents.includes(o));
  }
  return notSeen.slice(0, 1);
}

// ── color helpers ─────────────────────────────────────────────────────────────
const GROUP_COLORS = ["#22d3ee","#a78bfa","#34d399"];
const GROUP_BG = ["rgba(34,211,238,0.08)","rgba(167,139,250,0.08)","rgba(52,211,153,0.08)"];
const GROUP_BORDER = ["rgba(34,211,238,0.3)","rgba(167,139,250,0.3)","rgba(52,211,153,0.3)"];

// ── main component ────────────────────────────────────────────────────────────
export default function MCGGTracker() {
  const [opponents, setOpponents] = useState(Array(7).fill(""));
  const [setupDone, setSetupDone] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]); // [{slot, opponent, cycle}]
  const [selectedSlot, setSelectedSlot] = useState(0); // index into ALL_SLOTS
  const [editingOpp, setEditingOpp] = useState(null); // slot index being edited
  const [newOppInput, setNewOppInput] = useState("");

  // Derived: current cycle
  const currentCycle = ALL_SLOTS[selectedSlot]?.cycle ?? 1;

  // Matches in current cycle
  const cycleMatches = matchHistory.filter(m => m.cycle === currentCycle);
  const cycleOpponents = cycleMatches.map(m => m.opponent);

  // Detect pattern for current cycle
  const patternInfo = cycleOpponents.length >= 3 ? detectPattern(cycleOpponents) : null;

  // Next prediction
  const predictions = patternInfo ? predictNext(cycleOpponents, opponents, patternInfo) : [];

  // Next slot to fill
  const nextSlotIdx = ALL_SLOTS.findIndex((s, i) => !matchHistory.find(m => m.slot === s.label) && i >= selectedSlot);

  function handleSetupDone() {
    if (opponents.filter(o => o.trim()).length < 7) return;
    setSetupDone(true);
  }

  function recordMatch(opponent) {
    const slot = ALL_SLOTS[selectedSlot];
    if (!slot) return;
    setMatchHistory(prev => [...prev, { slot: slot.label, opponent, cycle: slot.cycle }]);
    setSelectedSlot(prev => prev + 1);
    setEditingOpp(null);
  }

  function undoLast() {
    if (matchHistory.length === 0) return;
    setMatchHistory(prev => prev.slice(0, -1));
    setSelectedSlot(prev => Math.max(0, prev - 1));
  }

  function getGroupForOpponent(opp, pat, groups) {
    if (!groups) return null;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].includes(opp)) return i;
    }
    return null;
  }

  // ── styles ──────────────────────────────────────────────────────────────────
  const styles = {
    app: {
      minHeight: "100vh",
      background: "#0a0e1a",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace",
      padding: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
    header: {
      width: "100%",
      background: "linear-gradient(90deg, #0f172a 0%, #1e1b4b 100%)",
      borderBottom: "1px solid rgba(99,102,241,0.3)",
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    trapIcon: {
      fontSize: "28px",
      filter: "drop-shadow(0 0 8px #22d3ee)",
    },
    headerTitle: {
      fontSize: "18px",
      fontWeight: "700",
      color: "#22d3ee",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    },
    headerSub: {
      fontSize: "11px",
      color: "#64748b",
      letterSpacing: "0.1em",
    },
    container: {
      width: "100%",
      maxWidth: "480px",
      padding: "20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    },
    card: {
      background: "#0f172a",
      border: "1px solid rgba(99,102,241,0.2)",
      borderRadius: "12px",
      padding: "16px",
    },
    cardTitle: {
      fontSize: "11px",
      color: "#64748b",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      marginBottom: "12px",
    },
    oppGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
    },
    oppInput: {
      background: "#1e293b",
      border: "1px solid rgba(99,102,241,0.3)",
      borderRadius: "8px",
      color: "#e2e8f0",
      padding: "8px 10px",
      fontSize: "13px",
      fontFamily: "inherit",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
    },
    btn: {
      background: "linear-gradient(135deg, #3730a3 0%, #1e40af 100%)",
      border: "none",
      borderRadius: "8px",
      color: "#e2e8f0",
      padding: "10px 20px",
      fontSize: "13px",
      fontFamily: "inherit",
      fontWeight: "700",
      cursor: "pointer",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      transition: "opacity 0.15s",
    },
    btnCyan: {
      background: "linear-gradient(135deg, #0e7490 0%, #0891b2 100%)",
    },
    btnDanger: {
      background: "rgba(239,68,68,0.15)",
      border: "1px solid rgba(239,68,68,0.3)",
      color: "#f87171",
    },
    slotBadge: (active, done) => ({
      padding: "4px 8px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0.05em",
      background: done
        ? "rgba(52,211,153,0.1)"
        : active
        ? "rgba(34,211,238,0.15)"
        : "rgba(255,255,255,0.04)",
      border: done
        ? "1px solid rgba(52,211,153,0.3)"
        : active
        ? "1px solid rgba(34,211,238,0.4)"
        : "1px solid rgba(255,255,255,0.08)",
      color: done ? "#34d399" : active ? "#22d3ee" : "#475569",
    }),
    oppChip: (groupIdx) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "5px 10px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      background: groupIdx != null ? GROUP_BG[groupIdx] : "rgba(255,255,255,0.05)",
      border: `1px solid ${groupIdx != null ? GROUP_BORDER[groupIdx] : "rgba(255,255,255,0.1)"}`,
      color: groupIdx != null ? GROUP_COLORS[groupIdx] : "#94a3b8",
      cursor: "pointer",
      transition: "all 0.15s",
      userSelect: "none",
    }),
    predictionPulse: {
      animation: "pulse 1.5s ease-in-out infinite",
    },
  };

  // ── render: setup screen ────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div style={styles.app}>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
          @keyframes glow { 0%,100%{box-shadow:0 0 8px rgba(34,211,238,0.3)} 50%{box-shadow:0 0 20px rgba(34,211,238,0.6)} }
          input::placeholder { color: #334155; }
          button:hover { opacity: 0.85; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: #0a0e1a; }
          ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        `}</style>
        <div style={styles.header}>
          <span style={styles.trapIcon}>🪤</span>
          <div>
            <div style={styles.headerTitle}>Popol & Kupa Tracker</div>
            <div style={styles.headerSub}>MCGG · Opponent Predictor</div>
          </div>
        </div>
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Setup — Masukkan 7 Nama Lawan</div>
            <div style={{ fontSize: "12px", color: "#475569", marginBottom: "14px", lineHeight: "1.6" }}>
              Lihat nama pemain di lobby sebelum game dimulai, lalu input di bawah. Urutan bebas.
            </div>
            <div style={styles.oppGrid}>
              {opponents.map((opp, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "10px", color: "#334155", minWidth: "14px" }}>{i+1}</span>
                  <input
                    style={styles.oppInput}
                    placeholder={`Lawan ${i+1}`}
                    value={opp}
                    onChange={e => {
                      const arr = [...opponents];
                      arr[i] = e.target.value;
                      setOpponents(arr);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && i < 6) {
                        const next = document.querySelectorAll("input[placeholder]")[i+1];
                        if (next) next.focus();
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: "14px" }}>
              <button
                style={{
                  ...styles.btn,
                  width: "100%",
                  opacity: opponents.filter(o => o.trim()).length < 7 ? 0.4 : 1,
                }}
                onClick={handleSetupDone}
              >
                Mulai Tracking →
              </button>
            </div>
          </div>
          <div style={{ ...styles.card, background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.15)" }}>
            <div style={{ fontSize: "11px", color: "#22d3ee", marginBottom: "8px", letterSpacing: "0.1em" }}>ℹ️ CARA PAKAI</div>
            <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.7" }}>
              1. Input nama 7 lawan di atas<br/>
              2. Setiap babak PvP, tap nama lawan yang kamu hadapi<br/>
              3. App akan mendeteksi pola 2-2-3 / 3-2-2 / 2-3-2<br/>
              4. Prediksi lawan berikutnya akan muncul otomatis
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── render: tracker screen ──────────────────────────────────────────────────
  const currentSlot = ALL_SLOTS[selectedSlot];
  const isFinished = !currentSlot;

  return (
    <div style={styles.app}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px rgba(34,211,238,0.3)} 50%{box-shadow:0 0 20px rgba(34,211,238,0.6)} }
        @keyframes slideIn { from{transform:translateY(4px);opacity:0} to{transform:translateY(0);opacity:1} }
        button:hover { opacity: 0.85 !important; }
        input::placeholder { color: #334155; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0e1a; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
      `}</style>

      <div style={styles.header}>
        <span style={styles.trapIcon}>🪤</span>
        <div style={{ flex: 1 }}>
          <div style={styles.headerTitle}>Popol & Kupa Tracker</div>
          <div style={styles.headerSub}>MCGG · Opponent Predictor</div>
        </div>
        <button
          style={{ ...styles.btn, ...styles.btnDanger, padding: "6px 12px", fontSize: "11px" }}
          onClick={() => { setSetupDone(false); setMatchHistory([]); setSelectedSlot(0); setOpponents(Array(7).fill("")); }}
        >
          Reset
        </button>
      </div>

      <div style={styles.container}>

        {/* Current slot indicator */}
        <div style={{ ...styles.card, animation: "slideIn 0.3s ease" }}>
          <div style={styles.cardTitle}>Babak Sekarang</div>
          {isFinished ? (
            <div style={{ color: "#34d399", fontSize: "14px", fontWeight: "700" }}>✅ Semua siklus selesai ditrack!</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <div style={{
                  padding: "8px 14px",
                  background: "rgba(34,211,238,0.1)",
                  border: "1px solid rgba(34,211,238,0.4)",
                  borderRadius: "8px",
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#22d3ee",
                  letterSpacing: "0.05em",
                  animation: "glow 2s ease-in-out infinite",
                }}>
                  {currentSlot.label}
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>Siklus ke-{currentSlot.cycle}</div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>
                    Slot {selectedSlot + 1} / {ALL_SLOTS.length}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
                Tap nama lawan yang kamu hadapi sekarang:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {opponents.map((opp, i) => {
                  if (!opp.trim()) return null;
                  const groupIdx = patternInfo ? getGroupForOpponent(opp, patternInfo.pat, patternInfo.groups) : null;
                  const alreadyThisCycle = cycleOpponents.includes(opp);
                  return (
                    <button
                      key={i}
                      style={{
                        ...styles.oppChip(groupIdx),
                        opacity: alreadyThisCycle ? 0.3 : 1,
                        cursor: alreadyThisCycle ? "not-allowed" : "pointer",
                      }}
                      onClick={() => !alreadyThisCycle && recordMatch(opp)}
                      disabled={alreadyThisCycle}
                    >
                      {predictions.includes(opp) && (
                        <span style={{ fontSize: "10px", animation: "pulse 1.5s infinite" }}>⚡</span>
                      )}
                      {opp}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pattern detection */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Deteksi Pola · Siklus {currentCycle}</div>
          {cycleOpponents.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#334155" }}>Belum ada data babak ini...</div>
          ) : patternInfo ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{
                  padding: "4px 12px",
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.3)",
                  borderRadius: "6px",
                  color: "#34d399",
                  fontSize: "14px",
                  fontWeight: "700",
                  letterSpacing: "0.1em",
                }}>
                  {patternInfo.patKey}
                </div>
                <span style={{ fontSize: "11px", color: "#34d399" }}>Pola terdeteksi ✓</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {patternInfo.groups.map((group, gi) => (
                  <div key={gi} style={{
                    padding: "8px 10px",
                    background: GROUP_BG[gi],
                    border: `1px solid ${GROUP_BORDER[gi]}`,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: "10px", color: GROUP_COLORS[gi], minWidth: "48px", letterSpacing: "0.1em" }}>
                      GRUP {gi+1} ({group.length})
                    </span>
                    {group.map((opp, j) => (
                      <span key={j} style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: GROUP_COLORS[gi],
                        opacity: cycleOpponents.includes(opp) ? 1 : 0.4,
                        textDecoration: cycleOpponents.includes(opp) ? "none" : "none",
                      }}>
                        {cycleOpponents.includes(opp) ? "✓ " : "○ "}{opp}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.6" }}>
              <div style={{ marginBottom: "8px" }}>
                {cycleOpponents.length}/7 lawan tercatat:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cycleOpponents.map((o, i) => (
                  <span key={i} style={{ ...styles.oppChip(null), fontSize: "11px" }}>{o}</span>
                ))}
              </div>
              <div style={{ marginTop: "8px", color: "#334155" }}>
                Butuh minimal 3 data untuk deteksi pola...
              </div>
            </div>
          )}
        </div>

        {/* Prediction */}
        {predictions.length > 0 && !isFinished && (
          <div style={{
            ...styles.card,
            background: "rgba(34,211,238,0.05)",
            border: "1px solid rgba(34,211,238,0.25)",
            animation: "slideIn 0.3s ease",
          }}>
            <div style={styles.cardTitle}>⚡ Prediksi Lawan Berikutnya</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {predictions.map((opp, i) => (
                <div key={i} style={{
                  padding: "8px 14px",
               background: "rgba(34,211,238,0.12)",
                  border: "1px solid rgba(34,211,238,0.5)",
                  borderRadius: "20px",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#22d3ee",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}>
                  {opp}
                </div>
              ))}
            </div>
            <div style={{ fontSize: "11px", color: "#334155", marginTop: "8px" }}>
              Berdasarkan pola {patternInfo?.patKey} · Pasang trap sekarang!
            </div>
          </div>
        )}

        {/* Match history timeline */}
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={styles.cardTitle}>Riwayat Match</div>
            {matchHistory.length > 0 && (
              <button
                style={{ ...styles.btn, ...styles.btnDanger, padding: "4px 10px", fontSize: "11px" }}
                onClick={undoLast}
              >
                ↩ Undo
              </button>
            )}
          </div>
          {matchHistory.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#334155" }}>Belum ada match yang direcord...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {matchHistory.map((m, i) => {
                const groupIdx = patternInfo && m.cycle === currentCycle
                  ? getGroupForOpponent(m.opponent, patternInfo.pat, patternInfo.groups)
                  : null;
                return (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.02)",
                  }}>
                    <span style={{ ...styles.slotBadge(false, true), minWidth: "52px", textAlign: "center" }}>
                      {m.slot}
                    </span>
                    <span style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: groupIdx != null ? GROUP_COLORS[groupIdx] : "#94a3b8",
                      flex: 1,
                    }}>
                      {m.opponent}
                    </span>
                    <span style={{ fontSize: "10px", color: "#334155" }}>S{m.cycle}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming slots preview */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Urutan Babak PvP</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {ALL_SLOTS.slice(0, 21).map((s, i) => {
              const done = matchHistory.find(m => m.slot === s.label);
              const active = i === selectedSlot;
              return (
                <span key={i} style={styles.slotBadge(active, !!done)}>
                  {s.label}
                </span>
              );
            })}
            <span style={{ fontSize: "10px", color: "#334155", alignSelf: "center" }}>...</span>
          </div>
        </div>

      </div>
    </div>
  );
}
