const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

exports.pushNotification = onDocumentCreated("notifications/{id}", async event => {
  const { toUserId, title, body, icon } = event.data.data();
  console.log(`[pushNotification] new notification doc for user ${toUserId}: "${title}"`);

  const user = await admin.firestore().doc(`users/${toUserId}`).get();
  const token = user.data()?.fcmToken;
  if (!token) {
    console.log(`[pushNotification] user ${toUserId} has no fcmToken on file — skipping push`);
    return;
  }

  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      webpush: { notification: { icon } },
    });
    console.log(`[pushNotification] push sent to ${toUserId}`);
  } catch (e) {
    console.error(`[pushNotification] send failed for ${toUserId}:`, e.message);
  }
});

// ── Helpers ───────────────────────────────────────────────
function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
  return request.auth.uid;
}

async function requireCommissioner(leagueId, uid) {
  const leagueSnap = await db.doc(`leagues/${leagueId}`).get();
  if (!leagueSnap.exists) throw new HttpsError("not-found", "League not found.");
  const league = leagueSnap.data();
  const isComm = league.commissionerId === uid || (league.coCommissionerIds || []).includes(uid);
  if (!isComm) throw new HttpsError("permission-denied", "Commissioner access required.");
  return { league };
}

async function usernameOf(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.data()?.username || "Someone";
}

async function sendNotif(toUserId, body, extra = {}) {
  if (!toUserId) return;
  await db.collection("notifications").add({
    toUserId, title: "Bro-Bets 👑", body, icon: "/logo.svg", createdAt: Date.now(), read: false,
    ...extra,
  });
}

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ── League creation / joining ────────────────────────────
exports.createLeague = onCall(async request => {
  const uid = requireAuth(request);
  const { name, emoji, themeColor, startingMonies, endDate } = request.data || {};
  if (!name || !name.trim()) throw new HttpsError("invalid-argument", "League name required.");
  const monies = Number(startingMonies) || 1000;
  const inviteCode = genCode();

  const leagueRef = db.collection("leagues").doc();
  await db.runTransaction(async tx => {
    tx.set(leagueRef, {
      name: name.trim(), emoji: emoji || "🏆", inviteCode,
      themeColor: themeColor || "#0070C0",
      startingMonies: monies, endDate: endDate || "",
      commissionerId: uid, coCommissionerIds: [],
      status: "active", seasonEndBehavior: "reset", createdAt: Date.now(),
    });
    tx.set(db.doc(`leagueMembers/${leagueRef.id}_${uid}`), {
      leagueId: leagueRef.id, userId: uid, role: "commissioner",
      monies, wins: 0, losses: 0, joinedAt: Date.now(),
    });
  });
  return { leagueId: leagueRef.id, inviteCode };
});

exports.joinLeague = onCall(async request => {
  const uid = requireAuth(request);
  const code = (request.data?.inviteCode || "").trim().toUpperCase();
  if (!code) throw new HttpsError("invalid-argument", "Invite code required.");

  const snap = await db.collection("leagues").where("inviteCode", "==", code).limit(1).get();
  if (snap.empty) throw new HttpsError("not-found", "Invalid invite code.");
  const leagueDoc = snap.docs[0];
  const league = leagueDoc.data();

  const memberRef = db.doc(`leagueMembers/${leagueDoc.id}_${uid}`);
  await db.runTransaction(async tx => {
    const existing = await tx.get(memberRef);
    if (existing.exists) throw new HttpsError("already-exists", "Already in this league.");
    tx.set(memberRef, {
      leagueId: leagueDoc.id, userId: uid, role: "member",
      monies: league.startingMonies || 1000, wins: 0, losses: 0, joinedAt: Date.now(),
    });
  });
  return { leagueId: leagueDoc.id, name: league.name };
});

