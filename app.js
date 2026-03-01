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

const rankPage = document.getElementById("rankPage");
const votePage = document.getElementById("votePage");
const adminStatus = document.getElementById("adminStatus");
const pinnedSection = document.getElementById("pinnedSection");
const normalSection = document.getElementById("normalSection");

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
  const deviceId=getDeviceId();

  const voteRef1=db.collection("daily_votes").doc(`${today}_${deviceId}_1`);
  const voteRef2=db.collection("daily_votes").doc(`${today}_${deviceId}_2`);

  const [doc1,doc2]=await Promise.all([voteRef1.get(),voteRef2.get()]);

  let targetRef;
  if(!doc1.exists){
    targetRef=voteRef1;
  }else if(!doc2.exists){
    targetRef=voteRef2;
  }else{
    alert("今天已投完 2 票");
    return;
  }

  const ref=db.collection("votes").doc(ticker);

  await db.runTransaction(async tx=>{
    const doc=await tx.get(ref);
    if(!doc.exists){
      tx.set(ref,{count:1,pinned:false});
    }else{
      tx.update(ref,{count:doc.data().count+1});
    }
    tx.set(targetRef,{ticker,timestamp:Date.now()});
  });
}

function voteInput(){
  const val=document.getElementById("tickerInput").value.trim();
  if(!val)return;
  voteTicker(val);
  document.getElementById("tickerInput").value="";
}

function renderCard(doc,isPinned,rankIndex){

  const data=doc.data();
  const card=document.createElement("div");
  card.className="card";

  if(isPinned){
    card.classList.add("pinned-card");
  }

  card.onclick=()=>voteTicker(doc.id);

  const left=document.createElement("div");
  left.innerHTML=`<span class="medal">${rankIndex<3?["🥇","🥈","🥉"][rankIndex]:""}</span>
                  <span class="ticker">${doc.id}</span>`;

  const right=document.createElement("div");

  const count=document.createElement("span");
  count.className="count";
  count.innerText=data.count;

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

    const pin=document.createElement("button");
    pin.innerText="📌";
    pin.className="admin-pin";
    if(data.pinned) pin.classList.add("active");

    pin.onclick=e=>{
      e.stopPropagation();
      togglePin(doc.id,data.pinned===true);
    };

    right.appendChild(pin);
  }

  card.appendChild(left);
  card.appendChild(right);

  return card;
}

function loadRank(){

  db.collection("votes")
    .orderBy("pinned","desc")
    .orderBy("count","desc")
    .onSnapshot(snapshot=>{

      pinnedSection.innerHTML="";
      normalSection.innerHTML="";

      const pinnedDocs=[];
      const normalDocs=[];

      snapshot.docs.forEach(doc=>{
        if(doc.data().pinned){
          pinnedDocs.push(doc);
        }else{
          normalDocs.push(doc);
        }
      });

      if(pinnedDocs.length>0){
        const title=document.createElement("div");
        title.className="section-title";
        title.innerText="置頂股票";
        pinnedSection.appendChild(title);

        pinnedDocs.forEach((doc,i)=>{
          pinnedSection.appendChild(renderCard(doc,true,i));
        });
      }

      if(normalDocs.length>0){
        const title=document.createElement("div");
        title.className="section-title";
        title.innerText="股票排行榜";
        normalSection.appendChild(title);

        normalDocs.forEach((doc,i)=>{
          normalSection.appendChild(renderCard(doc,false,i));
        });
      }

    });
}

async function deleteTicker(t){
  if(!confirm("確定刪除 "+t+" ?"))return;
  await db.collection("votes").doc(t).delete();
}

async function togglePin(ticker,current){
  await db.collection("votes").doc(ticker).update({
    pinned:!current
  });
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

auth.onAuthStateChanged(async user=>{
  if(user){
    isAdminUser=await checkAdmin(user.uid);
    adminStatus.innerText=isAdminUser?"管理者模式":"一般使用者";
  }else{
    isAdminUser=false;
    adminStatus.innerText="";
  }
  loadRank();
});