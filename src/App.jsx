// App.jsx — Bro-Bets (Firebase Version)

import { useState, useCallback, useEffect, useRef } from "react";
import logo from "./assets/logo.svg";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot,
  updateDoc, deleteDoc, addDoc, getDocs, query, where,
  increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCM_zcCiYczoUJ5A4L4p3BwWJUlPesxQ9E",
  authDomain: "friendly-bets-1a2e8.firebaseapp.com",
  projectId: "friendly-bets-1a2e8",
  storageBucket: "friendly-bets-1a2e8.firebasestorage.app",
  messagingSenderId: "23993982484",
  appId: "1:23993982484:web:abdaa03718e43e22929101",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ── FCM ───────────────────────────────────────────────────
// Get your VAPID key: Firebase Console → Project Settings →
// Cloud Messaging → Web Push certificates → Generate key pair
const VAPID_KEY = "BJOGIeiqXKUzcTCcFyUY0WfwfwPE6UVHhM-c0bQkhjMX2VrF6rsRSsWXysYArtHsT3gqWoiZoCKrhSkmhiCBZXo";

let messaging = null;
try { messaging = getMessaging(firebaseApp); } catch {}

// Writes a notification record to Firestore.
// A Cloud Function (functions/index.js) watches this collection
// and sends the actual FCM push for background delivery.
const sendNotif = async (toUserId, body) => {
  if (!toUserId) return;
  try {
    await addDoc(collection(db, "notifications"), {
      toUserId, title: "Bro-Bets 👑", body,
      icon: "/logo.svg", createdAt: Date.now(), read: false,
    });
    console.log("[FCM] notification queued for", toUserId, "→", body);
  } catch (e) { console.error("[FCM] sendNotif failed:", e); }
};

// ── Colors ────────────────────────────────────────────────
const BLUE    = "#0070C0";
const DARK    = "#1c1c1e";
const CARD    = "#3a3a3c";
const SECTION = "#2c2c2e";
const DEEP    = "#141414";
const WHITE   = "#FFFFFF";

// ── Avatar System ─────────────────────────────────────────
const AVATARS = [
  { id: "skull",  emoji: "💀", bg: "#1a0505" },
  { id: "fire",   emoji: "🔥", bg: "#1a0800" },
  { id: "devil",  emoji: "😈", bg: "#2a0030" },
  { id: "clown",  emoji: "🤡", bg: "#0a1a1a" },
  { id: "bones",  emoji: "☠️", bg: "#0a0a20" },
  { id: "dagger", emoji: "🗡️", bg: "#001520" },
  { id: "steam",  emoji: "😤", bg: "#201a00" },
  { id: "curse",  emoji: "🤬", bg: "#200800" },
  { id: "snake",  emoji: "🐍", bg: "#001a08" },
  { id: "adevil", emoji: "👿", bg: "#300010" },
  { id: "bat",    emoji: "🦇", bg: "#08001a" },
  { id: "gun",    emoji: "🔫", bg: "#001a1a" },
];

const REACTIONS = ["🔥", "💀", "😂", "😤", "🤝", "💰", "⚡", "🏆"];

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ── Shared UI ─────────────────────────────────────────────
const Badge = ({ label, color, small }) => (
  <span style={{ background: color, color: WHITE, borderRadius: 4, padding: small ? "2px 6px" : "3px 10px", fontSize: small ? 11 : 12, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
);

const Avatar = ({ name, avatarId, size = 38 }) => {
  const av = avatarId && AVATARS.find(a => a.id === avatarId);
  if (av) return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.55, flexShrink: 0, border: "2px solid #444" }}>
      {av.emoji}
    </div>
  );
  const initials = name?.split("_").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: BLUE, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {initials}
    </div>
  );
};

const AvatarPicker = ({ value, onChange }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ color: "#aaa", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Choose Avatar</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {AVATARS.map(av => (
        <div key={av.id} onClick={() => onChange(value === av.id ? "" : av.id)}
          style={{ width: 44, height: 44, borderRadius: "50%", background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, cursor: "pointer", border: value === av.id ? `2px solid ${BLUE}` : "2px solid #444" }}>
          {av.emoji}
        </div>
      ))}
    </div>
  </div>
);

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: CARD, borderRadius: 10, padding: 16, marginBottom: 14, border: "1px solid #444", cursor: onClick ? "pointer" : undefined, ...style }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, style, variant = "primary", small, disabled }) => {
  const base = { border: "none", borderRadius: 6, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", letterSpacing: 0.5, padding: small ? "6px 14px" : "10px 20px", fontSize: small ? 12 : 14, opacity: disabled ? 0.5 : 1 };
  const variants = {
    primary: { background: BLUE, color: WHITE },
    outline:  { background: "transparent", color: BLUE, border: `2px solid ${BLUE}` },
    ghost:    { background: "transparent", color: "#aaa", border: "1px solid #444" },
    danger:   { background: "#8b0000", color: WHITE },
    success:  { background: "#1a7a1a", color: WHITE },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
};

const Field = ({ label, type = "text", value, onChange, placeholder }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: "100%", background: "#111", border: "1px solid #444", borderRadius: 6, color: WHITE, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }} />
  </div>
);

const Sel = ({ label, value, onChange, children }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
    <select value={value} onChange={onChange}
      style={{ width: "100%", background: "#111", border: "1px solid #444", borderRadius: 6, color: WHITE, padding: "9px 12px", fontSize: 14, boxSizing: "border-box" }}>
      {children}
    </select>
  </div>
);

