// Firebase 配置 (與您的專案對應)
const firebaseConfig = {
  apiKey: "AIzaSyArRnMFZoLEjghu1WOHvkoVpss67KKAs2M",
  authDomain: "vote-742d9.firebaseapp.com",
  projectId: "vote-742d9",
  storageBucket: "vote-742d9.firebasestorage.app",
  messagingSenderId: "265605858274",
  appId: "1:265605858274:web:dda344ef0d7176cfe56fbb"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let isAdminUser = false;

// DOM 元素
const rankPage = document.getElementById("rankPage");
const votePage = document.getElementById("votePage");
const adminStatus = document.getElementById("adminStatus");
const pinnedSection = document.getElementById("pinnedSection");
const normalSection = document.getElementById("normalSection");
const adminControlPanel = document.getElementById("adminControlPanel");

// --- 介面控制邏輯 ---

// 檢查網址參數：如果是 ?admin=true 才開啟管理功能
const urlParams = new URLSearchParams(window.location.search);
const isManagementMode = urlParams.get('admin') === 'true';

if (isManagementMode && adminControlPanel) {
  adminControlPanel.style.display = "block";
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

function setActive(i){
  document.querySelectorAll(".tab").forEach((t,idx)=>{
    t.classList.toggle("active",idx===i);
  });
}

function getDeviceId(){
  let id = localStorage.getItem("deviceId");
  if(!id){
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

/* ---------------- 投票核心邏輯 (裝置 ID + 一天 2 票) ---------------- */

async function voteTicker(ticker){
  ticker = ticker.toUpperCase();
  const today = new Date().toISOString().slice(0,10);
  const deviceId = getDeviceId();

  const voteId1 = `${today}_${deviceId}_1`;
  const voteId2 = `${today}_${deviceId}_2`;

  const voteRef1 = db.collection("daily_votes").doc(voteId1);
  const voteRef2 = db.collection("daily_votes").doc(voteId2);

  const [doc1, doc2] = await Promise.all([voteRef1.get(), voteRef2.get()]);

  let targetRef;
  let voteSeq = 0;

  if(!doc1.exists){
    targetRef = voteRef1;
    voteSeq = 1;
  }else if(!doc2.exists){
    targetRef = voteRef2;
    voteSeq = 2;
  }else{
    alert("今天已投完 2 票");
    return;
  }

  const ref = db.collection("votes").doc(ticker);

  try {
    await db.runTransaction(async tx=>{
      const doc = await tx.get(ref);
      if(!doc.exists){
        tx.set(ref, {count: 1, pinned: false});
      }else{
        tx.update(ref, {count: doc.data().count + 1});
      }
      tx.set(targetRef, {ticker, timestamp: Date.now()});
    });
    alert(`投票成功！這是您今天的第 ${voteSeq} 票。`);
  } catch (e) {
    console.error("投票失敗:", e);
    alert("投票失敗，請檢查網路連線。");
  }
}

function voteInput(){
  const val = document.getElementById("tickerInput").value.trim();
  if(!val) return;
  voteTicker(val);
  document.getElementById("tickerInput").value="";
}

/* ---------------- 卡片渲染 ---------------- */

function renderCard(doc, isPinned, rankIndex){
  const data = doc.data();
  const card = document.createElement("div");
  card.className = "card";

  if(isPinned){
    card.classList.add("pinned-card");
  }

  card.onclick = () => voteTicker(doc.id);

  const left = document.createElement("div");
  let medalIcon = "";

  if(isPinned){
    medalIcon = "👑";
  }else if(rankIndex < 3){
    medalIcon = ["🥇","🥈","🥉"][rankIndex];
  }

  left.innerHTML = `
    <span class="medal">${medalIcon}</span>
    <span class="ticker">${doc.id}</span>
  `;

  const right = document.createElement("div");
  const count = document.createElement("span");
  count.className = "count";
  count.innerText = data.count || 0;

  count.classList.add("flip");
  setTimeout(()=>count.classList.remove("flip"),300);

  right.appendChild(count);

  if(isAdminUser){
    const del = document.createElement("button");
    del.innerText = "✕";
    del.className = "admin-delete";
    del.onclick = e=>{
      e.stopPropagation();
      deleteTicker(doc.id);
    };
    right.appendChild(del);

    const pin = document.createElement("button");
    pin.innerText = "📌";
    pin.className = "admin-pin" + (data.pinned ? " active" : "");

    pin.onclick = e=>{
      e.stopPropagation();
      togglePin(doc.id, data.pinned === true);
    };

    right.appendChild(pin);
  }

  card.appendChild(left);
  card.appendChild(right);
  return card;
}

/* ---------------- 排行榜 (置頂優先 + 票數排序) ---------------- */

function loadRank(){
  db.collection("votes")
    .orderBy("pinned","desc")
    .orderBy("count","desc")
    .onSnapshot(snapshot=>{
      try {
        if (!pinnedSection || !normalSection) return;

        pinnedSection.innerHTML = "";
        normalSection.innerHTML = "";

        const pinnedDocs = [];
        const normalDocs = [];

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data && data.pinned === true) {
            pinnedDocs.push(doc);
          } else {
            normalDocs.push(doc);
          }
        });

        if(pinnedDocs.length > 0){
          const title = document.createElement("div");
          title.className = "section-title";
          title.innerText = "置頂股票";
          pinnedSection.appendChild(title);

          pinnedDocs.forEach((doc, i) => {
            pinnedSection.appendChild(renderCard(doc, true, i));
          });
        }

        if(normalDocs.length > 0){
          const title = document.createElement("div");
          title.className = "section-title";
          title.innerText = "股票排行榜";
          normalSection.appendChild(title);

          normalDocs.forEach((doc, i) => {
            normalSection.appendChild(renderCard(doc, false, i));
          });
        }
      } catch (err) {
        console.error("渲染排行榜出錯:", err);
      }
    }, error => {
      console.error("Firestore 監聽失敗:", error);
    });
}

/* ---------------- Admin 管理功能 ---------------- */

async function deleteTicker(t){
  if(!confirm("確定刪除 "+t+" ?")) return;
  try {
    await db.collection("votes").doc(t).delete();
  } catch (err) {
    console.error("刪除失敗:", err);
  }
}

async function togglePin(ticker, current){
  try {
    await db.collection("votes").doc(ticker).update({
      pinned: !current
    });
  } catch (err) {
    console.error("置頂切換失敗:", err);
  }
}

function login(){
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
}

function logout(){
  auth.signOut();
}

async function checkAdmin(uid){
  try {
    const doc = await db.collection("admins").doc(uid).get();
    return doc.exists;
  } catch (e) {
    return false;
  }
}

// 監聽登入狀態並啟動排行榜
auth.onAuthStateChanged(async user => {
  if (user) {
    isAdminUser = await checkAdmin(user.uid);
    adminStatus.innerText = isAdminUser ? "管理者模式" : "一般使用者";
  } else {
    isAdminUser = false;
    adminStatus.innerText = "";
  }
  loadRank(); 
});