// ── Bet creation ──────────────────────────────────────────
exports.createBet = onCall(async request => {
  const uid = requireAuth(request);
  const { leagueId, type, opponentId, description, stakes, amount, deadline, winType, inviteIds, anyAction } = request.data || {};
  if (!leagueId) throw new HttpsError("invalid-argument", "leagueId required.");
  if (!description || !description.trim()) throw new HttpsError("invalid-argument", "Bet description required.");
  const amt = Number(amount) || 0;
  if (amt < 0) throw new HttpsError("invalid-argument", "Amount cannot be negative.");

  const betType = anyAction ? "1v1" : type;

  if (!anyAction && betType === "1v1") {
    if (!opponentId) throw new HttpsError("invalid-argument", "Opponent required.");
    if (opponentId === uid) throw new HttpsError("invalid-argument", "Cannot challenge yourself.");
    const oppSnap = await db.doc(`leagueMembers/${leagueId}_${opponentId}`).get();
    if (!oppSnap.exists) throw new HttpsError("failed-precondition", "Opponent is not a member of this league.");
  }

  let inviteList = [];
  if (!anyAction && betType === "pot") {
    inviteList = [...new Set((inviteIds || []).filter(Boolean))].filter(id => id !== uid);
    for (const id of inviteList) {
      const s = await db.doc(`leagueMembers/${leagueId}_${id}`).get();
      if (!s.exists) throw new HttpsError("failed-precondition", "All pot invitees must be league members.");
    }
  }

  // Duplicate-submit guard: block an identical still-open bet from the same creator.
  const dupSnap = await db.collection("bets")
    .where("leagueId", "==", leagueId)
    .where("creator", "==", uid)
    .where("description", "==", description.trim())
    .where("amount", "==", amt)
    .where("status", "in", ["pending_acceptance", "active", "open"])
    .get();
  if (!dupSnap.empty) throw new HttpsError("already-exists", "An identical bet is already pending.");

  const memberRef = db.doc(`leagueMembers/${leagueId}_${uid}`);
  const betRef = db.collection("bets").doc();

  await db.runTransaction(async tx => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) throw new HttpsError("permission-denied", "Not a member of this league.");
    const balance = memberSnap.data().monies ?? 0;
    if (amt > balance) throw new HttpsError("failed-precondition", `Not enough Monies (have ${balance}).`);

    const betData = {
      leagueId, type: betType, creator: uid, description: description.trim(),
      stakes: stakes || "", amount: amt, deadline: deadline || "",
      anyAction: !!anyAction,
      status: anyAction ? "open" : (betType === "1v1" ? "pending_acceptance" : "active"),
      winner: null, createdAt: Date.now(),
    };
    if (!anyAction) {
      if (betType === "1v1") {
        betData.opponent = opponentId; betData.paidStatus = null; betData.reportedUnpaid = false;
      } else {
        betData.participants = [
          { userId: uid, amount: amt, paid: true },
          ...inviteList.map(id => ({ userId: id, amount: amt, paid: false })),
        ];
        betData.winType = winType || "single";
        betData.resolveVotes = {};
      }
    }

    tx.set(betRef, betData);
    if (amt > 0) tx.update(memberRef, { monies: FieldValue.increment(-amt) });
  });

  if (!anyAction && betType === "1v1" && opponentId) {
    const creatorName = await usernameOf(uid);
    await sendNotif(opponentId, `⚔️ ${creatorName} challenged you to a bet!`, { type: "challenge", betId: betRef.id });
  }
  return { betId: betRef.id };
});

// ── Bet lifecycle ─────────────────────────────────────────
exports.acceptBet = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  const result = await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.creator === uid) throw new HttpsError("failed-precondition", "Cannot accept your own bet.");

    const isOpenClaim = bet.anyAction && bet.status === "open";
    const isDirectAccept = !bet.anyAction && bet.status === "pending_acceptance" && bet.opponent === uid;
    const participants = bet.participants || [];
    const potIdx = participants.findIndex(p => p.userId === uid && !p.paid);
    const isPotJoin = bet.type === "pot" && potIdx !== -1 && bet.status === "active";

    if (!isOpenClaim && !isDirectAccept && !isPotJoin) {
      throw new HttpsError("failed-precondition", "This bet can no longer be accepted.");
    }

    const memberRef = db.doc(`leagueMembers/${bet.leagueId}_${uid}`);
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) throw new HttpsError("permission-denied", "Not a member of this league.");
    const amt = bet.amount || 0;
    const balance = memberSnap.data().monies ?? 0;
    if (amt > balance) throw new HttpsError("failed-precondition", `Not enough Monies (have ${balance}).`);

    if (isPotJoin) {
      if (amt > 0) tx.update(memberRef, { monies: FieldValue.increment(-amt) });
      const updatedParticipants = participants.map((p, i) =>
        i === potIdx ? { ...p, paid: true } : p
      );
      tx.update(betRef, { participants: updatedParticipants });
      return { creatorId: bet.creator, isPotJoin: true };
    }

    if (amt > 0) tx.update(memberRef, { monies: FieldValue.increment(-amt) });
    tx.update(betRef, isOpenClaim
      ? { status: "active", opponent: uid, anyAction: false }
      : { status: "active" });

    return { creatorId: bet.creator, isPotJoin: false };
  });

  const accepter = await usernameOf(uid);
  if (result.isPotJoin) {
    await sendNotif(result.creatorId, `🪣 ${accepter} joined the pot!`, { type: "pot_joined", betId });
  } else {
    await sendNotif(result.creatorId, `🤝 ${accepter} accepted your bet challenge!`, { type: "accepted", betId });
  }
  return { ok: true };
});

