import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'PASTE_FIREBASE_API_KEY',
  authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE_PROJECT_ID.appspot.com',
  messagingSenderId: 'PASTE_MESSAGING_SENDER_ID',
  appId: 'PASTE_APP_ID'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const els = {
  authStatus: document.querySelector('#authStatus'),
  signInButton: document.querySelector('#signInButton'),
  profileForm: document.querySelector('#profileForm'),
  displayNameInput: document.querySelector('#displayNameInput'),
  balanceText: document.querySelector('#balanceText'),
  roleText: document.querySelector('#roleText'),
  horseForm: document.querySelector('#horseForm'),
  horseNameInput: document.querySelector('#horseNameInput'),
  horseColorInput: document.querySelector('#horseColorInput'),
  raceStatus: document.querySelector('#raceStatus'),
  track: document.querySelector('#track'),
  betForm: document.querySelector('#betForm'),
  betHorseSelect: document.querySelector('#betHorseSelect'),
  betAmountInput: document.querySelector('#betAmountInput'),
  adminPanel: document.querySelector('#adminPanel'),
  grantForm: document.querySelector('#grantForm'),
  grantUserSelect: document.querySelector('#grantUserSelect'),
  grantAmountInput: document.querySelector('#grantAmountInput'),
  prepareRaceButton: document.querySelector('#prepareRaceButton'),
  startRaceButton: document.querySelector('#startRaceButton'),
  settleRaceButton: document.querySelector('#settleRaceButton'),
  horseRowTemplate: document.querySelector('#horseRowTemplate')
};

const state = {
  uid: null,
  user: null,
  isAdmin: false,
  users: [],
  horses: [],
  race: null,
  animationFrame: null
};

const latestRaceId = 'current';

function formatCoins(value) {
  return new Intl.NumberFormat('ja-JP').format(value || 0);
}

function setStatus(message) {
  els.authStatus.textContent = message;
}

function ensureProfileDefaults(user) {
  const name = user.displayName || `参加者${user.uid.slice(0, 4)}`;
  return setDoc(doc(db, 'users', user.uid), {
    displayName: name,
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function renderProfile() {
  const user = state.user;
  els.displayNameInput.value = user?.displayName || '';
  els.balanceText.textContent = formatCoins(user?.balance);
  els.roleText.textContent = state.isAdmin ? '管理者' : '一般';
  els.adminPanel.classList.toggle('hidden', !state.isAdmin);
}

function renderUsers() {
  els.grantUserSelect.innerHTML = '';
  for (const user of state.users) {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = `${user.displayName || user.id} / ${formatCoins(user.balance)}`;
    els.grantUserSelect.append(option);
  }
}

function renderHorseOptions() {
  els.betHorseSelect.innerHTML = '';
  for (const horse of state.horses) {
    const option = document.createElement('option');
    option.value = horse.id;
    option.textContent = horse.name;
    els.betHorseSelect.append(option);
  }
}

function getRaceEntries() {
  const entries = state.race?.entries;
  if (Array.isArray(entries) && entries.length > 0) {
    return entries;
  }
  return state.horses.map((horse) => ({
    horseId: horse.id,
    name: horse.name,
    color: horse.color,
    finishMs: 6000
  }));
}

function renderTrack() {
  els.track.innerHTML = '';
  const entries = getRaceEntries();
  for (const entry of entries) {
    const row = els.horseRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.horseId = entry.horseId;
    row.querySelector('.horseName').textContent = entry.name;
    row.querySelector('.horseIcon').style.backgroundColor = entry.color || '#d1495b';
    els.track.append(row);
  }
  updateRaceAnimation();
}

function raceProgress(entry, elapsedMs) {
  if (!state.race || state.race.status !== 'running') {
    return state.race?.status === 'finished' ? 1 : 0;
  }
  const finishMs = Math.max(entry.finishMs || 6000, 1000);
  const base = Math.min(elapsedMs / finishMs, 1);
  const wobble = Math.sin((elapsedMs / 250) + finishMs) * 0.015;
  return Math.max(0, Math.min(base + wobble, 1));
}

function updateRaceAnimation() {
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
  }

  const tick = () => {
    const entries = getRaceEntries();
    const startedAt = state.race?.startedAt?.toMillis?.() || Date.now();
    const elapsedMs = Date.now() - startedAt;

    for (const entry of entries) {
      const icon = els.track
        .querySelector(`[data-horse-id="${entry.horseId}"] .horseIcon`);
      if (!icon) continue;
      const progress = raceProgress(entry, elapsedMs);
      icon.style.setProperty('--progress', `${progress * 100}%`);
    }

    if (state.race?.status === 'running') {
      state.animationFrame = requestAnimationFrame(tick);
    }
  };

  tick();
}

function renderRace() {
  const statusLabel = {
    ready: '出走準備中',
    running: 'レース中',
    finished: '確定済み'
  };
  els.raceStatus.textContent = statusLabel[state.race?.status] || '未作成';
  renderTrack();
}

function subscribeAfterAuth() {
  onSnapshot(doc(db, 'users', state.uid), (snap) => {
    state.user = snap.exists() ? snap.data() : null;
    renderProfile();
  });

  onSnapshot(doc(db, 'admins', state.uid), (snap) => {
    state.isAdmin = snap.exists();
    renderProfile();
  });

  onSnapshot(query(collection(db, 'users'), orderBy('displayName'), limit(200)), (snap) => {
    state.users = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderUsers();
  });

  onSnapshot(query(collection(db, 'horses'), orderBy('createdAt')), (snap) => {
    state.horses = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((horse) => horse.active !== false);
    renderHorseOptions();
    renderTrack();
  });

  onSnapshot(doc(db, 'races', latestRaceId), (snap) => {
    state.race = snap.exists() ? snap.data() : null;
    renderRace();
  });
}

els.signInButton.addEventListener('click', async () => {
  els.signInButton.disabled = true;
  try {
    await signInAnonymously(auth);
  } finally {
    els.signInButton.disabled = false;
  }
});

els.profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.uid) return;
  await setDoc(doc(db, 'users', state.uid), {
    displayName: els.displayNameInput.value.trim(),
    updatedAt: serverTimestamp()
  }, { merge: true });
});

