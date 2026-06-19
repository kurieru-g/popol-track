import { useState } from "react";

// ── constants ────────────────────────────────────────────────────────────────
const PATTERNS = {
  "2-2-3": [2, 2, 3],
  "3-2-2": [3, 2, 2],
  "2-3-2": [2, 3, 2],
};

function generateSlots(numCycles = 6) {
  const slots = [];
  const c1 = ["R1B2","R1B3","R1B4","R1B5","R2B1","R2B2","R2B4"];
  c1.forEach(s => slots.push({ label: s, cycle: 1 }));
  for (let c = 2; c <= numCycles; c++) {
    const r = c + 1;
    const cycleSlots = [
      `R${c}B5`,
      `R${r}B1`, `R${r}B2`, `R${r}B4`, `R${r}B5`,
      `R${r+1}B1`, `R${r+1}B2`,
    ];
    cycleSlots.forEach(s => slots.push({ label: s, cycle: c }));
  }
  return slots;
}

const ALL_SLOTS = generateSlots(6);

// ── pattern detection ─────────────────────────────────────────────────────────
// Deteksi pola berdasarkan posisi lawan di siklus sebelumnya
// cycle1Order = urutan 7 lawan di siklus 1 (index 0-6)
// cycle2Sequence = urutan lawan yang muncul di siklus 2 (bisa belum lengkap)
function detectPatternFromCycles(cycle1Order, cycle2Sequence) {
  if (cycle1Order.length < 7 || cycle2Sequence.length === 0) return null;

  // Posisi lawan pertama di siklus 2, dalam urutan siklus 1
  const firstOpp = cycle2Sequence[0];
  const posInCycle1 = cycle1Order.indexOf(firstOpp);
  if (posInCycle1 === -1) return null; // mirror atau unknown

  // posInCycle1 adalah index (0-based) lawan pertama siklus 2 di urutan siklus 1
  // Ini = awal grup 1 di siklus 2
  // Cocokkan ke pola:
  // 2-2-3: grup1 = pos 0,1 | grup2 = pos 2,3 | grup3 = pos 4,5,6
  //   → lawan pertama siklus2 harusnya ada di pos 0 (awal grup1 baru)
  //   Tapi karena diacak ulang, posInCycle1 bisa apa aja
  //   Yang bisa kita simpulkan: berapa orang yang datang SEBELUM ganti grup

  // Pendekatan: cari pola yang konsisten dengan semua data cycle2Sequence
  const candidates = [];

  for (const [patKey, pat] of Object.entries(PATTERNS)) {
    // Asumsikan siklus 2 dikelompokkan ulang dari cycle1Order
    // Tapi urutannya diacak → kita tidak tahu mapping pasti
    // Yang bisa kita deteksi: kapan "ganti grup" terjadi

    // Strategi: lihat apakah ada perubahan "blok" di cycle2Sequence
    // berdasarkan jeda posisi di cycle1Order
    // Kalau dalam 1 blok, posisi cycle1 mereka "berdekatan" atau "satu blok"

    // Coba assign cycle2Sequence ke grup-grup pola ini
    // Grup 1 = cycle2Sequence[0 .. pat[0]-1]
    // Grup 2 = cycle2Sequence[pat[0] .. pat[0]+pat[1]-1]
    // Grup 3 = cycle2Sequence[pat[0]+pat[1] .. 6]

    const g1 = cycle2Sequence.slice(0, pat[0]);
    const g2 = cycle2Sequence.slice(pat[0], pat[0] + pat[1]);
    const g3 = cycle2Sequence.slice(pat[0] + pat[1]);

    // Validasi: tidak ada duplikat antar grup
    const all = [...g1, ...g2, ...g3];
    if (new Set(all).size !== all.length) continue;

    // Validasi ukuran tidak melebihi batas pola
    if (g1.length > pat[0] || g2.length > pat[1] || g3.length > pat[2]) continue;

    candidates.push({ patKey, pat, groups: [g1, g2, g3] });
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Kalau masih ambiguous, pakai posisi kunci untuk narrowing
  // Posisi ke-1 (index 0) di cycle2 → selalu awal grup 1, semua pola mungkin
  // Setelah posisi ke-3 (index 2) muncul → bisa narrowing
  // Posisi ke-6 (index 5) → bisa narrowing lebih lanjut

  if (cycle2Sequence.length >= 3) {
    // Cek apakah lawan index 2 (orang ke-3) adalah awal grup baru
    // Di 2-2-3: grup2 mulai di index 2 → ganti grup setelah 2 orang
    // Di 3-2-2: masih dalam grup1 sampai index 2 → belum ganti
    // Di 2-3-2: grup2 mulai di index 2 → ganti grup setelah 2 orang

    // Cara paling reliable: lihat apakah lawan ke-3 pernah "berdampingan" dengan lawan ke-1 atau ke-2 di cycle1
    // Tapi ini terlalu kompleks tanpa data grup sebenarnya

    // Fallback: kembalikan candidates pertama yang paling sedikit grupnya dulu
    // Prioritas: kalau posInCycle1 = 0 atau 1 → kemungkinan bukan 3-2-2 awal
    // kalau posInCycle1 = 2 atau lebih → kemungkinan 3-2-2
  }

  // Kembalikan semua kandidat, biarkan UI tampilkan ambiguitas
  return candidates[0];
}

// Setelah siklus 1 selesai dan lawan pertama siklus 2 diketahui,
// langsung narrowing pola berdasarkan logika 1-3-6
function narrowPatternByFirstOpponent(cycle1Order, firstOppOfCycle2) {
  const pos = cycle1Order.indexOf(firstOppOfCycle2); // 0-based
  if (pos === -1) return null;

  // pos = posisi lawan pertama siklus2 dalam urutan siklus1
  // Ini = orang pertama dari "grup 1 baru" di siklus 2
  // Tapi kita tidak tahu grup mana dia di siklus 2 karena diacak ulang

  // Yang bisa disimpulkan dari pos:
  // Ingat: posisi KUNCI adalah 1, 3, 6 (1-based) = index 0, 2, 5
  // Posisi ke-1 (index 0) di cycle2 = selalu awal grup 1
  // Kalau lawan ke-3 di cycle2 SAMA dengan yang datang setelah gap → awal grup 2

  // Pendekatan berbeda: tracking "siapa yang datang berurutan"
  // Kalau 2 orang datang lalu ganti → pola dimulai dengan 2 (2-2-3 atau 2-3-2)
  // Kalau 3 orang datang lalu ganti → pola dimulai dengan 3 (3-2-2)
  return null; // akan diisi dari tracking sequence
}

// Deteksi pola dari sequence siklus 2 dengan logika grup:
// Kita track kapan "blok baru" dimulai berdasarkan apakah lawan berikutnya
// pernah "bersebelahan" dengan lawan sebelumnya di cycle1
// Versi sederhana: deteksi dari jumlah lawan sebelum "lawan ke-3 di siklus 2"
function detectPattern(cycle1Order, cycle2Sequence) {
  if (cycle1Order.length < 7 || cycle2Sequence.length < 1) return null;

  // Kita tidak tahu grup asli, tapi kita bisa deteksi pola dari:
  // Seberapa jauh lawan ke-1, ke-3, ke-6 siklus2 "berjauhan" di urutan cycle1

  // Logika inti:
  // Lawan pertama siklus 2 = awal grup 1 → posisinya di cycle1 = P1
  // Lawan ketiga siklus 2 = kemungkinan awal grup 2 (kalau pola 2-x-x) atau masih grup 1 (kalau pola 3-x-x)
  // Lawan keenam siklus 2 = kemungkinan awal grup 3

  if (cycle2Sequence.length < 1) return null;

  const pos1 = cycle1Order.indexOf(cycle2Sequence[0]); // posisi lawan ke-1 siklus2 di cycle1

  // Kalau baru 1-2 data, cek apakah lawan ke-2 "berdekatan" dengan lawan ke-1 di cycle1
  // Ini belum cukup untuk deteksi pola

  if (cycle2Sequence.length < 3) {
    return { patKey: "?", ambiguous: true, pos1 };
  }

  const pos3 = cycle1Order.indexOf(cycle2Sequence[2]); // posisi lawan ke-3 siklus2 di cycle1

  // Kalau lawan ke-3 siklus2 posisinya di cycle1 "jauh" dari lawan ke-1 dan ke-2
  // berarti lawan ke-3 adalah awal grup baru → pola dimulai 2-x-x
  // Kalau masih "dalam blok yang sama" → pola dimulai 3-x-x

  // Cara deteksi "ganti grup": kita cek apakah lawan ke-1, 2, 3 di cycle2
  // bisa membentuk blok berukuran 3 di cycle1 (berarti 3-2-2)
  // atau lawan ke-1 dan ke-2 membentuk blok 2, lalu lawan ke-3 beda blok (berarti 2-x-x)

  // Kita pakai pendekatan: hitung "gap" posisi di cycle1
  const pos2 = cycle1Order.indexOf(cycle2Sequence[1]);

  // Cek apakah pos1, pos2, pos3 bisa jadi 1 blok berukuran 3
  // (artinya ketiganya berasal dari 1 grup yang sama di siklus baru)
  // Ini sulit tanpa tahu mapping grup siklus baru
  // Pendekatan pragmatis: gunakan jumlah kemunculan berurutan sebelum "lawan yang pernah muncul di antara mereka di cycle1"

  // ── Pendekatan final yang lebih pragmatis ──
  // Track: setelah berapa lawan, terjadi "jeda besar" di posisi cycle1
  // Jeda besar = selisih posisi cycle1 antara lawan berurutan > threshold

  // Sebenarnya cara paling akurat dari insight kamu:
  // Lawan pertama siklus 2 langsung kasih clue:
  // Kalau dia adalah orang ke-3 di cycle1 (index 2) → pola 3-2-2 (karena grup 1 = 3 orang, orang ke-3 = anggota terakhir atau tengah grup 1)
  // Tapi ini tidak langsung valid karena siklus baru diacak ulang

  // ── Implementasi berdasarkan insight posisi 1,3,6 ──
  // Setelah semua 7 lawan cycle2 datang, kita bisa tentukan polanya dengan pasti
  // Sebelum itu, kita narrowing dari lawan ke-3 dan ke-6

  if (cycle2Sequence.length >= 6) {
    // Lawan ke-6 (index 5) datang → bisa bedakan 2-3-2 vs 3-2-2
    // Di 2-3-2: grup3 mulai di index 5 → lawan ke-6 awal grup3
    // Di 3-2-2: grup3 mulai di index 5 → lawan ke-6 awal grup3
    // Di 2-2-3: grup3 mulai di index 4 → lawan ke-6 sudah di tengah grup3

    // Cek apakah lawan ke-3 (index 2) adalah "awal grup baru"
    // dengan melihat apakah lawan ke-1 dan ke-2 "satu paket" yang berbeda dari lawan ke-3
    // Ini kita deteksi dari: apakah di antara pos1/pos2 dan pos3 ada "lompatan" di cycle1

    // Kalau pola 2-2-3: index 0,1 = grup1 | 2,3 = grup2 | 4,5,6 = grup3
    // Kalau pola 3-2-2: index 0,1,2 = grup1 | 3,4 = grup2 | 5,6 = grup3
    // Kalau pola 2-3-2: index 0,1 = grup1 | 2,3,4 = grup2 | 5,6 = grup3

    // Test tiap pola, lihat mana yang paling "koheren" (anggota tiap grup berdekatan di cycle1)
    let bestPat = null;
    let bestScore = Infinity;

    for (const [patKey, pat] of Object.entries(PATTERNS)) {
      const g1 = cycle2Sequence.slice(0, pat[0]);
      const g2 = cycle2Sequence.slice(pat[0], pat[0] + pat[1]);
      const g3 = cycle2Sequence.slice(pat[0] + pat[1], 7);

      // Hitung "spread" posisi cycle1 tiap grup (makin kecil makin koheren)
      const calcSpread = (group) => {
        if (group.length <= 1) return 0;
        const positions = group.map(o => cycle1Order.indexOf(o)).filter(p => p !== -1);
        if (positions.length <= 1) return 0;
        return Math.max(...positions) - Math.min(...positions);
      };

      const score = calcSpread(g1) + calcSpread(g2) + calcSpread(g3);
      if (score < bestScore) {
        bestScore = score;
        const groups = [g1, g2, g3];
        bestPat = { patKey, pat, groups };
      }
    }

    return bestPat;
  }

  if (cycle2Sequence.length >= 3) {
    // Narrowing awal dari lawan ke-3
    // Kalau lawan ke-3 "koheren" dengan lawan ke-1 dan ke-2 di cycle1 → pola 3-x-x
    // Kalau tidak → pola 2-x-x
    const positions012 = [pos1, pos2, pos3].filter(p => p !== -1);
    if (positions012.length === 3) {
      const spread = Math.max(...positions012) - Math.min(...positions012);
      // Spread kecil = kemungkinan satu grup = 3-2-2
      // Spread besar = kemungkinan lawan ke-3 sudah ganti grup = 2-x-x
      if (spread <= 3) {
        return { patKey: "3-2-2", pat: [3,2,2], ambiguous: false, preliminary: true,
          groups: [cycle2Sequence.slice(0,3), cycle2Sequence.slice(3,5), cycle2Sequence.slice(5)] };
      } else {
        // Ambiguous antara 2-2-3 dan 2-3-2, tunggu lawan ke-6
        return { patKey: "2-?-?", ambiguous: true, preliminary: true,
          groups: [cycle2Sequence.slice(0,2), cycle2Sequence.slice(2), []] };
      }
    }
  }

  return { patKey: "?", ambiguous: true };
}

// Prediksi lawan berikutnya
function predictNext(cycle2Sequence, activeOpponents, patternInfo) {
  if (!patternInfo || patternInfo.ambiguous) return [];
  const { pat, groups } = patternInfo;
  const seen = cycle2Sequence.length;
  const g1end = pat[0];
  const g2end = pat[0] + pat[1];

  let currentGroupIdx;
  if (seen < g1end) currentGroupIdx = 0;
  else if (seen < g2end) currentGroupIdx = 1;
  else currentGroupIdx = 2;

  const currentGroup = groups[currentGroupIdx] || [];
  return currentGroup.filter(o => !cycle2Sequence.includes(o) && activeOpponents.includes(o));
}

// ── colors ───────────────────────────────────────────────────────────────────
const GROUP_COLORS = ["#22d3ee","#a78bfa","#34d399"];
const GROUP_BG = ["rgba(34,211,238,0.08)","rgba(167,139,250,0.08)","rgba(52,211,153,0.08)"];
const GROUP_BORDER = ["rgba(34,211,238,0.3)","rgba(167,139,250,0.3)","rgba(52,211,153,0.3)"];

// ── main component ────────────────────────────────────────────────────────────
export default function MCGGTracker() {
  const [opponents, setOpponents] = useState(Array(7).fill(""));
  const [eliminated, setEliminated] = useState([]);
  const [setupDone, setSetupDone] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [confirmedPattern, setConfirmedPattern] = useState(null);

  const currentSlot = ALL_SLOTS[selectedSlot];
  const currentCycle = currentSlot?.cycle ?? 1;
  const isFinished = !currentSlot;
  const activeOpponents = opponents.filter(o => o.trim() && !eliminated.includes(o));

  // Siklus 1: urutan lawan (non-mirror)
  const cycle1Matches = matchHistory.filter(m => m.cycle === 1 && !m.isMirror);
  const cycle1Order = cycle1Matches.map(m => m.opponent);

  // Siklus sekarang
  const cycleMatches = matchHistory.filter(m => m.cycle === currentCycle && !m.isMirror);
  const cycleOpponents = cycleMatches.map(m => m.opponent);

  // Deteksi pola dari siklus 2 (atau siklus aktif jika sudah > 2)
  const cycle2Matches = matchHistory.filter(m => m.cycle === 2 && !m.isMirror);
  const cycle2Sequence = cycle2Matches.map(m => m.opponent);
  const preliminaryPattern = cycle1Order.length === 7
    ? detectPattern(cycle1Order, currentCycle === 1 ? [] : currentCycle === 2 ? cycle2Sequence : cycleOpponents)
    : null;
  const activePattern = confirmedPattern || (preliminaryPattern && !preliminaryPattern.ambiguous ? preliminaryPattern : null);

  // Prediksi untuk siklus sekarang
  const predictions = activePattern && currentCycle >= 2
    ? predictNext(cycleOpponents, activeOpponents, activePattern)
    : [];

  function handleSetupDone() {
    if (opponents.filter(o => o.trim()).length < 7) return;
    setSetupDone(true);
  }

  function recordMatch(opponent, isMirror = false) {
    const slot = ALL_SLOTS[selectedSlot];
    if (!slot) return;
    const newHistory = [...matchHistory, { slot: slot.label, opponent, cycle: slot.cycle, isMirror }];
    setMatchHistory(newHistory);
    const newSlotIdx = selectedSlot + 1;
    setSelectedSlot(newSlotIdx);

    // Konfirmasi pola setelah siklus 2 selesai
    const nextSlot = ALL_SLOTS[newSlotIdx];
    if (slot.cycle === 2 && nextSlot?.cycle !== 2 && !confirmedPattern) {
      const c1 = newHistory.filter(m => m.cycle === 1 && !m.isMirror).map(m => m.opponent);
      const c2 = newHistory.filter(m => m.cycle === 2 && !m.isMirror).map(m => m.opponent);
      const detected = detectPattern(c1, c2);
      if (detected && !detected.ambiguous) setConfirmedPattern(detected);
    }
  }

  function undoLast() {
    if (matchHistory.length === 0) return;
    setMatchHistory(prev => prev.slice(0, -1));
    setSelectedSlot(prev => Math.max(0, prev - 1));
  }

  function toggleEliminated(opp) {
    setEliminated(prev => prev.includes(opp) ? prev.filter(o => o !== opp) : [...prev, opp]);
  }

  function getGroupForOpponent(opp, groups) {
    if (!groups) return null;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].includes(opp)) return i;
    }
    return null;
  }

  // ── styles ───────────────────────────────────────────────────────────────────
  const S = {
    app: { minHeight:"100vh", background:"#0a0e1a", color:"#e2e8f0", fontFamily:"'JetBrains Mono','Fira Mono','Courier New',monospace", display:"flex", flexDirection:"column", alignItems:"center" },
    header: { width:"100%", background:"linear-gradient(90deg,#0f172a 0%,#1e1b4b 100%)", borderBottom:"1px solid rgba(99,102,241,0.3)", padding:"16px 24px", display:"flex", alignItems:"center", gap:"12px", boxSizing:"border-box" },
    container: { width:"100%", maxWidth:"480px", padding:"20px 16px", display:"flex", flexDirection:"column", gap:"16px", boxSizing:"border-box" },
    card: { background:"#0f172a", border:"1px solid rgba(99,102,241,0.2)", borderRadius:"12px", padding:"16px" },
    cardTitle: { fontSize:"11px", color:"#64748b", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"12px" },
    btn: { background:"linear-gradient(135deg,#3730a3 0%,#1e40af 100%)", border:"none", borderRadius:"8px", color:"#e2e8f0", padding:"10px 20px", fontSize:"13px", fontFamily:"inherit", fontWeight:"700", cursor:"pointer", letterSpacing:"0.08em", textTransform:"uppercase" },
    btnDanger: { background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171" },
    btnMirror: { background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.3)", color:"#fbbf24" },
    oppInput: { background:"#1e293b", border:"1px solid rgba(99,102,241,0.3)", borderRadius:"8px", color:"#e2e8f0", padding:"8px 10px", fontSize:"13px", fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
    slotBadge: (active, done) => ({
      padding:"4px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"700",
      background: done?"rgba(52,211,153,0.1)":active?"rgba(34,211,238,0.15)":"rgba(255,255,255,0.04)",
      border: done?"1px solid rgba(52,211,153,0.3)":active?"1px solid rgba(34,211,238,0.4)":"1px solid rgba(255,255,255,0.08)",
      color: done?"#34d399":active?"#22d3ee":"#475569",
    }),
    chip: (groupIdx, isElim, isPredicted) => ({
      display:"inline-flex", alignItems:"center", gap:"6px",
      padding:"7px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:"600",
      background: isElim?"rgba(239,68,68,0.08)":groupIdx!=null?GROUP_BG[groupIdx]:"rgba(255,255,255,0.05)",
      border:`1px solid ${isElim?"rgba(239,68,68,0.3)":isPredicted?"rgba(34,211,238,0.7)":groupIdx!=null?GROUP_BORDER[groupIdx]:"rgba(255,255,255,0.1)"}`,
      color: isElim?"#f87171":groupIdx!=null?GROUP_COLORS[groupIdx]:"#94a3b8",
      cursor:"pointer", userSelect:"none",
      textDecoration: isElim?"line-through":"none",
      opacity: isElim?0.4:1,
      outline: isPredicted?"2px solid rgba(34,211,238,0.5)":"none",
      outlineOffset:"2px",
    }),
  };

  // ── setup screen ─────────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <div style={S.app}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(34,211,238,0.3)}50%{box-shadow:0 0 20px rgba(34,211,238,0.6)}}@keyframes slideIn{from{transform:translateY(4px);opacity:0}to{transform:translateY(0);opacity:1}}input::placeholder{color:#334155;}button:hover{opacity:0.85!important;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0a0e1a;}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px;}`}</style>
        <div style={S.header}>
          <span style={{fontSize:"28px",filter:"drop-shadow(0 0 8px #22d3ee)"}}>🪤</span>
          <div>
            <div style={{fontSize:"18px",fontWeight:"700",color:"#22d3ee",letterSpacing:"0.05em",textTransform:"uppercase"}}>Popol & Kupa Tracker</div>
            <div style={{fontSize:"11px",color:"#64748b",letterSpacing:"0.1em"}}>MCGG · Opponent Predictor</div>
          </div>
        </div>
        <div style={S.container}>
          <div style={S.card}>
            <div style={S.cardTitle}>Setup — Masukkan 7 Nama Lawan</div>
            <div style={{fontSize:"12px",color:"#475569",marginBottom:"14px",lineHeight:"1.6"}}>Lihat nama pemain di lobby sebelum game dimulai.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {opponents.map((opp, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{fontSize:"10px",color:"#334155",minWidth:"14px"}}>{i+1}</span>
                  <input style={S.oppInput} placeholder={`Lawan ${i+1}`} value={opp}
                    onChange={e => { const a=[...opponents]; a[i]=e.target.value; setOpponents(a); }} />
                </div>
              ))}
            </div>
            <button style={{...S.btn,width:"100%",marginTop:"14px",opacity:opponents.filter(o=>o.trim()).length<7?0.4:1}} onClick={handleSetupDone}>
              Mulai Tracking →
            </button>
          </div>
          <div style={{...S.card,background:"rgba(34,211,238,0.04)",border:"1px solid rgba(34,211,238,0.15)"}}>
            <div style={{fontSize:"11px",color:"#22d3ee",marginBottom:"8px"}}>ℹ️ CARA PAKAI</div>
            <div style={{fontSize:"12px",color:"#475569",lineHeight:"1.7"}}>
              1. Input nama 7 lawan di atas<br/>
              2. Tiap babak PvP, tap nama lawan yang kamu hadapi<br/>
              3. Kalau lawan mirror, tap 🪞 lalu pilih siapa yang jadi mirror-nya<br/>
              4. Kalau ada yang eliminasi, tap 💀 di kartu status pemain<br/>
              5. Pola terdeteksi dari siklus ke-2, makin akurat di siklus ke-3+
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── tracker screen ────────────────────────────────────────────────────────────
  const patternForHistory = confirmedPattern || activePattern;

  return (
    <div style={S.app}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(34,211,238,0.3)}50%{box-shadow:0 0 20px rgba(34,211,238,0.6)}}@keyframes slideIn{from{transform:translateY(4px);opacity:0}to{transform:translateY(0);opacity:1}}button:hover{opacity:0.85!important;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0a0e1a;}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px;}`}</style>

      <div style={S.header}>
        <span style={{fontSize:"28px",filter:"drop-shadow(0 0 8px #22d3ee)"}}>🪤</span>
        <div style={{flex:1}}>
          <div style={{fontSize:"18px",fontWeight:"700",color:"#22d3ee",letterSpacing:"0.05em",textTransform:"uppercase"}}>Popol & Kupa Tracker</div>
          <div style={{fontSize:"11px",color:"#64748b"}}>MCGG · Opponent Predictor</div>
        </div>
        <button style={{...S.btn,...S.btnDanger,padding:"6px 12px",fontSize:"11px"}}
          onClick={()=>{setSetupDone(false);setMatchHistory([]);setSelectedSlot(0);setOpponents(Array(7).fill(""));setEliminated([]);setConfirmedPattern(null);}}>
          Reset
        </button>
      </div>

      <div style={S.container}>

        {/* Status pemain */}
        <div style={S.card}>
          <div style={S.cardTitle}>❤️ Status Pemain</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
            {opponents.filter(o=>o.trim()).map((opp,i) => {
              const isElim = eliminated.includes(opp);
              const groupIdx = patternForHistory ? getGroupForOpponent(opp, patternForHistory.groups) : null;
              return (
                <button key={i} style={{...S.chip(groupIdx, isElim, false)}} onClick={()=>toggleEliminated(opp)}>
                  {isElim?"💀":"❤️"} {opp}
                </button>
              );
            })}
          </div>
          <div style={{fontSize:"11px",color:"#334155",marginTop:"8px"}}>
            Tap untuk toggle eliminasi · {activeOpponents.length} aktif · {eliminated.length} eliminasi
          </div>
        </div>

        {/* Babak sekarang */}
        <div style={{...S.card,animation:"slideIn 0.3s ease"}}>
          <div style={S.cardTitle}>Babak Sekarang</div>
          {isFinished ? (
            <div style={{color:"#34d399",fontSize:"14px",fontWeight:"700"}}>✅ Semua siklus selesai!</div>
          ) : (
            <>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
                <div style={{padding:"8px 14px",background:"rgba(34,211,238,0.1)",border:"1px solid rgba(34,211,238,0.4)",borderRadius:"8px",fontSize:"20px",fontWeight:"700",color:"#22d3ee",animation:"glow 2s ease-in-out infinite"}}>
                  {currentSlot.label}
                </div>
                <div>
                  <div style={{fontSize:"11px",color:"#475569"}}>Siklus ke-{currentSlot.cycle}</div>
                  <div style={{fontSize:"11px",color:confirmedPattern?"#34d399":currentCycle<=2?"#f59e0b":"#475569"}}>
                    {confirmedPattern ? `✅ Pola: ${confirmedPattern.patKey}` : currentCycle<=2 ? "🔍 Mengumpulkan data..." : "⏳ Menunggu konfirmasi pola"}
                  </div>
                </div>
              </div>

              {currentCycle <= 2 && (
                <div style={{fontSize:"11px",color:"#475569",marginBottom:"10px",padding:"6px 10px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"6px"}}>
                  ⚠️ Siklus 1-2 = pengumpulan data. Prediksi aktif mulai siklus ke-3.
                </div>
              )}

              {preliminaryPattern && !preliminaryPattern.ambiguous && currentCycle === 2 && (
                <div style={{fontSize:"11px",color:"#a78bfa",marginBottom:"10px",padding:"6px 10px",background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"6px"}}>
                  🔮 Pola sementara: <strong>{preliminaryPattern.patKey}</strong> — dikonfirmasi akhir siklus 2
                </div>
              )}

              <div style={{fontSize:"12px",color:"#64748b",marginBottom:"10px"}}>
                Tap nama lawan yang kamu hadapi:
              </div>

              <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                {opponents.map((opp,i) => {
                  if (!opp.trim()) return null;
                  const isElim = eliminated.includes(opp);
                  const alreadyThisCycle = cycleOpponents.includes(opp);
                  const groupIdx = patternForHistory ? getGroupForOpponent(opp, patternForHistory.groups) : null;
                  const isPredicted = predictions.includes(opp);
                  const disabled = isElim || (alreadyThisCycle && !currentSlot.isMirrorSlot);
                  return (
                    <button key={i}
                      style={{...S.chip(groupIdx, isElim, isPredicted), opacity:disabled?0.25:1, cursor:disabled?"not-allowed":"pointer"}}
                      onClick={()=>!disabled && recordMatch(opp)}
                      disabled={disabled}>
                      {isPredicted && <span style={{fontSize:"10px",animation:"pulse 1.5s infinite"}}>⚡</span>}
                      {opp}
                    </button>
                  );
                })}

                {/* Mirror button — buka pilihan siapa yang jadi mirror */}
                <MirrorPicker
                  opponents={opponents.filter(o=>o.trim())}
                  eliminated={eliminated}
                  onPick={(opp) => recordMatch(opp, true)}
                  chipStyle={S.chip}
                  btnMirror={S.btnMirror}
                  btn={S.btn}
                  btnDanger={S.btnDanger}
                />
              </div>
            </>
          )}
        </div>

        {/* Prediksi */}
        {predictions.length > 0 && !isFinished && (
          <div style={{...S.card,background:"rgba(34,211,238,0.05)",border:"1px solid rgba(34,211,238,0.3)",animation:"slideIn 0.3s ease"}}>
            <div style={S.cardTitle}>⚡ Prediksi Lawan Berikutnya</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
              {predictions.map((opp,i) => (
                <div key={i} style={{padding:"8px 16px",background:"rgba(34,211,238,0.12)",border:"1px solid rgba(34,211,238,0.5)",borderRadius:"20px",fontSize:"15px",fontWeight:"700",color:"#22d3ee",animation:"pulse 1.5s ease-in-out infinite"}}>
                  {opp}
                </div>
              ))}
            </div>
            <div style={{fontSize:"11px",color:"#475569",marginTop:"8px"}}>
              Pola {activePattern?.patKey} · Pasang trap sekarang! 🪤
            </div>
          </div>
        )}

        {/* Pattern info */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            {confirmedPattern ? `✅ Pola Terkonfirmasi: ${confirmedPattern.patKey}` : `🔍 Deteksi Pola`}
          </div>
          {confirmedPattern ? (
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {confirmedPattern.groups.map((group, gi) => (
                <div key={gi} style={{padding:"8px 10px",background:GROUP_BG[gi],border:`1px solid ${GROUP_BORDER[gi]}`,borderRadius:"8px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"10px",color:GROUP_COLORS[gi],minWidth:"52px"}}>GRUP {gi+1} ({group.length})</span>
                  {group.map((opp,j) => {
                    const isElim = eliminated.includes(opp);
                    const seenNow = cycleOpponents.includes(opp);
                    return (
                      <span key={j} style={{fontSize:"12px",fontWeight:"600",color:isElim?"#ef4444":GROUP_COLORS[gi],opacity:isElim?0.4:seenNow?1:0.5,textDecoration:isElim?"line-through":"none"}}>
                        {isElim?"💀":seenNow?"✓":"○"} {opp}
                      </span>
                    );
                  })}
                </div>
              ))}
              <div style={{fontSize:"11px",color:"#334155",marginTop:"4px"}}>Dikonfirmasi dari siklus ke-2 · Posisi kunci: lawan ke-1, ke-3, ke-6</div>
            </div>
          ) : (
            <div style={{fontSize:"12px",color:"#334155",lineHeight:"1.7"}}>
              Mengumpulkan data siklus 1 & 2...<br/>
              <span style={{color:"#475569"}}>Kunci deteksi: lawan ke-1, ke-3, dan ke-6 di tiap siklus</span><br/>
              <span style={{color:"#334155"}}>Siklus 1: {cycle1Order.length}/7 data</span>
            </div>
          )}
        </div>

        {/* Riwayat */}
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
            <div style={S.cardTitle}>Riwayat Match</div>
            {matchHistory.length>0 && (
              <button style={{...S.btn,...S.btnDanger,padding:"4px 10px",fontSize:"11px"}} onClick={undoLast}>↩ Undo</button>
            )}
          </div>
          {matchHistory.length===0 ? (
            <div style={{fontSize:"12px",color:"#334155"}}>Belum ada match...</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
              {matchHistory.map((m,i) => {
                const groupIdx = patternForHistory ? getGroupForOpponent(m.opponent, patternForHistory.groups) : null;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"6px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.02)"}}>
                    <span style={{...S.slotBadge(false,true),minWidth:"52px",textAlign:"center"}}>{m.slot}</span>
                    <span style={{fontSize:"13px",fontWeight:"600",flex:1,color:m.isMirror?"#fbbf24":groupIdx!=null?GROUP_COLORS[groupIdx]:"#94a3b8"}}>
                      {m.isMirror?`🪞 ${m.opponent}`:m.opponent}
                    </span>
                    <span style={{fontSize:"10px",color:"#334155"}}>S{m.cycle}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Slot tracker */}
        <div style={S.card}>
          <div style={S.cardTitle}>Urutan Babak PvP</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
            {ALL_SLOTS.slice(0,28).map((s,i) => {
              const done = matchHistory.find(m=>m.slot===s.label);
              const active = i===selectedSlot;
              return <span key={i} style={S.slotBadge(active,!!done)}>{s.label}</span>;
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Mirror Picker component ───────────────────────────────────────────────────
function MirrorPicker({ opponents, eliminated, onPick, chipStyle, btnMirror, btn, btnDanger }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button style={{...btn,...btnMirror,padding:"7px 14px",fontSize:"12px",borderRadius:"20px",textTransform:"none"}}
        onClick={()=>setOpen(true)}>
        🪞 Mirror
      </button>
    );
  }

  return (
    <div style={{width:"100%",marginTop:"8px",padding:"10px",background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:"10px"}}>
      <div style={{fontSize:"11px",color:"#fbbf24",marginBottom:"8px",letterSpacing:"0.1em"}}>
        🪞 MIRROR — Pilih siapa yang jadi lawan mirror:
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
        {opponents.map((opp,i) => {
          const isElim = eliminated.includes(opp);
          return (
            <button key={i}
              style={{...chipStyle(null,isElim,false),opacity:isElim?0.25:1,cursor:isElim?"not-allowed":"pointer"}}
              onClick={()=>{if(!isElim){onPick(opp);setOpen(false);}}}
              disabled={isElim}>
              {opp}
            </button>
          );
        })}
        <button style={{...btn,...btnDanger,padding:"5px 12px",fontSize:"11px",borderRadius:"20px",textTransform:"none"}}
          onClick={()=>setOpen(false)}>
          Batal
        </button>
      </div>
    </div>
  );
}