exports.declineBet = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.opponent !== uid) throw new HttpsError("permission-denied", "Only the challenged opponent can decline.");
    if (bet.status !== "pending_acceptance") throw new HttpsError("failed-precondition", "Bet is not pending.");

    if ((bet.amount || 0) > 0) {
      tx.update(db.doc(`leagueMembers/${bet.leagueId}_${bet.creator}`), { monies: FieldValue.increment(bet.amount) });
    }
    tx.delete(betRef);
  });
  return { ok: true };
});

exports.claimWin = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  const result = await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.type !== "1v1" || bet.status !== "active") throw new HttpsError("failed-precondition", "Bet cannot be claimed right now.");
    if (bet.creator !== uid && bet.opponent !== uid) throw new HttpsError("permission-denied", "Not a participant in this bet.");

    tx.update(betRef, { status: "claimed", claimedBy: uid });
    return { otherId: bet.creator === uid ? bet.opponent : bet.creator };
  });

  const claimer = await usernameOf(uid);
  await sendNotif(result.otherId, `🏆 ${claimer} claimed the win — confirm or dispute!`, { type: "claim", betId });
  return { ok: true };
});

exports.confirmWin = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.status !== "claimed") throw new HttpsError("failed-precondition", "No claim to confirm.");
    if (bet.claimedBy === uid) throw new HttpsError("permission-denied", "You cannot confirm your own claim.");
    if (bet.creator !== uid && bet.opponent !== uid) throw new HttpsError("permission-denied", "Not a participant in this bet.");

    const wId = bet.claimedBy;
    const lId = bet.creator === wId ? bet.opponent : bet.creator;
    const amt = bet.amount || 0;

    tx.update(betRef, { status: "settled", winner: wId, paidStatus: "unpaid" });
    tx.update(db.doc(`users/${wId}`), { wins: FieldValue.increment(1) });
    tx.update(db.doc(`users/${lId}`), { losses: FieldValue.increment(1) });
    tx.update(db.doc(`leagueMembers/${bet.leagueId}_${wId}`), amt > 0
      ? { monies: FieldValue.increment(amt * 2), wins: FieldValue.increment(1) }
      : { wins: FieldValue.increment(1) });
    tx.update(db.doc(`leagueMembers/${bet.leagueId}_${lId}`), { losses: FieldValue.increment(1) });
  });
  return { ok: true };
});

exports.disputeClaim = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.status !== "claimed") throw new HttpsError("failed-precondition", "No claim to dispute.");
    if (bet.claimedBy === uid) throw new HttpsError("permission-denied", "You cannot dispute your own claim.");
    if (bet.creator !== uid && bet.opponent !== uid) throw new HttpsError("permission-denied", "Not a participant in this bet.");

    tx.update(betRef, { status: "active", claimedBy: null });
  });
  return { ok: true };
});

exports.markPaid = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.status !== "settled" || bet.winner !== uid) throw new HttpsError("permission-denied", "Only the winner can mark this bet as paid.");
    tx.update(betRef, { paidStatus: "paid" });
  });
  return { ok: true };
});

exports.reportUnpaid = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.status !== "settled" || bet.winner !== uid) throw new HttpsError("permission-denied", "Only the winner can report this bet unpaid.");

    const debtorId = bet.creator === uid ? bet.opponent : bet.creator;
    const debtorRef = db.doc(`users/${debtorId}`);
    const debtorSnap = await tx.get(debtorRef);
    const debts = debtorSnap.data()?.dishonorableDebts || [];

    tx.update(betRef, { paidStatus: "unpaid", reportedUnpaid: true });
    tx.update(debtorRef, { dishonorable: true, dishonorableDebts: [...debts, betId] });
  });
  return { ok: true };
});

exports.startPotVote = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.type !== "pot" || bet.creator !== uid) throw new HttpsError("permission-denied", "Only the pot creator can start the vote.");
    if (!["active", "resolve_voting"].includes(bet.status)) throw new HttpsError("failed-precondition", "Cannot start voting now.");
    tx.update(betRef, { status: "resolve_voting" });
  });
  return { ok: true };
});