// ── Countdown Timer ───────────────────────────────────────
function CountdownTimer({ endDate, compact, onNearEnd }) {
  const [left, setLeft] = useState(null);
  const nearEndFired = useRef(false);
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate) - Date.now();
      if (diff <= 0) { setLeft({ expired: true }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      setLeft({ days: d, hours: h, mins: Math.floor((diff % 3600000) / 60000), secs: Math.floor((diff % 60000) / 1000) });
      if (d === 0 && h < 24 && !nearEndFired.current && onNearEnd) {
        nearEndFired.current = true;
        onNearEnd();
      }
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!left) return null;
  if (left.expired) return <span style={{ color: "#ff4444", fontWeight: 700 }}>Season Ended</span>;
  const urgent = left.days < 1;
  if (compact) return <span style={{ color: urgent ? "#ff4444" : "#aaa", fontSize: 12, fontWeight: 700 }}>⏱ {left.days}d {left.hours}h {left.mins}m</span>;

  return (
    <div style={{ background: DEEP, borderRadius: 10, padding: "12px 16px", marginBottom: 14, border: `1px solid ${urgent ? "#ff4444" : BLUE}` }}>
      <div style={{ color: "#aaa", fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>⏱ SEASON COUNTDOWN</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {[["DAYS", left.days], ["HRS", left.hours], ["MIN", left.mins], ["SEC", left.secs]].map(([l, v]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ color: urgent ? "#ff4444" : WHITE, fontWeight: 900, fontSize: 24 }}>{String(v).padStart(2, "0")}</div>
            <div style={{ color: "#666", fontSize: 10 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reactions ─────────────────────────────────────────────
function ReactionBar({ betId, currentUser, betCreatorId }) {
  const [data, setData] = useState({});
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "reactions", betId), snap => setData(snap.exists() ? snap.data() : {}));
    return unsub;
  }, [betId]);

  const toggle = async emoji => {
    const ref = doc(db, "reactions", betId);
    const list = data[emoji] || [];
    const adding = !list.includes(currentUser.id);
    if (!adding) await setDoc(ref, { [emoji]: arrayRemove(currentUser.id) }, { merge: true });
    else {
      await setDoc(ref, { [emoji]: arrayUnion(currentUser.id) }, { merge: true });
      if (betCreatorId && betCreatorId !== currentUser.id) {
        await sendNotif(betCreatorId, `${emoji} ${currentUser.username} reacted to your bet!`);
      }
    }
  };
  const currentUserId = currentUser.id;

  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
      {REACTIONS.map(e => {
        const list = data[e] || [];
        const active = list.includes(currentUserId);
        return (
          <button key={e} onClick={() => toggle(e)}
            style={{ background: active ? BLUE + "33" : "#111", border: `1px solid ${active ? BLUE : "#444"}`, borderRadius: 20, padding: "3px 8px", fontSize: 13, cursor: "pointer", color: WHITE, display: "flex", alignItems: "center", gap: 3 }}>
            {e}{list.length > 0 && <span style={{ fontSize: 10, color: "#aaa" }}>{list.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Comments ──────────────────────────────────────────────
function CommentSection({ betId, currentUser, users, betCreatorId }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(collection(db, "bets", betId, "comments"), snap => {
      setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt));
    });
    return unsub;
  }, [betId, open]);

  const send = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "bets", betId, "comments"), { userId: currentUser.id, text: text.trim(), createdAt: Date.now() });
    if (betCreatorId && betCreatorId !== currentUser.id) {
      await sendNotif(betCreatorId, `💬 ${currentUser.username} talked trash on your bet!`);
    }
    setText("");
  };

  const getU = id => users.find(u => u.id === id);

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 12, cursor: "pointer", padding: 0 }}>
        💬 {open ? "Hide" : `Comments${msgs.length > 0 && !open ? ` (${msgs.length})` : ""}`}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {msgs.map(m => {
            const u = getU(m.userId);
            return (
              <div key={m.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <Avatar name={u?.username} avatarId={u?.avatarId} size={24} />
                <div style={{ background: "#111", borderRadius: 8, padding: "5px 10px", flex: 1 }}>
                  <span style={{ color: BLUE, fontSize: 11, fontWeight: 700 }}>{u?.username} </span>
                  <span style={{ color: WHITE, fontSize: 13 }}>{m.text}</span>
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Add a comment..." style={{ flex: 1, background: "#111", border: "1px solid #444", borderRadius: 6, color: WHITE, padding: "6px 10px", fontSize: 13 }} />
            <Btn small onClick={send}>Send</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────
function LoginPage({ showToast }) {
  const [mode, setMode] = useState("login");
  const [lf, setLf] = useState({ username: "", password: "" });
  const [sf, setSf] = useState({ username: "", password: "", venmo: "", cashapp: "", zelle: "", avatarId: "" });
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, `${lf.username.toLowerCase()}@brobets.app`, lf.password);
      showToast(`Welcome back, ${lf.username}! 🤝`);
    } catch { showToast("Invalid username or password", "error"); }
    finally { setLoading(false); }
  };

  const signup = async () => {
    if (loading) return;
    if (!sf.username) return showToast("Username required", "error");
    if (!sf.password || sf.password.length < 6) return showToast("Password must be 6+ characters", "error");
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      if (snap.docs.some(d => d.data().username.toLowerCase() === sf.username.toLowerCase())) {
        showToast("Username taken", "error"); return;
      }
      const cred = await createUserWithEmailAndPassword(auth, `${sf.username.toLowerCase()}@brobets.app`, sf.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        id: cred.user.uid, username: sf.username,
        venmo: sf.venmo || "", cashapp: sf.cashapp || "", zelle: sf.zelle || "",
        avatarId: sf.avatarId || "", wins: 0, losses: 0, dishonorable: false, dishonorableDebts: [],
      });
      showToast(`Welcome, ${sf.username}! Let's Bet Bro! 🤝`);
    } catch (e) {
      showToast(e.code === "auth/email-already-in-use" ? "Username taken" : "Signup failed", "error");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={logo} alt="Bro-Bets" style={{ width: 180 }} />
        </div>
        <div style={{ background: SECTION, borderRadius: 12, padding: 24, border: `2px solid ${BLUE}` }}>
          <div style={{ display: "flex", marginBottom: 20, borderBottom: "1px solid #444" }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, background: "none", border: "none", color: mode === m ? BLUE : "#aaa", fontWeight: 700, fontSize: 14, padding: "10px 0", cursor: "pointer", borderBottom: mode === m ? `2px solid ${BLUE}` : "none", letterSpacing: 1 }}>
                {m === "login" ? "LOG IN" : "SIGN UP"}
              </button>
            ))}
          </div>
          {mode === "login" ? (
            <>
              <Field label="Username" placeholder="Your username" value={lf.username} onChange={e => setLf(f => ({ ...f, username: e.target.value }))} />
              <Field label="Password" type="password" placeholder="••••••••" value={lf.password} onChange={e => setLf(f => ({ ...f, password: e.target.value }))} />
              <Btn onClick={login} style={{ width: "100%", marginTop: 8, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Logging in..." : "Log In 🤝"}
              </Btn>
            </>
          ) : (
            <>
              <Field label="Username" placeholder="BroName" value={sf.username} onChange={e => setSf(f => ({ ...f, username: e.target.value }))} />
              <Field label="Password" type="password" placeholder="6+ characters" value={sf.password} onChange={e => setSf(f => ({ ...f, password: e.target.value }))} />
              <Field label="Venmo (optional)" placeholder="@username" value={sf.venmo} onChange={e => setSf(f => ({ ...f, venmo: e.target.value }))} />
              <Field label="CashApp (optional)" placeholder="$username" value={sf.cashapp} onChange={e => setSf(f => ({ ...f, cashapp: e.target.value }))} />
              <Field label="Zelle (optional)" placeholder="phone or email" value={sf.zelle} onChange={e => setSf(f => ({ ...f, zelle: e.target.value }))} />
              <AvatarPicker value={sf.avatarId} onChange={id => setSf(f => ({ ...f, avatarId: id }))} />
              <Btn onClick={signup} style={{ width: "100%", marginTop: 8, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Creating account..." : "Create Account 🤝"}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── League Lobby ──────────────────────────────────────────
function LeagueLobby({ currentUser, showToast, myLeagues, onSelectLeague }) {
  const [tab, setTab] = useState("my");
  const [cf, setCf] = useState({ name: "", emoji: "🏆", themeColor: BLUE, startingMonies: "1000", endDate: "" });
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const createLeague = async () => {
    if (!cf.name.trim()) return showToast("League name required", "error");
    setLoading(true);
    try {
      const inviteCode = genCode();
      const ref = await addDoc(collection(db, "leagues"), {
        name: cf.name.trim(), emoji: cf.emoji || "🏆",
        inviteCode, themeColor: cf.themeColor || BLUE,
        startingMonies: Number(cf.startingMonies) || 1000,
        endDate: cf.endDate || "",
        commissionerId: currentUser.id,
        coCommissionerIds: [],
        status: "active",
        seasonEndBehavior: "reset",
        createdAt: Date.now(),
      });
      await setDoc(doc(db, "leagueMembers", `${ref.id}_${currentUser.id}`), {
        leagueId: ref.id, userId: currentUser.id, role: "commissioner",
        monies: Number(cf.startingMonies) || 1000, wins: 0, losses: 0, joinedAt: Date.now(),
      });
      showToast(`"${cf.name}" created! Code: ${inviteCode}`);
      setTab("my");
    } catch { showToast("Failed to create league", "error"); }
    finally { setLoading(false); }
  };

  const joinLeague = async () => {
    if (!joinCode.trim()) return showToast("Enter an invite code", "error");
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "leagues"), where("inviteCode", "==", joinCode.trim().toUpperCase())));
      if (snap.empty) { showToast("Invalid invite code", "error"); return; }
      const leagueDoc = snap.docs[0];
      const league = { id: leagueDoc.id, ...leagueDoc.data() };
      const memberRef = doc(db, "leagueMembers", `${league.id}_${currentUser.id}`);
      if ((await getDoc(memberRef)).exists()) { showToast("Already in this league!", "error"); return; }
      await setDoc(memberRef, {
        leagueId: league.id, userId: currentUser.id, role: "member",
        monies: league.startingMonies || 1000, wins: 0, losses: 0, joinedAt: Date.now(),
      });
      showToast(`Joined "${league.name}"! Let's Bet Bro! 🤝`);
      setTab("my");
    } catch { showToast("Failed to join league", "error"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: DARK, padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img src={logo} alt="Bro-Bets" style={{ width: 160 }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["my", "My Leagues"], ["create", "Create"], ["join", "Join"]].map(([t, l]) => (
          <Btn key={t} small variant={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)} style={{ flex: 1 }}>{l}</Btn>
        ))}
      </div>

      {tab === "my" && (
        <>
          {myLeagues.length === 0
            ? <div style={{ color: "#555", textAlign: "center", padding: 40 }}>No leagues yet. Create or join one!</div>
            : myLeagues.map(l => (
              <Card key={l.id} onClick={() => onSelectLeague(l)} style={{ borderColor: l.themeColor || BLUE }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{l.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: WHITE, fontWeight: 800, fontSize: 16 }}>{l.name}</div>
                    <div style={{ color: "#aaa", fontSize: 12 }}>Code: {l.inviteCode} · 💰 {l.startingMonies} starting</div>
                  </div>
                  <Btn small>Enter →</Btn>
                </div>
              </Card>
            ))}
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <Btn variant="ghost" small onClick={() => signOut(auth)}>Sign Out</Btn>
          </div>
        </>
      )}

      {tab === "create" && (
        <div style={{ background: SECTION, borderRadius: 12, padding: 20, border: "1px solid #444" }}>
          <Field label="League Name" placeholder="The Boys League" value={cf.name} onChange={e => setCf(f => ({ ...f, name: e.target.value }))} />
          <Field label="League Emoji" placeholder="🏆" value={cf.emoji} onChange={e => setCf(f => ({ ...f, emoji: e.target.value }))} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Theme Color</div>
            <input type="color" value={cf.themeColor} onChange={e => setCf(f => ({ ...f, themeColor: e.target.value }))}
              style={{ width: 48, height: 36, border: "1px solid #444", borderRadius: 6, background: "none", cursor: "pointer" }} />
          </div>
          <Field label="Starting 💰 Monies" type="number" placeholder="1000" value={cf.startingMonies} onChange={e => setCf(f => ({ ...f, startingMonies: e.target.value }))} />
          <Field label="Season End Date (optional)" type="date" value={cf.endDate} onChange={e => setCf(f => ({ ...f, endDate: e.target.value }))} />
          <Btn onClick={createLeague} style={{ width: "100%" }} disabled={loading}>{loading ? "Creating..." : "Create League 🏆"}</Btn>
        </div>
      )}

      {tab === "join" && (
        <div style={{ background: SECTION, borderRadius: 12, padding: 20, border: "1px solid #444" }}>
          <Field label="Invite Code" placeholder="ABC123" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
          <Btn onClick={joinLeague} style={{ width: "100%" }} disabled={loading}>{loading ? "Joining..." : "Join League 🤝"}</Btn>
        </div>
      )}
    </div>
  );
}

// ── Create Bet Modal ──────────────────────────────────────
function CreateBetModal({ users, currentUser, league, myMember, onClose, showToast }) {
  const [form, setForm] = useState({
    type: "1v1", opponentId: "", description: "", stakes: "",
    amount: "", deadline: "", winType: "single", inviteIds: [], anyAction: false,
  });
  const others = users.filter(u => u.id !== currentUser.id);
  const balance = myMember?.monies ?? 0;

  const toggleInvite = id => setForm(f => ({
    ...f, inviteIds: f.inviteIds.includes(id) ? f.inviteIds.filter(i => i !== id) : [...f.inviteIds, id]
  }));

  const submit = async () => {
    if (!form.description) return showToast("Add a bet description", "error");
    const amt = parseFloat(form.amount) || 0;
    if (amt > balance) return showToast(`Not enough 💰 Monies (have ${balance})`, "error");
    if (!form.anyAction && form.type === "1v1" && !form.opponentId) return showToast("Select an opponent", "error");

    const bet = {
      leagueId: league.id, type: form.anyAction ? "1v1" : form.type,
      creator: currentUser.id, description: form.description,
      stakes: form.stakes, amount: amt, deadline: form.deadline,
      anyAction: form.anyAction,
      status: form.anyAction ? "open" : (form.type === "1v1" ? "pending_acceptance" : "active"),
      winner: null, createdAt: Date.now(),
    };

    if (!form.anyAction) {
      if (form.type === "1v1") {
        bet.opponent = form.opponentId; bet.paidStatus = null; bet.reportedUnpaid = false;
      } else {
        const ids = form.inviteIds.filter(Boolean);
        bet.participants = [
          { userId: currentUser.id, amount: amt, paid: true },
          ...ids.map(id => ({ userId: id, amount: amt, paid: false }))
        ];
        bet.winType = form.winType; bet.resolveVotes = {};
      }
    }

    if (amt > 0) {
      await updateDoc(doc(db, "leagueMembers", `${league.id}_${currentUser.id}`), { monies: increment(-amt) });
    }
    await addDoc(collection(db, "bets"), bet);
    if (!form.anyAction && form.type === "1v1" && form.opponentId) {
      await sendNotif(form.opponentId, `⚔️ ${currentUser.username} challenged you to a bet!`);
    }
    onClose();
    showToast(form.anyAction ? "⚡ Any Action? posted to feed!" : "Bet created! 💰");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: SECTION, borderRadius: 12, padding: 24, width: "100%", maxWidth: 420, border: `2px solid ${BLUE}`, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: WHITE, fontWeight: 800, fontSize: 18 }}>💰 New Bet</span>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <div style={{ background: DEEP, borderRadius: 8, padding: "8px 12px", marginBottom: 12, color: "#aaa", fontSize: 12 }}>
          Balance: <span style={{ color: BLUE, fontWeight: 700 }}>💰 {balance} Monies</span>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, background: form.anyAction ? BLUE + "22" : DEEP, borderRadius: 8, padding: "10px 12px", marginBottom: 12, cursor: "pointer", border: form.anyAction ? `1px solid ${BLUE}` : "1px solid #333" }}>
          <input type="checkbox" checked={form.anyAction} onChange={e => setForm(f => ({ ...f, anyAction: e.target.checked }))} />
          <div>
            <div style={{ color: WHITE, fontWeight: 700, fontSize: 14 }}>⚡ Any Action?</div>
            <div style={{ color: "#aaa", fontSize: 11 }}>Post to feed — first member to claim locks it in</div>
          </div>
        </label>

        {!form.anyAction && (
          <Sel label="Bet Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="1v1">1 vs 1</option>
            <option value="pot">🪣 Group Pot</option>
          </Sel>
        )}
        {!form.anyAction && form.type === "1v1" && (
          <Sel label="Challenge" value={form.opponentId} onChange={e => setForm(f => ({ ...f, opponentId: e.target.value }))}>
            <option value="">Select opponent...</option>
            {others.map(u => <option key={u.id} value={u.id}>{u.username}{u.dishonorable ? " 🏴" : ""}</option>)}
          </Sel>
        )}
        {!form.anyAction && form.type === "pot" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Invite Friends</div>
            {others.map(u => (
              <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, color: WHITE, marginBottom: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={form.inviteIds.includes(u.id)} onChange={() => toggleInvite(u.id)} />
                {u.username}{u.dishonorable ? " 🏴" : ""}
              </label>
            ))}
          </div>
        )}
        <Field label="Bet Description" placeholder="e.g. Cowboys win Sunday" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <Field label="Stakes (custom)" placeholder="e.g. Buy dinner" value={form.stakes} onChange={e => setForm(f => ({ ...f, stakes: e.target.value }))} />
        <Field label="💰 Monies Wagered" type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <Field label="Deadline" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
        {!form.anyAction && form.type === "pot" && (
          <Sel label="Win Type" value={form.winType} onChange={e => setForm(f => ({ ...f, winType: e.target.value }))}>
            <option value="single">Single winner takes all</option>
            <option value="split">Split among winners</option>
          </Sel>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={submit} style={{ flex: 1 }}>Create Bet 💰</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Profile Modal ─────────────────────────────────────────
function ProfileModal({ user, currentUser, bets, memberData, onClose, showToast }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ venmo: user.venmo || "", cashapp: user.cashapp || "", zelle: user.zelle || "", avatarId: user.avatarId || "" });
  const isSelf = user.id === currentUser.id;

  const save = async () => {
    await updateDoc(doc(db, "users", currentUser.id), form);
    showToast("Profile updated!");
    setEditing(false);
    onClose();
  };

  const clearDishonorable = async betId => {
    await updateDoc(doc(db, "bets", betId), { paidStatus: "paid", reportedUnpaid: false });
    const newDebts = (user.dishonorableDebts || []).filter(d => d !== betId);
    await updateDoc(doc(db, "users", currentUser.id), { dishonorableDebts: newDebts, dishonorable: newDebts.length > 0 });
    showToast("Debt settled! Flag removed ✅");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: SECTION, borderRadius: 12, padding: 24, width: "100%", maxWidth: 380, border: `2px solid ${BLUE}`, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Avatar name={user.username} avatarId={user.avatarId} size={48} />
            <div>
              <div style={{ color: WHITE, fontWeight: 800, fontSize: 18 }}>{user.username}</div>
              {user.dishonorable && <Badge label="🏴 DISHONORABLE" color="#8b0000" />}
              {memberData?.role === "commissioner" && <Badge label="COMMISSIONER" color={BLUE} />}
              {memberData?.role === "co-commissioner" && <Badge label="CO-COMM" color={BLUE} />}
            </div>
          </div>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>

        {memberData && (
          <div style={{ background: DEEP, borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>💰 Monies Balance</div>
            <div style={{ color: BLUE, fontWeight: 900, fontSize: 22 }}>{memberData.monies ?? 0}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[["WINS", user.wins, BLUE], ["LOSSES", user.losses, "#aaa"]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center", flex: 1, background: "#111", borderRadius: 8, padding: 10 }}>
              <div style={{ color: c, fontWeight: 800, fontSize: 22 }}>{v}</div>
              <div style={{ color: "#aaa", fontSize: 12 }}>{l}</div>
            </div>
          ))}
        </div>

        {editing ? (
          <>
            <AvatarPicker value={form.avatarId} onChange={id => setForm(f => ({ ...f, avatarId: id }))} />
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
                  <span style={{ color: val ? WHITE : "#555", fontSize: 13 }}>{val || "Not set"}</span>
                </div>
              ))}
            </div>
            {isSelf && <Btn variant="outline" onClick={() => setEditing(true)} style={{ width: "100%", marginBottom: 8 }}>Edit Profile</Btn>}
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
                  <div style={{ color: WHITE, fontSize: 13 }}>{b.description}</div>
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

// ── Commissioner Dashboard ────────────────────────────────
function CommissionerDashboard({ league, currentUser, members, users, onClose, showToast }) {
  const [tab, setTab] = useState("members");
  const [giftForm, setGiftForm] = useState({ userId: "", amount: "" });
  const [announcement, setAnnouncement] = useState("");
  const [endDate, setEndDate] = useState(league.endDate || "");
  const [behavior, setBehavior] = useState(league.seasonEndBehavior || "reset");

  const getU = id => users.find(u => u.id === id);

  const kickMember = async uid => {
    if (!window.confirm("Remove this member from the league?")) return;
    await deleteDoc(doc(db, "leagueMembers", `${league.id}_${uid}`));
    showToast("Member removed.");
  };

  const promote = async uid => {
    await updateDoc(doc(db, "leagueMembers", `${league.id}_${uid}`), { role: "co-commissioner" });
    await updateDoc(doc(db, "leagues", league.id), { coCommissionerIds: arrayUnion(uid) });
    showToast("Promoted to Co-Commissioner! 🤝");
  };

  const demote = async uid => {
    await updateDoc(doc(db, "leagueMembers", `${league.id}_${uid}`), { role: "member" });
    await updateDoc(doc(db, "leagues", league.id), { coCommissionerIds: arrayRemove(uid) });
    showToast("Demoted to Member.");
  };

  const giftMonies = async () => {
    if (!giftForm.userId || !giftForm.amount) return showToast("Select member and amount", "error");
    const amt = parseInt(giftForm.amount);
    if (isNaN(amt)) return showToast("Invalid amount", "error");
    await updateDoc(doc(db, "leagueMembers", `${league.id}_${giftForm.userId}`), { monies: increment(amt) });
    if (amt > 0) await sendNotif(giftForm.userId, `💰 Commissioner sent you ${amt} Monies!`);
    showToast(`${amt >= 0 ? "Gifted" : "Deducted"} 💰 ${Math.abs(amt)} Monies!`);
    setGiftForm({ userId: "", amount: "" });
  };

  const postAnnouncement = async () => {
    if (!announcement.trim()) return;
    await addDoc(collection(db, "announcements"), {
      leagueId: league.id, text: announcement.trim(),
      commissionerId: currentUser.id, pinned: true, createdAt: Date.now(),
    });
    setAnnouncement("");
    showToast("Announcement posted! 📣");
  };

  const saveSettings = async () => {
    await updateDoc(doc(db, "leagues", league.id), { endDate, seasonEndBehavior: behavior });
    showToast("Settings saved!");
  };

  const newSeason = async () => {
    if (!window.confirm(`Start new season? Monies will ${behavior === "reset" ? "reset to " + league.startingMonies : "carry over"}.`)) return;
    for (const m of members) {
      const update = { wins: 0, losses: 0 };
      if (behavior === "reset") update.monies = league.startingMonies || 1000;
      await updateDoc(doc(db, "leagueMembers", `${league.id}_${m.userId}`), update);
    }
    await updateDoc(doc(db, "leagues", league.id), { status: "active", endDate: "" });
    showToast("New season started! 🏆");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div style={{ background: SECTION, borderRadius: 12, width: "100%", maxWidth: 460, border: `2px solid ${BLUE}`, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #444", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: WHITE, fontWeight: 800, fontSize: 16 }}>⚙️ Commissioner Dashboard</span>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <div style={{ display: "flex", borderBottom: "1px solid #333" }}>
          {[["members", "👥 Members"], ["monies", "💰 Monies"], ["announce", "📣 Post"], ["settings", "⚙️ Season"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: "none", border: "none", color: tab === t ? BLUE : "#aaa", fontWeight: 700, fontSize: 11, padding: "10px 0", cursor: "pointer", borderBottom: tab === t ? `2px solid ${BLUE}` : "none" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ padding: 20 }}>

          {tab === "members" && members.map(m => {
            const u = getU(m.userId);
            if (!u) return null;
            const isComm = m.userId === league.commissionerId;
            return (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, background: DEEP, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                <Avatar name={u.username} avatarId={u.avatarId} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: WHITE, fontWeight: 700, fontSize: 13 }}>{u.username}</div>
                  <div style={{ color: "#aaa", fontSize: 11 }}>{m.role} · 💰 {m.monies} · {m.wins}W {m.losses}L</div>
                </div>
                {!isComm && (
                  <div style={{ display: "flex", gap: 5 }}>
                    {m.role === "member" && <Btn small variant="outline" onClick={() => promote(m.userId)}>↑ Promote</Btn>}
                    {m.role === "co-commissioner" && <Btn small variant="ghost" onClick={() => demote(m.userId)}>↓</Btn>}
                    <Btn small variant="danger" onClick={() => kickMember(m.userId)}>Kick</Btn>
                  </div>
                )}
              </div>
            );
          })}

          {tab === "monies" && (
            <>
              <div style={{ color: "#aaa", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>GIFT / DEDUCT 💰 MONIES</div>
              <Sel label="Member" value={giftForm.userId} onChange={e => setGiftForm(f => ({ ...f, userId: e.target.value }))}>
                <option value="">Select member...</option>
                {members.map(m => { const u = getU(m.userId); return u ? <option key={m.userId} value={m.userId}>{u.username} (💰 {m.monies})</option> : null; })}
              </Sel>
              <Field label="Amount (negative to deduct)" type="number" placeholder="100" value={giftForm.amount} onChange={e => setGiftForm(f => ({ ...f, amount: e.target.value }))} />
              <Btn onClick={giftMonies} style={{ width: "100%" }}>Apply 💰</Btn>
            </>
          )}

          {tab === "announce" && (
            <>
              <div style={{ color: "#aaa", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📣 PIN ANNOUNCEMENT TO FEED</div>
              <Field label="Message" placeholder="Heads up Bros..." value={announcement} onChange={e => setAnnouncement(e.target.value)} />
              <Btn onClick={postAnnouncement} style={{ width: "100%" }}>Post 📣</Btn>
            </>
          )}

          {tab === "settings" && (
            <>
              <div style={{ color: "#aaa", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>SEASON SETTINGS</div>
              <Field label="Season End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <Sel label="End of Season Behavior" value={behavior} onChange={e => setBehavior(e.target.value)}>
                <option value="reset">Reset Monies to {league.startingMonies}</option>
                <option value="carryover">Carry over Monies</option>
              </Sel>
              <Btn onClick={saveSettings} style={{ width: "100%", marginBottom: 16 }}>Save Settings</Btn>
              <div style={{ borderTop: "1px solid #444", paddingTop: 14 }}>
                <div style={{ color: "#ff4444", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>⚠️ DANGER ZONE</div>
                <Btn variant="danger" onClick={newSeason} style={{ width: "100%" }}>🔄 Start New Season</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [users, setUsers] = useState([]);
  const [bets, setBets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState("feed");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueMembers, setLeagueMembers] = useState([]);
  const [allMyMemberships, setAllMyMemberships] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const initFCM = async uid => {
    if (!messaging) { console.warn("[FCM] messaging not initialized"); return; }
    try {
      const permission = await Notification.requestPermission();
      console.log("[FCM] permission:", permission);
      if (permission !== "granted") return;
      const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      console.log("[FCM] service worker registered:", swReg.scope);
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
      console.log("[FCM] token:", token ? token.slice(0, 20) + "…" : "none");
      if (token) {
        await updateDoc(doc(db, "users", uid), { fcmToken: token });
        console.log("[FCM] token saved to Firestore ✓");
      }
    } catch (e) { console.error("[FCM] init failed:", e); }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async fu => {
      if (fu) {
        const snap = await getDoc(doc(db, "users", fu.uid));
        if (snap.exists()) setCurrentUser({ id: fu.uid, ...snap.data() });
        initFCM(fu.uid);
      } else {
        setCurrentUser(null);
        setSelectedLeague(null);
      }
      setAuthReady(true);
    });
  }, []);

  // Show in-app notifications when the tab is open
  useEffect(() => {
    if (!currentUser) return;
    let ready = false;
    const unsub = onSnapshot(
      query(collection(db, "notifications"), where("toUserId", "==", currentUser.id), where("read", "==", false)),
      snap => {
        if (!ready) { ready = true; return; }
        snap.docChanges().forEach(change => {
          if (change.type !== "added") return;
          const { title, body, icon } = change.doc.data();
          if (Notification.permission === "granted") new Notification(title, { body, icon });
          updateDoc(change.doc.ref, { read: true });
        });
      }
    );
    return unsub;
  }, [currentUser?.id]);

  // Handle FCM foreground messages (when tab is focused)
  useEffect(() => {
    if (!messaging || !currentUser) return;
    return onMessage(messaging, ({ notification }) => {
      if (notification?.title && Notification.permission === "granted") {
        new Notification(notification.title, { body: notification.body, icon: notification.icon });
      }
    });
  }, [currentUser?.id]);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    if (currentUser) {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated) setCurrentUser(updated);
    }
  }, [users]);

  useEffect(() => {
    return onSnapshot(collection(db, "leagues"), snap => setLeagues(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Keep selectedLeague in sync
  useEffect(() => {
    if (selectedLeague) {
      const updated = leagues.find(l => l.id === selectedLeague.id);
      if (updated) setSelectedLeague(updated);
    }
  }, [leagues]);

  // My memberships across all leagues (for lobby)
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(
      query(collection(db, "leagueMembers"), where("userId", "==", currentUser.id)),
      snap => setAllMyMemberships(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [currentUser?.id]);

  // Members of selected league
  useEffect(() => {
    if (!selectedLeague) { setLeagueMembers([]); return; }
    return onSnapshot(
      query(collection(db, "leagueMembers"), where("leagueId", "==", selectedLeague.id)),
      snap => setLeagueMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [selectedLeague?.id]);

  // Bets for selected league
  useEffect(() => {
    if (!selectedLeague) { setBets([]); return; }
    return onSnapshot(
      query(collection(db, "bets"), where("leagueId", "==", selectedLeague.id)),
      snap => setBets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [selectedLeague?.id]);

  // Announcements for selected league
  useEffect(() => {
    if (!selectedLeague) { setAnnouncements([]); return; }
    return onSnapshot(
      query(collection(db, "announcements"), where("leagueId", "==", selectedLeague.id)),
      snap => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt))
    );
  }, [selectedLeague?.id]);

  const getUser = id => users.find(u => u.id === id);
  const getMember = uid => leagueMembers.find(m => m.userId === uid);
  const myMember = getMember(currentUser?.id);
  const myLeagues = leagues.filter(l => allMyMemberships.some(m => m.leagueId === l.id));

  const isCommissioner = selectedLeague && (
    selectedLeague.commissionerId === currentUser?.id ||
    selectedLeague.coCommissionerIds?.includes(currentUser?.id)
  );

  const myBets = bets.filter(b => {
    if (b.type === "1v1") return b.creator === currentUser?.id || b.opponent === currentUser?.id;
    if (b.type === "pot") return b.participants?.some(p => p.userId === currentUser?.id) || b.creator === currentUser?.id;
    return b.creator === currentUser?.id;
  });

  const pendingActions = myBets.filter(b =>
    (b.status === "pending_acceptance" && b.opponent === currentUser?.id) ||
    (b.status === "claimed" && b.claimedBy !== currentUser?.id) ||
    (b.type === "pot" && b.status === "resolve_voting" && !b.resolveVotes?.[currentUser?.id])
  );

  // ── Bet Actions ──
  const acceptBet = async id => {
    const bet = bets.find(b => b.id === id);
    const amt = bet.amount || 0;
    if (amt > (myMember?.monies ?? 0)) return showToast(`Not enough 💰 Monies (have ${myMember?.monies ?? 0})`, "error");
    if (amt > 0) await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${currentUser.id}`), { monies: increment(-amt) });
    await updateDoc(doc(db, "bets", id), { status: "active" });
    await sendNotif(bet.creator, `🤝 ${currentUser.username} accepted your bet challenge!`);
    showToast("Bet accepted! 🤝");
  };

  const declineBet = async id => {
    const bet = bets.find(b => b.id === id);
    if ((bet.amount || 0) > 0) {
      await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${bet.creator}`), { monies: increment(bet.amount) });
    }
    await deleteDoc(doc(db, "bets", id));
    showToast("Bet declined.");
  };

  const claimAnyAction = async id => {
    const bet = bets.find(b => b.id === id);
    const amt = bet.amount || 0;
    if (amt > (myMember?.monies ?? 0)) return showToast(`Not enough 💰 Monies (have ${myMember?.monies ?? 0})`, "error");
    if (amt > 0) await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${currentUser.id}`), { monies: increment(-amt) });
    await updateDoc(doc(db, "bets", id), { status: "pending_acceptance", opponent: currentUser.id, anyAction: false });
    await sendNotif(bet.creator, `🤝 ${currentUser.username} took your open bet!`);
    await acceptBet(id);
  };

  const claimWin = async id => {
    const bet = bets.find(b => b.id === id);
    const otherId = bet.creator === currentUser.id ? bet.opponent : bet.creator;
    await updateDoc(doc(db, "bets", id), { status: "claimed", claimedBy: currentUser.id });
    await sendNotif(otherId, `🏆 ${currentUser.username} claimed the win — confirm or dispute!`);
    showToast("Win claimed! Waiting for confirmation...");
  };

  const confirmWin = async id => {
    const bet = bets.find(b => b.id === id);
    const wId = bet.claimedBy;
    const lId = bet.creator === wId ? bet.opponent : bet.creator;
    const amt = bet.amount || 0;
    await updateDoc(doc(db, "bets", id), { status: "settled", winner: wId, paidStatus: "unpaid" });
    await updateDoc(doc(db, "users", wId), { wins: (getUser(wId)?.wins || 0) + 1 });
    await updateDoc(doc(db, "users", lId), { losses: (getUser(lId)?.losses || 0) + 1 });
    if (amt > 0) await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${wId}`), { monies: increment(amt * 2), wins: increment(1) });
    else await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${wId}`), { wins: increment(1) });
    await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${lId}`), { losses: increment(1) });
    showToast("Bet settled! 💰 Monies transferred!");
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
      const totalPot = bet.participants.reduce((s, p) => s + (p.amount || 0), 0);
      if (totalPot > 0) await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${wId}`), { monies: increment(totalPot), wins: increment(1) });
      else await updateDoc(doc(db, "leagueMembers", `${selectedLeague.id}_${wId}`), { wins: increment(1) });
    } else {
      await updateDoc(doc(db, "bets", betId), { resolveVotes: nv, status: "resolve_voting" });
    }
    showToast("Vote submitted!");
  };

  // ── BetCard ──
  const BetCard = ({ bet, inFeed }) => {
    const isCreator = bet.creator === currentUser.id;
    const isWinner = bet.winner === currentUser.id;
    const creator = getUser(bet.creator);
    const opp = bet.type === "1v1" ? getUser(isCreator ? bet.opponent : bet.creator) : null;
    const winner = getUser(bet.winner);
    const isOpen = bet.anyAction && bet.status === "open";
    const accent = selectedLeague?.themeColor || BLUE;

    const statusColor = {
      pending_acceptance: "#f59e0b", active: "#22c55e", claimed: "#f59e0b",
      settled: "#6b7280", resolve_voting: "#f59e0b", open: accent,
    }[bet.status] || "#aaa";
    const statusLabel = {
      pending_acceptance: "Pending", active: "Active", claimed: "Claimed",
      settled: "Settled", resolve_voting: "Voting", open: "Any Action?",
    }[bet.status];

    return (
      <Card style={{ borderColor: isOpen ? accent : "#444", borderWidth: isOpen ? 2 : 1 }}>
        {isOpen && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, display: "inline-block", animation: "pulse 1s infinite" }} />
            <span style={{ color: accent, fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>⚡ ANY ACTION? — UNCLAIMED</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {inFeed
              ? <Avatar name={creator?.username} avatarId={creator?.avatarId} size={28} />
              : (bet.type === "pot" ? <span style={{ fontSize: 20 }}>🪣</span> : <Avatar name={opp?.username} avatarId={opp?.avatarId} size={32} />)
            }
            <div>
              <div style={{ color: WHITE, fontWeight: 700, fontSize: 14 }}>
                {inFeed
                  ? `${creator?.username}${bet.type === "1v1" && bet.opponent ? ` vs ${getUser(bet.opponent)?.username}` : ""}`
                  : (bet.type === "1v1" ? `vs ${opp?.username || "?"}${opp?.dishonorable ? " 🏴" : ""}` : bet.description)}
              </div>
              <div style={{ color: "#aaa", fontSize: 12 }}>{bet.description}</div>
            </div>
          </div>
          <span style={{ color: statusColor, fontSize: 11, fontWeight: 700, background: statusColor + "22", padding: "3px 8px", borderRadius: 4, flexShrink: 0 }}>{statusLabel}</span>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          {bet.stakes && <span style={{ color: "#aaa", fontSize: 12 }}>📋 {bet.stakes}</span>}
          {bet.amount > 0 && <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>💰 {bet.amount} Monies</span>}
          {bet.deadline && <span style={{ color: "#aaa", fontSize: 12 }}>📅 {bet.deadline}</span>}
        </div>

        {bet.type === "pot" && (
          <div style={{ background: "#111", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
            {bet.participants?.map(p => {
              const u = getUser(p.userId);
              return (
                <div key={p.userId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: WHITE, marginBottom: 2 }}>
                  <span>{u?.username}{u?.dishonorable ? " 🏴" : ""}</span>
                  <span style={{ color: p.paid ? "#22c55e" : "#f59e0b" }}>💰 {p.amount} {p.paid ? "✓" : "pending"}</span>
                </div>
              );
            })}
            <div style={{ color: accent, fontWeight: 700, fontSize: 13, marginTop: 6 }}>
              Pot: 💰 {bet.participants?.reduce((s, p) => s + (p.amount || 0), 0)} Monies
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isOpen && !isCreator && <Btn small onClick={() => claimAnyAction(bet.id)}>⚡ I'll Take That!</Btn>}
          {isOpen && isCreator && <span style={{ color: "#aaa", fontSize: 12 }}>Waiting for someone to claim...</span>}
          {bet.status === "pending_acceptance" && !isCreator && bet.opponent === currentUser.id && (
            <><Btn small onClick={() => acceptBet(bet.id)}>Accept ✅</Btn><Btn small variant="danger" onClick={() => declineBet(bet.id)}>Decline ✗</Btn></>
          )}
          {bet.type === "1v1" && bet.status === "active" && (isCreator || bet.opponent === currentUser.id) && (
            <Btn small onClick={() => claimWin(bet.id)}>Claim Win 🏆</Btn>
          )}
          {bet.status === "claimed" && bet.claimedBy !== currentUser.id && (
            <><Btn small variant="success" onClick={() => confirmWin(bet.id)}>Confirm ✅</Btn><Btn small variant="danger" onClick={() => disputeClaim(bet.id)}>Dispute ⚠️</Btn></>
          )}
          {bet.status === "claimed" && bet.claimedBy === currentUser.id && <span style={{ color: "#f59e0b", fontSize: 12 }}>Waiting for confirmation...</span>}
          {bet.type === "1v1" && bet.status === "settled" && isWinner && !bet.reportedUnpaid && bet.paidStatus === "unpaid" && (
            <><Btn small variant="success" onClick={() => markPaid(bet.id)}>Mark Paid ✅</Btn><Btn small variant="danger" onClick={() => reportUnpaid(bet.id)}>Report Unpaid 🏴</Btn></>
          )}
          {bet.status === "settled" && bet.paidStatus === "paid" && <Badge label="✅ PAID" color="#1a7a1a" small />}
          {bet.status === "settled" && bet.reportedUnpaid && <Badge label="🏴 UNPAID" color="#8b0000" small />}
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
              {bet.type === "pot" && <Badge label={`🏆 Winner: ${winner.username}`} color={accent} small />}
              <div style={{ color: "#aaa", fontSize: 11, marginTop: 6, marginBottom: 2 }}>Pay {winner.username} via:</div>
              {[["Venmo", winner.venmo], ["CashApp", winner.cashapp], ["Zelle", winner.zelle]].filter(([, v]) => v).map(([l, v]) => (
                <span key={l} style={{ color: WHITE, fontSize: 11, background: "#111", borderRadius: 4, padding: "2px 7px", marginRight: 4 }}>{l}: {v}</span>
              ))}
            </div>
          )}
        </div>

        <ReactionBar betId={bet.id} currentUser={currentUser} betCreatorId={bet.creator} />
        <CommentSection betId={bet.id} currentUser={currentUser} users={users} betCreatorId={bet.creator} />
      </Card>
    );
  };

  // ── Loading / Auth gates ──
  if (!authReady) return (
    <div style={{ minHeight: "100vh", background: DARK, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <img src={logo} alt="Bro-Bets" style={{ width: 160 }} />
      <div style={{ color: "#aaa", fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (!currentUser) return <LoginPage showToast={showToast} />;

  if (!selectedLeague) return (
    <LeagueLobby currentUser={currentUser} showToast={showToast} myLeagues={myLeagues} onSelectLeague={l => { setSelectedLeague(l); setPage("feed"); }} />
  );

  const accent = selectedLeague.themeColor || BLUE;
  const starting = selectedLeague?.startingMonies || 1000;
  const sortedMembers = [...leagueMembers].sort((a, b) => ((b.monies ?? 0) - starting) - ((a.monies ?? 0) - starting));
  const openBets = bets.filter(b => b.anyAction && b.status === "open");
  const feedBets = [...bets].sort((a, b) => b.createdAt - a.createdAt).filter(b => !(b.anyAction && b.status === "open"));
  const pinnedAnnouncements = announcements.filter(a => a.pinned);

  return (
    <div style={{ background: DARK, minHeight: "100vh", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>

      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? "#8b0000" : "#1a7a1a", color: WHITE, padding: "10px 20px", borderRadius: 8, fontWeight: 700, zIndex: 300, fontSize: 14, maxWidth: "90vw", textAlign: "center" }}>
          {toast.msg}
        </div>
      )}

      {modal?.type === "create" && <CreateBetModal users={users} currentUser={currentUser} league={selectedLeague} myMember={myMember} onClose={() => setModal(null)} showToast={showToast} />}
      {modal?.type === "profile" && <ProfileModal user={users.find(u => u.id === modal.user.id) || modal.user} currentUser={currentUser} bets={bets} memberData={getMember(modal.user.id)} onClose={() => setModal(null)} showToast={showToast} />}
      {modal?.type === "commissioner" && <CommissionerDashboard league={selectedLeague} currentUser={currentUser} members={leagueMembers} users={users} onClose={() => setModal(null)} showToast={showToast} />}

      {/* Nav */}
      <div style={{ background: DEEP, borderBottom: `3px solid ${accent}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setSelectedLeague(null)}>
          <span style={{ fontSize: 20 }}>{selectedLeague.emoji}</span>
          <div>
            <div style={{ color: accent, fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>{selectedLeague.name}</div>
            <div style={{ color: "#444", fontSize: 9, letterSpacing: 1 }}>BRO-BETS · tap to switch</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {myMember != null && (
            <span style={{ color: accent, fontWeight: 800, fontSize: 13, background: accent + "22", padding: "4px 8px", borderRadius: 6 }}>
              💰 {myMember.monies}
            </span>
          )}
          {pendingActions.length > 0 && (
            <span style={{ background: "#f59e0b", color: DEEP, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>
              {pendingActions.length}
            </span>
          )}
          <div style={{ cursor: "pointer" }} onClick={() => setModal({ type: "profile", user: currentUser })}>
            <Avatar name={currentUser.username} avatarId={currentUser.avatarId} size={34} />
          </div>
          {isCommissioner && <Btn variant="ghost" small onClick={() => setModal({ type: "commissioner" })}>⚙️</Btn>}
          <Btn variant="ghost" small onClick={() => signOut(auth)}>Out</Btn>
        </div>
      </div>

      {/* Pages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

        {page === "feed" && (
          <>
            {selectedLeague.endDate && <CountdownTimer endDate={selectedLeague.endDate} onNearEnd={() => sendNotif(currentUser.id, "⏱️ 24 hours left in the season! Place your bets!")} />}

            {pinnedAnnouncements.length > 0 && pinnedAnnouncements.map(a => (
              <div key={a.id} style={{ background: accent + "18", border: `1px solid ${accent}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18 }}>📣</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: WHITE, fontSize: 13 }}>{a.text}</div>
                  <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>Commissioner · {new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
                {isCommissioner && (
                  <Btn small variant="ghost" onClick={() => updateDoc(doc(db, "announcements", a.id), { pinned: false })} style={{ padding: "2px 6px" }}>✕</Btn>
                )}
              </div>
            ))}

            {openBets.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ color: accent, fontWeight: 800, fontSize: 12, marginBottom: 8, letterSpacing: 1 }}>⚡ ANY ACTION? — OPEN BETS</div>
                {openBets.map(b => <BetCard key={b.id} bet={b} inFeed />)}
                <div style={{ borderTop: "1px solid #333", marginBottom: 14 }} />
              </div>
            )}

            <div style={{ color: "#555", fontWeight: 700, fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>LEAGUE FEED</div>
            {feedBets.length === 0
              ? <div style={{ color: "#555", textAlign: "center", padding: 32 }}>No bets yet. Create one! 💰</div>
              : feedBets.map(b => <BetCard key={b.id} bet={b} inFeed />)
            }
          </>
        )}

        {page === "bets" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ color: WHITE, fontWeight: 800, fontSize: 20 }}>💰 My Bets</div>
              <Btn small onClick={() => setModal({ type: "create" })}>+ New Bet</Btn>
            </div>
            {pendingActions.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: 1 }}>⚡ ACTION REQUIRED ({pendingActions.length})</div>
                {pendingActions.map(b => <BetCard key={b.id} bet={b} />)}
                <div style={{ borderTop: "1px solid #333", marginBottom: 14 }} />
              </div>
            )}
            {myBets.filter(b => !pendingActions.find(p => p.id === b.id)).map(b => <BetCard key={b.id} bet={b} />)}
            {myBets.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: 32 }}>No bets yet. Start one! 💰</div>}
          </>
        )}

        {page === "leaderboard" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: WHITE, fontWeight: 800, fontSize: 20 }}>🏆 Leaderboard</div>
              {selectedLeague.endDate && <CountdownTimer endDate={selectedLeague.endDate} compact />}
            </div>
            {sortedMembers.length === 0
              ? <div style={{ color: "#555", textAlign: "center", padding: 32 }}>No members yet.</div>
              : sortedMembers.map((m, i) => {
                const u = getUser(m.userId);
                if (!u) return null;
                const total = (m.wins || 0) + (m.losses || 0);
                const winPct = total > 0 ? Math.round(m.wins / total * 100) : 0;
                const profit = (m.monies ?? 0) - (selectedLeague.startingMonies || 1000);
                const profitColor = profit > 0 ? "#22c55e" : profit < 0 ? "#ff4444" : "#aaa";
                return (
                  <Card key={m.userId} style={{ borderColor: i === 0 ? accent : "#444" }} onClick={() => setModal({ type: "profile", user: u })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: i === 0 ? accent : "#666", fontWeight: 900, fontSize: 18, width: 26, flexShrink: 0 }}>#{i + 1}</span>
                      <Avatar name={u.username} avatarId={u.avatarId} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ color: WHITE, fontWeight: 700 }}>{u.username}</span>
                          {u.dishonorable && <Badge label="🏴" color="#8b0000" small />}
                          {m.role !== "member" && <Badge label={m.role === "commissioner" ? "COMM" : "CO-COMM"} color={accent} small />}
                        </div>
                        <div style={{ color: "#aaa", fontSize: 12 }}>{m.wins || 0}W — {m.losses || 0}L · {winPct}% · 💰 {m.monies ?? 0}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: profitColor, fontWeight: 900, fontSize: 18 }}>{profit >= 0 ? "+" : ""}{profit}</div>
                        <div style={{ color: "#555", fontSize: 10 }}>PROFIT</div>
                        {i === 0 && <div style={{ fontSize: 14 }}>👑</div>}
                      </div>
                    </div>
                  </Card>
                );
              })}
          </>
        )}

        {page === "friends" && (
          <>
            <div style={{ color: WHITE, fontWeight: 800, fontSize: 20, marginBottom: 14 }}>👥 Bros</div>
            <div style={{ background: SECTION, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ color: "#aaa", fontSize: 11, fontWeight: 600 }}>INVITE CODE</div>
                <div style={{ color: WHITE, fontWeight: 900, fontSize: 20, letterSpacing: 3 }}>{selectedLeague.inviteCode}</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ color: "#555", fontSize: 11 }}>Share to invite Bros</div>
            </div>
            {leagueMembers.filter(m => m.userId !== currentUser.id).length === 0
              ? <div style={{ color: "#555", textAlign: "center", padding: 32 }}>No other members yet. Share the invite code!</div>
              : leagueMembers.filter(m => m.userId !== currentUser.id).map(m => {
                const u = getUser(m.userId);
                if (!u) return null;
                const h2h = bets.filter(b => b.type === "1v1" && b.status === "settled" &&
                  ((b.creator === currentUser.id && b.opponent === u.id) || (b.creator === u.id && b.opponent === currentUser.id)));
                const myW = h2h.filter(b => b.winner === currentUser.id).length;
                return (
                  <Card key={m.userId} onClick={() => setModal({ type: "profile", user: u })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={u.username} avatarId={u.avatarId} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: WHITE, fontWeight: 700 }}>{u.username}</span>
                          {u.dishonorable && <Badge label="🏴" color="#8b0000" small />}
                        </div>
                        <div style={{ color: "#aaa", fontSize: 12 }}>H2H: {myW}W — {h2h.length - myW}L · 💰 {m.monies ?? 0}</div>
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
      <div style={{ background: DEEP, borderTop: "1px solid #222", display: "flex", position: "sticky", bottom: 0, zIndex: 50 }}>
        {[["feed", "📣 Feed"], ["bets", "💰 Bets"], ["leaderboard", "🏆 Board"], ["friends", "👥 Bros"]].map(([id, label]) => (
          <button key={id} onClick={() => setPage(id)}
            style={{ flex: 1, background: "none", border: "none", color: page === id ? accent : "#555", padding: "12px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", borderTop: page === id ? `2px solid ${accent}` : "2px solid transparent", letterSpacing: 0.5 }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
