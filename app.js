// Firebase 配置 (與你的專案對應)
const firebaseConfig = {
  apiKey: "AIzaSyArRnMFZoLEjghu1WOHvkoVpss67KKAs2M",
  authDomain: "vote-742d9.firebaseapp.com",
  projectId: "vote-742d9",
  storageBucket: "vote-742d9.firebasestorage.app",
  messagingSenderId: "265605858274",
  appId: "1:265605858274:web:dda344ef0d7176cfe56fbb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let isAdminUser = false;

// DOM 元素
const rankPage = document.getElementById("rankPage");
const votePage = document.getElementById("votePage");
const adminStatus = document.getElementById("adminStatus");
const adminControlPanel = document.getElementById("adminControlPanel");

// --- 介面控制邏輯 ---

// 檢查網址參數：如果是 ?admin=true 才開啟管理功能
const urlParams = new URLSearchParams(window.location.search);
const isManagementMode = urlParams.get('admin') === 'true';

if (isManagementMode && adminControlPanel) {
  adminControlPanel.style.display = "block"; // 顯示管理按鈕
}

document.getElementById("tabRank").onclick = () => {
  rankPage.classList.remove("hidden");
  votePage.classList.add("hidden");
  setActive(0);
};

document.getElementById("tabVote").onclick = () => {
  votePage.classList.remove("hidden");
  rankPage.classList.add("hidden");
  setActive(1);
};

function setActive(i) {
  document.querySelectorAll(".tab").forEach((t, idx) => {
    t.classList.toggle("active", idx === i);
  });
}

// --- 投票核心邏輯 (裝置 ID + 一天 2 票) ---

function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

async function voteTicker(ticker) {
  ticker = ticker.toUpperCase();
  const today = new Date().toISOString().slice(0, 10);
  const deviceId = getDeviceId();

  // 檢查第 1 票與第 2 票的槽位
  const voteRef1 = db.collection("daily_votes").doc(`${today}_${deviceId}_1`);
  const voteRef2 = db.collection("daily_votes").doc(`${today}_${deviceId}_2`);

  const [doc1, doc2] = await Promise.all([voteRef1.get(), voteRef2.get()]);

  let targetRef;
  let voteSeq = 0;

  if (!doc1.exists) {
    targetRef = voteRef1;
    voteSeq = 1;
  } else if (!doc2.exists) {
    targetRef = voteRef2;
    voteSeq = 2;
  } else {
    alert("今天已投完 2 票囉！");
    return;
  }

  const ref = db.collection("votes").doc(ticker);

  try {
    await db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc.exists) {
        tx.set(ref, { count: 1 });
      } else {
        tx.update(ref, { count: doc.data().count + 1 });
      }
      tx.set(targetRef, { ticker, timestamp: Date.now() });
    });
    alert(`投票成功！這是你今天的第 ${voteSeq} 票。`);
  } catch (e) {
    alert("投票失敗，請檢查網路連線。");
  }
}

function voteInput() {
  const val = document.getElementById("tickerInput").value.trim();
  if (!val) return;
  voteTicker(val);
  document.getElementById("tickerInput").value = ""; 
}

// --- 渲染與管理功能 ---

function renderMedal(i) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "";
}

function loadRank() {
  db.collection("votes").orderBy("count", "desc")
    .onSnapshot(snapshot => {
      rankPage.innerHTML = "";
      snapshot.docs.forEach((doc, i) => {
        const card = document.createElement("div");
        card.className = "card";
        if (i === 0) card.classList.add("top1");
        if (i === 1) card.classList.add("top2");
        if (i === 2) card.classList.add("top3");

        card.onclick = () => voteTicker(doc.id);

        const left = document.createElement("div");
        left.innerHTML = `<span class="medal">${renderMedal(i)}</span>
                          <span class="ticker">${doc.id}</span>`;

        const right = document.createElement("div");
        const count = document.createElement("span");
        count.className = "count";
        count.innerText = doc.data().count;

        count.classList.add("flip");
        setTimeout(() => count.classList.remove("flip"), 300);

        right.appendChild(count);

        // 如果是管理員且登入成功，顯示刪除按鈕
        if (isAdminUser) {
          const del = document.createElement("button");
          del.innerText = "✕";
          del.className = "admin-delete";
          del.onclick = e => {
            e.stopPropagation();
            deleteTicker(doc.id);
          };
          right.appendChild(del);
        }

        card.appendChild(left);
        card.appendChild(right);
        rankPage.appendChild(card);
      });
    });
}

async function deleteTicker(t) {
  if (!confirm("確定要刪除 " + t + " 嗎？")) return;
  await db.collection("votes").doc(t).delete();
}

// --- 身份驗證邏輯 ---

function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
}

function logout() {
  auth.signOut();
}

async function checkAdmin(uid) {
  try {
    const doc = await db.collection("admins").doc(uid).get();
    return doc.exists;
  } catch (e) {
    return false;
  }
}

auth.onAuthStateChanged(async user => {
  if (user) {
    console.log("UID:", user.uid);
    isAdminUser = await checkAdmin(user.uid);
    adminStatus.innerText = isAdminUser ? "管理者模式" : "一般使用者";
  } else {
    isAdminUser = false;
    adminStatus.innerText = "";
  }
  loadRank(); 
});