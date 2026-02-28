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

let isAdminUser=false;

const rankPage=document.getElementById("rankPage");
const votePage=document.getElementById("votePage");
const adminStatus=document.getElementById("adminStatus");

document.getElementById("tabRank").onclick=()=>{
  rankPage.classList.remove("hidden");
  votePage.classList.add("hidden");
  setActive(0);
};

document.getElementById("tabVote").onclick=()=>{
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
  let id=localStorage.getItem("deviceId");
  if(!id){
    id=crypto.randomUUID();
    localStorage.setItem("deviceId",id);
  }
  return id;
}

async function voteTicker(ticker){
  ticker=ticker.toUpperCase();

  const today=new Date().toISOString().slice(0,10);
  const voteId=today+"_"+getDeviceId();

  const voteRef=db.collection("daily_votes").doc(voteId);

  if((await voteRef.get()).exists){
    alert("今天已投票");
    return;
  }

  const ref=db.collection("votes").doc(ticker);

  await db.runTransaction(async tx=>{
    const doc=await tx.get(ref);
    if(!doc.exists){
      tx.set(ref,{count:1});
    }else{
      tx.update(ref,{count:doc.data().count+1});
    }
    tx.set(voteRef,{ticker,timestamp:Date.now()});
  });
}

function voteInput(){
  const val=document.getElementById("tickerInput").value.trim();
  if(!val)return;
  voteTicker(val);
}

function renderMedal(i){
  if(i===0)return "🥇";
  if(i===1)return "🥈";
  if(i===2)return "🥉";
  return "";
}

function loadRank(){
  db.collection("votes").orderBy("count","desc")
  .onSnapshot(snapshot=>{
    rankPage.innerHTML="";
    snapshot.docs.forEach((doc,i)=>{
      const card=document.createElement("div");
      card.className="card";

      if(i===0)card.classList.add("top1");
      if(i===1)card.classList.add("top2");
      if(i===2)card.classList.add("top3");

      card.onclick=()=>voteTicker(doc.id);

      const left=document.createElement("div");
      left.innerHTML=`<span class="medal">${renderMedal(i)}</span>
                      <span class="ticker">${doc.id}</span>`;

      const right=document.createElement("div");
      const count=document.createElement("span");
      count.className="count";
      count.innerText=doc.data().count;

      count.classList.add("flip");
      setTimeout(()=>count.classList.remove("flip"),300);

      right.appendChild(count);

      if(isAdminUser){
        const del=document.createElement("button");
        del.innerText="✕";
        del.className="admin-delete";
        del.onclick=e=>{
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

async function deleteTicker(t){
  if(!confirm("delete "+t+" ?"))return;
  await db.collection("votes").doc(t).delete();
}

function login(){
  const provider=new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
}

function logout(){
  auth.signOut();
}

async function checkAdmin(uid){
  const doc=await db.collection("admins").doc(uid).get();
  return doc.exists;
}

auth.onAuthStateChanged(async user => {
  if (user) {
    // 等待權限檢查完成
    isAdminUser = await checkAdmin(user.uid);
    adminStatus.innerText = isAdminUser ? "Admin" : "User";
  } else {
    isAdminUser = false;
    adminStatus.innerText = "";
  }
  
  // 確保身份狀態 (isAdminUser) 更新後才載入排行榜
  loadRank(); 
});