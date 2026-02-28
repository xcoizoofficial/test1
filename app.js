import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


/* ========= CONFIG ========= */

const firebaseConfig = {
  apiKey: "AIzaSyC5fq53GAQJcsHAEkjEcFhGmv7o-K_jTrU",
  authDomain: "xcoizo.firebaseapp.com",
  projectId: "xcoizo"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* ========= ELEMENTS ========= */

const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const messagesDiv = document.getElementById("messages");
const channelsDiv = document.getElementById("channels");

/* ========= STATE ========= */

let mode = "channel"; // channel | dm
let currentChannel = "general";
let currentDM = null;
let unsubscribe = null;
let currentUser = null;

/* ========= UX ========= */

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement !== input) {
    e.preventDefault();
    input.focus();
  }
});

/* ========= AUTH ========= */

onAuthStateChanged(auth, async user => {
  if (!user) {
    signInWithPopup(auth, provider);
    return;
  }

  currentUser = user;
  await ensureUserProfile();
  loadChannels();
  loadDMs();
  openChannel("general");
});

/* ========= USERS ========= */

async function ensureUserProfile() {
  const ref = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      name: currentUser.displayName,
      photo: currentUser.photoURL,
      email: currentUser.email,
      createdAt: serverTimestamp()
    });
  }
}

/* ========= SIDEBAR ========= */

async function loadChannels() {
  const snap = await getDocs(collection(db, "channels"));
  channelsDiv.innerHTML = "<b>CHANNELS</b>";

  snap.forEach(docu => {
    const div = document.createElement("div");
    div.className = "channel";
    div.textContent = "# " + docu.data().name;
    div.onclick = () => openChannel(docu.id);
    channelsDiv.appendChild(div);
  });
}

async function loadDMs() {
  const q = query(
    collection(db, "dmRooms"),
    where("members", "array-contains", currentUser.uid)
  );

  const snap = await getDocs(q);

  const title = document.createElement("div");
  title.innerHTML = "<br><b>DIRECT MESSAGES</b>";
  channelsDiv.appendChild(title);

  for (const room of snap.docs) {
    const members = room.data().members;
    const otherUid = members.find(u => u !== currentUser.uid);
    const userSnap = await getDoc(doc(db, "users", otherUid));

    if (!userSnap.exists()) continue;

    const user = userSnap.data();

    const div = document.createElement("div");
    div.className = "dm";
    div.innerHTML = `<img src="${user.photo}"> ${user.name}`;
    div.onclick = () => openDM(room.id);
    channelsDiv.appendChild(div);
  }
}

/* ========= OPEN ========= */

function openChannel(id) {
  mode = "channel";
  currentChannel = id;
  currentDM = null;
  listen();
}

function openDM(id) {
  mode = "dm";
  currentDM = id;
  listen();
}

/* ========= LISTENER ========= */

function listen() {
  if (unsubscribe) unsubscribe();

  messagesDiv.innerHTML = "";

  let q;

  if (mode === "channel") {
    q = query(
      collection(db, "messages", "channels", currentChannel),
      orderBy("createdAt")
    );
  } else {
    q = query(
      collection(db, "messages", "dm", currentDM),
      orderBy("createdAt")
    );
  }

  unsubscribe = onSnapshot(q, async snap => {
    messagesDiv.innerHTML = "";

    for (const docu of snap.docs) {
      const msg = docu.data();
      const userSnap = await getDoc(doc(db, "users", msg.uid));
      const user = userSnap.data();

      const div = document.createElement("div");
      div.className = "message";
      div.innerHTML = `
        <img src="${user.photo}">
        <div class="bubble">
          <b>${user.name}</b><br>
          ${msg.text}
        </div>
      `;

      messagesDiv.appendChild(div);
    }

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* ========= SEND ========= */

sendBtn.onclick = async () => {
  if (!input.value.trim()) return;

  const path =
    mode === "channel"
      ? collection(db, "messages", "channels", currentChannel)
      : collection(db, "messages", "dm", currentDM);

  await addDoc(path, {
    text: input.value,
    uid: currentUser.uid,
    createdAt: serverTimestamp()
  });

  input.value = "";
};