exports.votePotWinner = onCall(async request => {
  const uid = requireAuth(request);
  const { betId, winnerId } = request.data || {};
  if (!betId || !winnerId) throw new HttpsError("invalid-argument", "betId and winnerId required.");
  const betRef = db.doc(`bets/${betId}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    if (bet.type !== "pot") throw new HttpsError("failed-precondition", "Not a pot bet.");
    if (!["active", "resolve_voting"].includes(bet.status)) throw new HttpsError("failed-precondition", "Voting is not open.");

    const participantIds = (bet.participants || []).map(p => p.userId);
    if (!participantIds.includes(uid)) throw new HttpsError("permission-denied", "Not a participant in this pot.");
    if (!participantIds.includes(winnerId)) throw new HttpsError("invalid-argument", "Winner must be a participant.");

    const nv = { ...(bet.resolveVotes || {}), [uid]: winnerId };
    const tally = {};
    Object.values(nv).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
    const majority = Object.entries(tally).find(([, c]) => c > participantIds.length / 2);

    if (majority) {
      const wId = majority[0];
      const totalPot = (bet.participants || []).filter(p => p.paid).reduce((s, p) => s + (p.amount || 0), 0);

      tx.update(betRef, { resolveVotes: nv, status: "settled", winner: wId });
      tx.update(db.doc(`users/${wId}`), { wins: FieldValue.increment(1) });
      for (const p of bet.participants) {
        if (p.userId !== wId) tx.update(db.doc(`users/${p.userId}`), { losses: FieldValue.increment(1) });
      }
      tx.update(db.doc(`leagueMembers/${bet.leagueId}_${wId}`), totalPot > 0
        ? { monies: FieldValue.increment(totalPot), wins: FieldValue.increment(1) }
        : { wins: FieldValue.increment(1) });
    } else {
      tx.update(betRef, { resolveVotes: nv, status: "resolve_voting" });
    }
  });
  return { ok: true };
});

exports.clearDishonorable = onCall(async request => {
  const uid = requireAuth(request);
  const { betId } = request.data || {};
  if (!betId) throw new HttpsError("invalid-argument", "betId required.");
  const betRef = db.doc(`bets/${betId}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async tx => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    const bet = betSnap.data();
    const debtorId = bet.winner ? (bet.creator === bet.winner ? bet.opponent : bet.creator) : null;
    if (bet.type !== "1v1" || debtorId !== uid) throw new HttpsError("permission-denied", "You are not the debtor on this bet.");

    const userSnap = await tx.get(userRef);
    const debts = (userSnap.data()?.dishonorableDebts || []).filter(d => d !== betId);
    tx.update(betRef, { paidStatus: "paid", reportedUnpaid: false });
    tx.update(userRef, { dishonorableDebts: debts, dishonorable: debts.length > 0 });
  });
  return { ok: true };
});

// ── Commissioner: Monies & season ────────────────────────
exports.giftMonies = onCall(async request => {
  const uid = requireAuth(request);
  const { leagueId, userId, amount } = request.data || {};
  if (!leagueId || !userId) throw new HttpsError("invalid-argument", "leagueId and userId required.");
  const amt = parseInt(amount, 10);
  if (isNaN(amt)) throw new HttpsError("invalid-argument", "Invalid amount.");
  await requireCommissioner(leagueId, uid);

  const memberRef = db.doc(`leagueMembers/${leagueId}_${userId}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(memberRef);
    if (!snap.exists) throw new HttpsError("not-found", "Member not found.");
    const current = snap.data().monies ?? 0;
    // Deductions floor at zero; gifts (positive amounts) stay uncapped.
    const next = amt < 0 ? Math.max(0, current + amt) : current + amt;
    tx.update(memberRef, { monies: next });
  });

  if (amt > 0) await sendNotif(userId, `💰 Commissioner sent you ${amt} Monies!`, { type: "gift" });
  return { ok: true };
});

exports.newSeason = onCall(async request => {
  const uid = requireAuth(request);
  const { leagueId, behavior } = request.data || {};
  if (!leagueId) throw new HttpsError("invalid-argument", "leagueId required.");
  const { league } = await requireCommissioner(leagueId, uid);
  const seasonBehavior = behavior || league.seasonEndBehavior || "reset";

  const membersSnap = await db.collection("leagueMembers").where("leagueId", "==", leagueId).get();
  const batch = db.batch();
  membersSnap.docs.forEach(d => {
    const update = { wins: 0, losses: 0 };
    if (seasonBehavior === "reset") update.monies = league.startingMonies || 1000;
    batch.update(d.ref, update);
  });
  batch.update(db.doc(`leagues/${leagueId}`), { status: "active", endDate: "" });
  await batch.commit();
  return { ok: true };
});