els.horseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.uid || !state.user) return;
  await addDoc(collection(db, 'horses'), {
    name: els.horseNameInput.value.trim(),
    ownerId: state.uid,
    ownerName: state.user.displayName,
    color: els.horseColorInput.value,
    active: true,
    createdAt: serverTimestamp()
  });
  els.horseNameInput.value = '';
});

els.betForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.uid || !state.user) return;
  const horse = state.horses.find((item) => item.id === els.betHorseSelect.value);
  const amount = Number(els.betAmountInput.value);
  if (!horse || !Number.isFinite(amount) || amount <= 0) return;

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', state.uid);
    const userSnap = await transaction.get(userRef);
    const balance = userSnap.data()?.balance || 0;
    if (balance < amount) {
      throw new Error('所持通貨が足りません');
    }
    const betRef = doc(collection(db, 'races', latestRaceId, 'bets'));
    transaction.update(userRef, {
      balance: balance - amount,
      updatedAt: serverTimestamp()
    });
    transaction.set(betRef, {
      userId: state.uid,
      userName: state.user.displayName,
      horseId: horse.id,
      horseName: horse.name,
      amount,
      settled: false,
      createdAt: serverTimestamp()
    });
  });
});

els.grantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const userId = els.grantUserSelect.value;
  const amount = Number(els.grantAmountInput.value);
  if (!userId || !Number.isFinite(amount) || amount <= 0) return;

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId), {
    balance: increment(amount),
    updatedAt: serverTimestamp()
  });
  batch.set(doc(collection(db, 'transactions')), {
    userId,
    type: 'charge',
    amount,
    note: 'cash desk grant',
    createdBy: state.uid,
    createdAt: serverTimestamp()
  });
  await batch.commit();
});

els.prepareRaceButton.addEventListener('click', async () => {
  const entries = state.horses.map((horse) => ({
    horseId: horse.id,
    name: horse.name,
    color: horse.color,
    finishMs: 5500 + Math.floor(Math.random() * 3500)
  }));
  await setDoc(doc(db, 'races', latestRaceId), {
    status: 'ready',
    entries,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
});

els.startRaceButton.addEventListener('click', async () => {
  await updateDoc(doc(db, 'races', latestRaceId), {
    status: 'running',
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  window.setTimeout(async () => {
    const raceRef = doc(db, 'races', latestRaceId);
    const snap = await getDoc(raceRef);
    if (!snap.exists() || snap.data().status !== 'running') return;
    const entries = [...(snap.data().entries || [])]
      .sort((a, b) => a.finishMs - b.finishMs)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    await updateDoc(raceRef, {
      status: 'finished',
      entries,
      winnerHorseId: entries[0]?.horseId || null,
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, 9500);
});

els.settleRaceButton.addEventListener('click', async () => {
  const raceSnap = await getDoc(doc(db, 'races', latestRaceId));
  const winnerHorseId = raceSnap.data()?.winnerHorseId;
  if (!winnerHorseId) return;

  const bets = await getDocs(collection(db, 'races', latestRaceId, 'bets'));
  const batch = writeBatch(db);
  bets.docs.forEach((betDoc) => {
    const bet = betDoc.data();
    if (bet.settled) return;
    if (bet.horseId === winnerHorseId) {
      const payout = bet.amount * 2;
      batch.update(doc(db, 'users', bet.userId), {
        balance: increment(payout),
        updatedAt: serverTimestamp()
      });
      batch.set(doc(collection(db, 'transactions')), {
        userId: bet.userId,
        type: 'payout',
        amount: payout,
        note: `race ${latestRaceId}`,
        createdBy: state.uid,
        createdAt: serverTimestamp()
      });
    }
    batch.update(betDoc.ref, { settled: true });
  });
  await batch.commit();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setStatus('入場してください');
    els.signInButton.hidden = false;
    return;
  }
  state.uid = user.uid;
  els.signInButton.hidden = true;
  setStatus(`接続中: ${user.uid}`);
  await ensureProfileDefaults(user);
  subscribeAfterAuth();
});
