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
const pinnedSection = document.getElementById("pinnedSection");
const normalSection = document.getElementById("normalSection");
// 這裡新增獲取按鈕列容器
const adminControlPanel = document.getElementById("adminControlPanel"); 

/* --- 新增：網址參數檢查邏輯 --- */
const urlParams = new URLSearchParams(window.location.search);
// 判斷網址是否包含 ?admin=true
const isManagementMode = urlParams.get('admin') === 'true';

// 如果不是管理模式，隱藏按鈕列
if (isManagementMode && adminControlPanel) {
    adminControlPanel.style.display = "block";
} else if (adminControlPanel) {
    adminControlPanel.style.display = "none";
}
/* --------------------------- */

// ... (中間 tab 切換、getDeviceId、voteTicker、renderCard 等函數保持不變) ...

/* ---------------- Admin ---------------- */

async function deleteTicker(t){
  if(!confirm("確定刪除 "+t+" ?")) return;
  await db.collection("votes").doc(t).delete();
}

async function togglePin(ticker,current){
  await db.collection("votes").doc(ticker).update({
    pinned: !current
  });
}

function login(){
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
}

function logout(){
  auth.signOut();
}

async function checkAdmin(uid){
  const doc = await db.collection("admins").doc(uid).get();
  return doc.exists;
}

auth.onAuthStateChanged(async user=>{
  if(user){
    isAdminUser = await checkAdmin(user.uid);
    // 只有在管理員模式下才顯示狀態文字
    adminStatus.innerText = isAdminUser ? "管理者模式" : "一般使用者";
  }else{
    isAdminUser = false;
    adminStatus.innerText = "";
  }
  loadRank();
});