// App.jsx — Friendly Bets (Firebase Version)
// Dependencies: npm install firebase

import { useState, useCallback, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, updateDoc, deleteDoc, addDoc, getDocs } from "firebase/firestore";

// ── Firebase Init ─────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCM_zcCiYczoUJ5A4L4p3BwWJUlPesxQ9E",
  authDomain: "friendly-bets-1a2e8.firebaseapp.com",
  projectId: "friendly-bets-1a2e8",
  storageBucket: "friendly-bets-1a2e8.firebasestorage.app",
  messagingSenderId: "23993982484",
  appId: "1:23993982484:web:abdaa03718e43e22929101",
  measurementId: "G-VMFX176JQ8"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ── Colors ────────────────────────────────────────────────
const TTU_RED = "#CC0000";
const TTU_DARK = "#1a1a1a";
const TTU_WHITE = "#FFFFFF";
const TTU_GRAY = "#2a2a2a";

// ── Shared UI ─────────────────────────────────────────────
const Badge = ({ label, color, small }) => (
  <span style={{ background: color, color: "#fff", borderRadius: 4, padding: small ? "2px 6px" : "3px 10px", fontSize: small ? 11 : 12, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
);

const Avatar = ({ name, size = 38 }) => {
  const initials = name?.split("_").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return <div style={{ width: size, height: size, borderRadius: "50%", background: TTU_RED, color: TTU_WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>;
};

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: TTU_GRAY, borderRadius: 10, padding: 16, marginBottom: 14, border: "1px solid #333", cursor: onClick ? "pointer" : undefined, ...style }}>{children}</div>
);

const Btn = ({ children, onClick, style, variant = "primary", small }) => {
  const base = { border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, padding: small ? "6px 14px" : "10px 20px", fontSize: small ? 12 : 14 };
  const variants = {
    primary: { background: TTU_RED, color: TTU_WHITE },
    outline: { background: "transparent", color: TTU_RED, border: `2px solid ${TTU_RED}` },
    ghost: { background: "transparent", color: "#aaa", border: "1px solid #444" },
    danger: { background: "#8b0000", color: TTU_WHITE },
    success: { background: "#1a7a1a", color: TTU_WHITE },
  };
  return <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
};

const Field = ({ label, type = "text", value, onChange, placeholder }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: "100%", background: "#111", border: "1px solid #444", borderRadius: 6, color: TTU_WHITE, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
  </div>
);

const Sel = ({ label, value, onChange, children }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
    <select value={value} onChange={onChange}
      style={{ width: "100%", background: "#111", border: "1px solid #444", borderRadius: 6, color: TTU_WHITE, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }}>
      {children}
    </select>
  </div>
);

// ── Login Page ────────────────────────────────────────────
function LoginPage({ showToast }) {
  const [mode, setMode] = useState("login");
  const [lf, setLf] = useState({ username: "", password: "" });
  const [sf, setSf] = useState({ username: "", password: "", venmo: "", cashapp: "", zelle: "" });
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (loading) return;
    setLoading(true);
    const email = `${lf.username.toLowerCase()}@friendlybets.app`;
    try {
      await signInWithEmailAndPassword(auth, email, lf.password);
      showToast(`Welcome back, ${lf.username}! ⚔️`);
    } catch (e) {
      showToast("Invalid username or password", "error");
    } finally {
      setLoading(false);
    }
  };

  const signup = async () => {
    if (loading) return;
    if (!sf.username) return showToast("Username required", "error");
    if (!sf.password || sf.password.length < 6) return showToast("Password must be 6+ characters", "error");
    setLoading(true);
    const email = `${sf.username.toLowerCase()}@friendlybets.app`;
    try {
      // Check if username already exists first
      const usersSnap = await getDocs(collection(db, "users"));
      const taken = usersSnap.docs.some(d => d.data().username.toLowerCase() === sf.username.toLowerCase());
      if (taken) {
        showToast("Username already taken", "error");
        setLoading(false);
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email, sf.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        id: cred.user.uid,
        username: sf.username,
        venmo: sf.venmo || "",
        cashapp: sf.cashapp || "",
        zelle: sf.zelle || "",
        wins: 0,
        losses: 0,
        dishonorable: false,
        dishonorableDebts: [],
      });
      showToast(`Welcome, ${sf.username}! Wreck 'Em! 🔫`);
    } catch (e) {
      if (e.code === "auth/email-already-in-use") showToast("Username already taken", "error");
      else showToast("Signup failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: TTU_DARK, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔫</div>
          <div style={{ color: TTU_RED, fontWeight: 900, fontSize: 32, letterSpacing: 2 }}>FRIENDLY BETS</div>
          <div style={{ color: "#aaa", fontSize: 14 }}>Hold your homies accountable</div>
        </div>
        <div style={{ background: TTU_GRAY, borderRadius: 12, padding: 24, border: `2px solid ${TTU_RED}` }}>
          <div style={{ display: "flex", marginBottom: 20, borderBottom: "1px solid #444" }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, background: "none", border: "none", color: mode === m ? TTU_RED : "#aaa", fontWeight: 700, fontSize: 14, padding: "10px 0", cursor: "pointer", borderBottom: mode === m ? `2px solid ${TTU_RED}` : "none", letterSpacing: 1 }}>
                {m === "login" ? "LOG IN" : "SIGN UP"}
              </button>
            ))}
          </div>
          {mode === "login" ? (
            <>
              <Field label="Username" placeholder="Your username" value={lf.username} onChange={e => setLf(f => ({ ...f, username: e.target.value }))} />
              <Field label="Password" type="password" placeholder="••••••••" value={lf.password} onChange={e => setLf(f => ({ ...f, password: e.target.value }))} />
              <Btn onClick={login} style={{ width: "100%", marginTop: 8, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Logging in..." : "Wreck 'Em In 🔫"}
              </Btn>
            </>
          ) : (
            <>
              <Field label="Username" placeholder="Raider_Name" value={sf.username} onChange={e => setSf(f => ({ ...f, username: e.target.value }))} />
              <Field label="Password" type="password" placeholder="6+ characters" value={sf.password} onChange={e => setSf(f => ({ ...f, password: e.target.value }))} />
              <Field label="Venmo (optional)" placeholder="@username" value={sf.venmo} onChange={e => setSf(f => ({ ...f, venmo: e.target.value }))} />
              <Field label="CashApp (optional)" placeholder="$username" value={sf.cashapp} onChange={e => setSf(f => ({ ...f, cashapp: e.target.value }))} />
              <Field label="Zelle (optional)" placeholder="phone or email" value={sf.zelle} onChange={e => setSf(f => ({ ...f, zelle: e.target.value }))} />
              <Btn onClick={signup} style={{ width: "100%", marginTop: 8, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Creating account..." : "Create Account 🏴"}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// ── Create Bet Modal ──────────────────────────────────────
function CreateBetModal({ users, currentUser, onClose, showToast }) {
  const [form, setForm] = useState({ type: "1v1", opponentId: "", description: "", stakes: "", amount: "", deadline: "", winType: "single", inviteIds: [] });
  const others = users.filter(u => u.id !== currentUser.id);

  const toggleInvite = id => setForm(f => ({
    ...f, inviteIds: f.inviteIds.includes(id) ? f.inviteIds.filter(i => i !== id) : [...f.inviteIds, id]
  }));

  const submit = async () => {
    if (!form.description) return showToast("Add a bet description", "error");
    const bet = {
      type: form.type, creator: currentUser.id, description: form.description,
      stakes: form.stakes, amount: parseFloat(form.amount) || 0,
      deadline: form.deadline, status: form.type === "1v1" ? "pending_acceptance" : "active",
      winner: null, createdAt: Date.now()
    };
    if (form.type === "1v1") {
      if (!form.opponentId) return showToast("Select an opponent", "error");
      bet.opponent = form.opponentId; bet.paidStatus = null; bet.reportedUnpaid = false;
    } else {
      const ids = form.inviteIds.filter(Boolean);
      bet.participants = [
        { userId: currentUser.id, amount: parseFloat(form.amount) || 0, paid: true },
        ...ids.map(id => ({ userId: id, amount: parseFloat(form.amount) || 0, paid: false }))
      ];
      bet.winType = form.winType; bet.resolveVotes = {};
    }
    await addDoc(collection(db, "bets"), bet);
    onClose();
    showToast("Bet created! 🔫 Wreck 'Em!");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: TTU_GRAY, borderRadius: 12, padding: 24, width: "100%", maxWidth: 420, border: `2px solid ${TTU_RED}`, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: TTU_WHITE, fontWeight: 800, fontSize: 18 }}>⚔️ New Bet</span>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <Sel label="Bet Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
          <option value="1v1">1 vs 1</option>
          <option value="pot">🪣 Group Pot</option>
        </Sel>
        {form.type === "1v1" ? (
          <Sel label="Challenge" value={form.opponentId} onChange={e => setForm(f => ({ ...f, opponentId: e.target.value }))}>
            <option value="">Select opponent...</option>
            {others.map(u => <option key={u.id} value={u.id}>{u.username}{u.dishonorable ? " 🏴" : ""}</option>)}
          </Sel>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Invite Friends</div>
            {others.map(u => (
              <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, color: TTU_WHITE, marginBottom: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={form.inviteIds.includes(u.id)} onChange={() => toggleInvite(u.id)} />
                {u.username}{u.dishonorable ? " 🏴" : ""}
              </label>
            ))}
          </div>
        )}
        <Field label="Bet Description" placeholder="e.g. Cowboys win Sunday" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <Field label="Stakes (custom)" placeholder="e.g. Buy dinner" value={form.stakes} onChange={e => setForm(f => ({ ...f, stakes: e.target.value }))} />
        <Field label="$ Amount" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <Field label="Deadline" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
        {form.type === "pot" && (
          <Sel label="Win Type" value={form.winType} onChange={e => setForm(f => ({ ...f, winType: e.target.value }))}>
            <option value="single">Single winner takes all</option>
            <option value="split">Split among winners</option>
          </Sel>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={submit} style={{ flex: 1 }}>Create Bet 🔫</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Profile Modal ─────────────────────────────────────────
function ProfileModal({ user, currentUser, bets, onClose, showToast }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ venmo: user.venmo || "", cashapp: user.cashapp || "", zelle: user.zelle || "" });
  const isSelf = user.id === currentUser.id;

  const save = async () => {
    await updateDoc(doc(db, "users", currentUser.id), form);
    showToast("Profile updated!");
    setEditing(false);
    onClose();
  };

  const clearDishonorable = async (betId) => {
    await updateDoc(doc(db, "bets", betId), { paidStatus: "paid", reportedUnpaid: false });
    const newDebts = (user.dishonorableDebts || []).filter(d => d !== betId);
    await updateDoc(doc(db, "users", currentUser.id), { dishonorableDebts: newDebts, dishonorable: newDebts.length > 0 });
    showToast("Debt settled! Flag removed ✅");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: TTU_GRAY, borderRadius: 12, padding: 24, width: "100%", maxWidth: 380, border: `2px solid ${TTU_RED}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Avatar name={user.username} size={48} />
            <div>
              <div style={{ color: TTU_WHITE, fontWeight: 800, fontSize: 18 }}>{user.username}</div>
              {user.dishonorable && <Badge label="🏴 DISHONORABLE" color="#8b0000" />}
            </div>
          </div>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          {[["WINS", user.wins, TTU_RED], ["LOSSES", user.losses, "#aaa"]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center", flex: 1, background: "#111", borderRadius: 8, padding: 10 }}>
              <div style={{ color: c, fontWeight: 800, fontSize: 22 }}>{v}</div>
              <div style={{ color: "#aaa", fontSize: 12 }}>{l}</div>
            </div>
          ))}
        </div>
        {editing ? (
          <>
            <Field label="Venmo" placeholder="@username" value={form.venmo} onChange={e => setForm(f => ({ ...f, venmo: e.target.value }))} />
            <Field label="CashApp" placeholder="$username" value={form.cashapp} onChange={e => setForm(f => ({ ...f, cashapp: e.target.value }))} />
            <Field label="Zelle" placeholder="phone or email" value={form.zelle} onChange={e => setForm(f => ({ ...f, zelle: e.target.value }))} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={save} style={{ flex: 1 }}>Save</Btn>
              <Btn variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              {[["Venmo", user.venmo], ["CashApp", user.cashapp], ["Zelle", user.zelle]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #333" }}>
                  <span style={{ color: "#aaa", fontSize: 13 }}>{label}</span>
                  <span style={{ color: val ? TTU_WHITE : "#555", fontSize: 13 }}>{val || "Not set"}</span>
                </div>
              ))}
            </div>
            {isSelf && <Btn variant="outline" onClick={() => setEditing(true)} style={{ width: "100%", marginBottom: 8 }}>Edit Payment Info</Btn>}
          </>
        )}
        {isSelf && user.dishonorableDebts?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ color: "#ff4444", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🏴 Settle to clear flag:</div>
            {user.dishonorableDebts.map(betId => {
              const b = bets.find(x => x.id === betId);
              if (!b) return null;
              return (
                <div key={betId} style={{ background: "#111", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                  <div style={{ color: TTU_WHITE, fontSize: 13 }}>{b.description}</div>
                  <Btn variant="success" small onClick={() => clearDishonorable(betId)} style={{ marginTop: 6 }}>Mark as Paid ✅</Btn>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bets Page ─────────────────────────────────────────────
function BetsPage({ myBets, setModal, BetCard }) {
  const [filter, setFilter] = useState("all");
  const filtered = myBets.filter(b => filter === "all" || b.status === filter);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: TTU_WHITE, fontWeight: 800, fontSize: 20 }}>⚔️ My Bets</div>
        <Btn small onClick={() => setModal({ type: "create" })}>+ New</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["all","active","settled","pending_acceptance"].map(f => (
          <Btn key={f} small variant={filter === f ? "primary" : "ghost"} onClick={() => setFilter(f)}>
            {f === "pending_acceptance" ? "Pending" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Btn>
        ))}
      </div>
      {filtered.length === 0
        ? <div style={{ color: "#555", textAlign: "center", padding: 24 }}>No bets found.</div>
        : filtered.map(b => <BetCard key={b.id} bet={b} />)}
    </>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [users, setUsers] = useState([]);
  const [bets, setBets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) setCurrentUser({ id: firebaseUser.uid, ...snap.data() });
      } else {
        setCurrentUser(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Real-time users listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Real-time bets listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bets"), snap => {
      setBets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Keep currentUser in sync with live users data
  useEffect(() => {
    if (currentUser) {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated) setCurrentUser(updated);
    }
  }, [users]);

  const getUser = id => users.find(u => u.id === id);

  const myBets = bets.filter(b =>
    b.type === "1v1"
      ? b.creator === currentUser?.id || b.opponent === currentUser?.id
      : b.participants?.some(p => p.userId === currentUser?.id) || b.creator === currentUser?.id
  );

  const pendingActions = myBets.filter(b =>
    (b.status === "pending_acceptance" && b.opponent === currentUser?.id) ||
    (b.status === "claimed" && b.claimedBy !== currentUser?.id) ||
    (b.type === "pot" && b.status === "resolve_voting" && !b.resolveVotes?.[currentUser?.id])
  );

  // ── Bet Actions ──
  const acceptBet = id => updateDoc(doc(db, "bets", id), { status: "active" }).then(() => showToast("Bet accepted! ⚔️"));
  const declineBet = id => deleteDoc(doc(db, "bets", id)).then(() => showToast("Bet declined."));
  const claimWin = id => updateDoc(doc(db, "bets", id), { status: "claimed", claimedBy: currentUser.id }).then(() => showToast("Win claimed! Waiting for confirmation..."));

  const confirmWin = async id => {
    const bet = bets.find(b => b.id === id);
    const wId = bet.claimedBy, lId = bet.creator === wId ? bet.opponent : bet.creator;
    await updateDoc(doc(db, "bets", id), { status: "settled", winner: wId, paidStatus: "unpaid" });
    await updateDoc(doc(db, "users", wId), { wins: (getUser(wId)?.wins || 0) + 1 });
    await updateDoc(doc(db, "users", lId), { losses: (getUser(lId)?.losses || 0) + 1 });
    showToast("Bet settled! Now pay up 💸");
  };

  const disputeClaim = id => updateDoc(doc(db, "bets", id), { status: "active", claimedBy: null }).then(() => showToast("Claim disputed."));
  const markPaid = id => updateDoc(doc(db, "bets", id), { paidStatus: "paid" }).then(() => showToast("Marked as paid! 🤝"));

  const reportUnpaid = async id => {
    const bet = bets.find(b => b.id === id);
    const debtorId = bet.creator === currentUser.id ? bet.opponent : bet.creator;
    const debtor = getUser(debtorId);
    await updateDoc(doc(db, "bets", id), { paidStatus: "unpaid", reportedUnpaid: true });
    await updateDoc(doc(db, "users", debtorId), { dishonorable: true, dishonorableDebts: [...(debtor?.dishonorableDebts || []), id] });
    showToast("Reported unpaid. 🏴 Flag applied.");
  };

  const votePotWinner = async (betId, winnerId) => {
    const bet = bets.find(b => b.id === betId);
    const nv = { ...bet.resolveVotes, [currentUser.id]: winnerId };
    const tally = {};
    Object.values(nv).forEach(v => tally[v] = (tally[v] || 0) + 1);
    const majority = Object.entries(tally).find(([, c]) => c > bet.participants.length / 2);
    if (majority) {
      const wId = majority[0];
      await updateDoc(doc(db, "bets", betId), { resolveVotes: nv, status: "settled", winner: wId });
      await updateDoc(doc(db, "users", wId), { wins: (getUser(wId)?.wins || 0) + 1 });
      for (const p of bet.participants) {
        if (p.userId !== wId) await updateDoc(doc(db, "users", p.userId), { losses: (getUser(p.userId)?.losses || 0) + 1 });
      }
    } else {
      await updateDoc(doc(db, "bets", betId), { resolveVotes: nv, status: "resolve_voting" });
    }
    showToast("Vote submitted!");
  };

  // ── BetCard ──
  const BetCard = ({ bet }) => {
    const isCreator = bet.creator === currentUser.id;
    const isWinner = bet.winner === currentUser.id;
    const opp = bet.type === "1v1" ? getUser(bet.creator === currentUser.id ? bet.opponent : bet.creator) : null;
    const winner = getUser(bet.winner);
    const statusColor = { pending_acceptance: "#f59e0b", active: "#22c55e", claimed: "#f59e0b", settled: "#6b7280", resolve_voting: "#f59e0b" }[bet.status] || "#aaa";
    const statusLabel = { pending_acceptance: "Pending", active: "Active", claimed: "Claimed", settled: "Settled", resolve_voting: "Voting" }[bet.status];

    return (
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {bet.type === "pot" ? <span style={{ fontSize: 20 }}>🪣</span> : <Avatar name={opp?.username} size={32} />}
            <div>
              <div style={{ color: TTU_WHITE, fontWeight: 700, fontSize: 14 }}>
                {bet.type === "1v1" ? `vs ${opp?.username}${opp?.dishonorable ? " 🏴" : ""}` : bet.description}
              </div>
              {bet.type === "1v1" && <div style={{ color: "#aaa", fontSize: 12 }}>{bet.description}</div>}
            </div>
          </div>
          <span style={{ color: statusColor, fontSize: 11, fontWeight: 700, background: statusColor + "22", padding: "3px 8px", borderRadius: 4 }}>{statusLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          {bet.stakes && <span style={{ color: "#aaa", fontSize: 12 }}>📋 {bet.stakes}</span>}
          {bet.amount > 0 && <span style={{ color: TTU_RED, fontSize: 12, fontWeight: 700 }}>💵 ${bet.amount}</span>}
          {bet.deadline && <span style={{ color: "#aaa", fontSize: 12 }}>📅 {bet.deadline}</span>}
        </div>
        {bet.type === "pot" && (
          <div style={{ background: "#111", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
            {bet.participants?.map(p => {
              const u = getUser(p.userId);
              return (
                <div key={p.userId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: TTU_WHITE, marginBottom: 2 }}>
                  <span>{u?.username}{u?.dishonorable ? " 🏴" : ""}</span>
                  <span style={{ color: p.paid ? "#22c55e" : "#f59e0b" }}>${p.amount} {p.paid ? "✓" : "pending"}</span>
                </div>
              );
            })}
            <div style={{ color: TTU_RED, fontWeight: 700, fontSize: 13, marginTop: 6 }}>Total Pot: ${bet.participants?.reduce((s, p) => s + p.amount, 0)}</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {bet.status === "pending_acceptance" && !isCreator && (
            <><Btn small onClick={() => acceptBet(bet.id)}>Accept ✅</Btn><Btn small variant="danger" onClick={() => declineBet(bet.id)}>Decline ✗</Btn></>
          )}
          {bet.type === "1v1" && bet.status === "active" && <Btn small onClick={() => claimWin(bet.id)}>Claim Win 🏆</Btn>}
          {bet.status === "claimed" && bet.claimedBy !== currentUser.id && (
            <><Btn small variant="success" onClick={() => confirmWin(bet.id)}>Confirm ✅</Btn><Btn small variant="danger" onClick={() => disputeClaim(bet.id)}>Dispute ⚠️</Btn></>
          )}
          {bet.status === "claimed" && bet.claimedBy === currentUser.id && <span style={{ color: "#f59e0b", fontSize: 12 }}>Waiting for confirmation...</span>}
          {bet.type === "1v1" && bet.status === "settled" && isWinner && !bet.reportedUnpaid && bet.paidStatus === "unpaid" && (
            <><Btn small variant="success" onClick={() => markPaid(bet.id)}>Mark Paid ✅</Btn><Btn small variant="danger" onClick={() => reportUnpaid(bet.id)}>Report Unpaid 🏴</Btn></>
          )}
          {bet.status === "settled" && bet.paidStatus === "paid" && <Badge label="✅ PAID" color="#1a7a1a" small />}
          {bet.status === "settled" && bet.reportedUnpaid && <Badge label="🏴 UNPAID — DISHONORABLE" color="#8b0000" small />}
          {bet.type === "pot" && (bet.status === "active" || bet.status === "resolve_voting") && isCreator && (
            <Btn small variant="outline" onClick={() => updateDoc(doc(db, "bets", bet.id), { status: "resolve_voting" })}>Start Vote 🗳️</Btn>
          )}
          {bet.type === "pot" && bet.status === "resolve_voting" && !bet.resolveVotes?.[currentUser.id] && (
            <div style={{ width: "100%" }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Vote for winner:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {bet.participants?.map(p => <Btn key={p.userId} small variant="outline" onClick={() => votePotWinner(bet.id, p.userId)}>{getUser(p.userId)?.username}</Btn>)}
              </div>
            </div>
          )}
          {bet.status === "settled" && winner && (
            <div style={{ width: "100%", marginTop: 4 }}>
              {bet.type === "pot" && <Badge label={`🏆 Winner: ${winner.username}`} color={TTU_RED} small />}
              <div style={{ color: "#aaa", fontSize: 11, marginTop: 6, marginBottom: 2 }}>Pay {winner.username} via:</div>
              {[["Venmo", winner.venmo], ["CashApp", winner.cashapp], ["Zelle", winner.zelle]].filter(([, v]) => v).map(([l, v]) => (
                <span key={l} style={{ color: TTU_WHITE, fontSize: 11, background: "#111", borderRadius: 4, padding: "2px 7px", marginRight: 4 }}>{l}: {v}</span>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (!authReady) return (
    <div style={{ minHeight: "100vh", background: TTU_DARK, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔫</div>
      <div style={{ color: TTU_RED, fontWeight: 900, fontSize: 24, letterSpacing: 2 }}>FRIENDLY BETS</div>
      <div style={{ color: "#aaa", fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!currentUser) return <LoginPage showToast={showToast} />;

  const sorted = [...users].sort((a, b) => b.wins - a.wins);
  const activeBets = myBets.filter(b => ["active","pending_acceptance","claimed","resolve_voting"].includes(b.status));

  return (
    <div style={{ background: TTU_DARK, minHeight: "100vh", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? "#8b0000" : "#1a7a1a", color: TTU_WHITE, padding: "10px 20px", borderRadius: 8, fontWeight: 700, zIndex: 200, fontSize: 14, whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}
      {modal?.type === "create" && <CreateBetModal users={users} currentUser={currentUser} onClose={() => setModal(null)} showToast={showToast} />}
      {modal?.type === "profile" && (
        <ProfileModal user={users.find(u => u.id === modal.user.id) || modal.user} currentUser={currentUser} bets={bets} onClose={() => setModal(null)} showToast={showToast} />
      )}

      {/* Nav */}
      <div style={{ background: "#111", borderBottom: `3px solid ${TTU_RED}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🔫</span>
          <span style={{ color: TTU_RED, fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>FRIENDLY BETS</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingActions.length > 0 && <span style={{ background: TTU_RED, color: TTU_WHITE, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{pendingActions.length}</span>}
          <div style={{ cursor: "pointer" }} onClick={() => setModal({ type: "profile", user: currentUser })}><Avatar name={currentUser.username} size={34} /></div>
          <Btn variant="ghost" small onClick={() => signOut(auth)}>Out</Btn>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {page === "dashboard" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ color: TTU_WHITE, fontWeight: 800, fontSize: 20 }}>Hey, {currentUser.username}! 🔫</div>
                <div style={{ color: currentUser.dishonorable ? "#ff4444" : "#aaa", fontSize: 13 }}>{currentUser.dishonorable ? "🏴 You have unpaid debts!" : "Wreck 'Em Tech!"}</div>
              </div>
              <Btn onClick={() => setModal({ type: "create" })}>+ New Bet</Btn>
            </div>
            {pendingActions.length > 0 && (
              <Card style={{ borderColor: TTU_RED, borderWidth: 2 }}>
                <div style={{ color: TTU_RED, fontWeight: 700, marginBottom: 8 }}>⚡ Action Required ({pendingActions.length})</div>
                {pendingActions.map(b => <BetCard key={b.id} bet={b} />)}
              </Card>
            )}
            <div style={{ color: "#aaa", fontWeight: 700, fontSize: 13, marginBottom: 8, letterSpacing: 1 }}>ACTIVE BETS</div>
            {activeBets.length === 0
              ? <div style={{ color: "#555", textAlign: "center", padding: 24 }}>No active bets. Challenge a friend! ⚔️</div>
              : activeBets.map(b => <BetCard key={b.id} bet={b} />)}
          </>
        )}
        {page === "bets" && <BetsPage myBets={myBets} setModal={setModal} BetCard={BetCard} />}
        {page === "leaderboard" && (
          <>
            <div style={{ color: TTU_WHITE, fontWeight: 800, fontSize: 20, marginBottom: 16 }}>🏆 Leaderboard</div>
            {sorted.length === 0
              ? <div style={{ color: "#555", textAlign: "center", padding: 24 }}>No players yet.</div>
              : sorted.map((u, i) => (
                <Card key={u.id} style={{ borderColor: i === 0 ? TTU_RED : "#333" }} onClick={() => setModal({ type: "profile", user: u })}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: i === 0 ? TTU_RED : "#aaa", fontWeight: 900, fontSize: 20, width: 28 }}>#{i + 1}</span>
                    <Avatar name={u.username} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: TTU_WHITE, fontWeight: 700 }}>{u.username}</span>
                        {u.dishonorable && <Badge label="🏴 DISHONORABLE" color="#8b0000" small />}
                      </div>
                      <div style={{ color: "#aaa", fontSize: 12 }}>{u.wins}W — {u.losses}L · {u.wins + u.losses > 0 ? Math.round(u.wins / (u.wins + u.losses) * 100) : 0}% win rate</div>
                    </div>
                    {i === 0 && <span style={{ fontSize: 22 }}>👑</span>}
                  </div>
                </Card>
              ))}
          </>
        )}
        {page === "friends" && (
          <>
            <div style={{ color: TTU_WHITE, fontWeight: 800, fontSize: 20, marginBottom: 16 }}>👥 Friends</div>
            {users.filter(u => u.id !== currentUser.id).length === 0
              ? <div style={{ color: "#555", textAlign: "center", padding: 24 }}>No other users yet. Share the app with your crew!</div>
              : users.filter(u => u.id !== currentUser.id).map(u => {
                const h2h = bets.filter(b => b.type === "1v1" && ((b.creator === currentUser.id && b.opponent === u.id) || (b.creator === u.id && b.opponent === currentUser.id)) && b.status === "settled");
                const myW = h2h.filter(b => b.winner === currentUser.id).length;
                return (
                  <Card key={u.id} onClick={() => setModal({ type: "profile", user: u })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={u.username} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: TTU_WHITE, fontWeight: 700 }}>{u.username}</span>
                          {u.dishonorable && <Badge label="🏴" color="#8b0000" small />}
                        </div>
                        <div style={{ color: "#aaa", fontSize: 12 }}>H2H: {myW}W — {h2h.length - myW}L vs you</div>
                      </div>
                      <Btn small onClick={e => { e.stopPropagation(); setModal({ type: "create" }); }}>Bet</Btn>
                    </div>
                  </Card>
                );
              })}
          </>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ background: "#111", borderTop: "1px solid #333", display: "flex", position: "sticky", bottom: 0, zIndex: 50 }}>
        {[["dashboard","🏠 Home"],["bets","⚔️ Bets"],["leaderboard","🏆 Board"],["friends","👥 Friends"]].map(([id, label]) => (
          <button key={id} onClick={() => setPage(id)} style={{ flex: 1, background: "none", border: "none", color: page === id ? TTU_RED : "#666", padding: "12px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", borderTop: page === id ? `2px solid ${TTU_RED}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}