// Firebase 配置
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
const adminBar = document.querySelector(".admin-bar");

// --- 介面管理與網址參數偵測 ---
const urlParams = new URLSearchParams(window.location.search);
const isManagementMode = urlParams.get('admin') === 'true';

if (isManagementMode && adminBar) {
  adminBar.classList.remove("hidden");
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

// --- 裝置識別 ID ---
function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

// --- 修改：一天 2 票的核心邏輯 ---
async function voteTicker(ticker) {
  ticker = ticker.toUpperCase();
  const today = new Date().toISOString().slice(0, 10);
  const deviceId = getDeviceId();

  // 定義該裝置今天的兩個投票位置 (Slot 1 & Slot 2)
  const voteId1 = `${today}_${deviceId}_1`;
  const voteId2 = `${today}_${deviceId}_2`;

  const voteRef1 = db.collection("daily_votes").doc(voteId1);
  const voteRef2 = db.collection("daily_votes").doc(voteId2);

  // 同時檢查兩個位置是否已被佔用
  const [doc1, doc2] = await Promise.all([voteRef1.get(), voteRef2.get()]);

  let targetRef;
  let voteSequence = 0;

  if (!doc1.exists) {
    // 尚未投出第 1 票
    targetRef = voteRef1;
    voteSequence = 1;
  } else if (!doc2.exists) {
    // 已投過第 1 票，準備投第 2 票
    targetRef = voteRef2;
    voteSequence = 2;
  } else {
    // 兩張票都已經投過了
    alert("今天已投完 2 票囉！明天歡迎再來許願。");
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
      // 存入對應的序號文檔，符合 Firebase Rules 的 !exists 規則
      tx.set(targetRef, { ticker, timestamp: Date.now() });
    });
    
    alert(`投票成功！這是你今天的第 ${voteSequence} 票。`);
  } catch (error) {
    console.error("投票失敗:", error);
    alert("投票過程發生錯誤，請稍後再試。");
  }
}

function voteInput() {
  const val = document.getElementById("tickerInput").value.trim();
  if (!val) return;
  voteTicker(val);
  document.getElementById("tickerInput").value = "";
}

// --- 渲染排行與管理功能 ---
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

// --- 身份與權限驗證 ---
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.error("Login Error:", err);
    alert("登入失敗，請確認 Firebase 已授權你的網域。");
  });
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
    console.log("當前使用者 UID:", user.uid);
    isAdminUser = await checkAdmin(user.uid);
    adminStatus.innerText = isAdminUser ? "管理者模式" : "一般使用者";
  } else {
    isAdminUser = false;
    adminStatus.innerText = "";
  }
  loadRank();
});