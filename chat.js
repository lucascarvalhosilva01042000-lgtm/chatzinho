alert("🟢 chat.js começou a executar");

// 🌍 VARIÁVEIS GLOBAIS
let chatArea = null;
let chatInput = null;
let salaAtualId = null;
let ultimoRemetente = null;
let conectandoDiv = null;
let unsubscribeSala = null;
let cameraStream = null;
let fotoCapturada = null;



// ⏳ DOM
document.addEventListener("DOMContentLoaded", () => {

  console.log("🟡 DOM pronto");

  chatArea = document.getElementById("chat-area");
  chatInput = document.getElementById("chat-input");

  // ===== TAGS =====
  const tagsDiv = document.getElementById("tags");
  if (tagsDiv) {
    const modo = localStorage.getItem("modo");
    const eu = localStorage.getItem("eu");
    const desejo = localStorage.getItem("desejo");

    function criarTag(texto) {
      const span = document.createElement("span");
      span.className = "chat-tag";
      span.innerText = texto;
      tagsDiv.appendChild(span);
    }

    if (modo === "+18") {
      criarTag("+18");
      if (eu) criarTag("Eu sou " + eu);
      if (desejo) criarTag("Conversar com " + desejo);
    } else {
      criarTag("Chat Casual");
    }
  }

  // 🔥 presença
  if (window.db) {
    window.db.collection("presenca").add({
      entrouEm: new Date(),
      status: "online"
    }).catch(() => {});
  }

  // 🔥 entra na fila
  entrarNaFila();
});

// ===== TOPO / MENU =====
function voltarInicio() {
  window.location.href = "index.html";
}
function abrirMenu() {
  document.getElementById("menuChat").style.display = "flex";
}
function fecharMenu() {
  document.getElementById("menuChat").style.display = "none";
}

// ===== CHAT =====
function adicionarMensagem(texto, tipo) {
  if (!chatArea) return;

  const mesmo = ultimoRemetente === tipo;
  ultimoRemetente = tipo;

  const wrapper = document.createElement("div");

  if (tipo === "estranho" && !mesmo) {
    const nome = document.createElement("div");
    nome.innerText = "Estranho";
    nome.style.fontSize = "12px";
    nome.style.color = "#777";
    nome.style.marginBottom = "2px";
    nome.style.marginLeft = "6px";
    wrapper.appendChild(nome);
  }

  const msg = document.createElement("div");
  msg.style.maxWidth = "72%";
  msg.style.padding = "10px 14px";
  msg.style.borderRadius = "18px";
  msg.style.fontSize = "14px";
  msg.style.wordWrap = "break-word";

  if (tipo === "eu") {
    msg.style.background = "#1f3c88";
    msg.style.color = "#fff";
    msg.style.marginLeft = "auto";
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = "flex-end";
  } else {
    msg.style.background = "#e0e0e0";
    msg.style.color = "#000";
  }

  msg.innerText = texto;
  // horário
const hora = document.createElement("div");
const agora = new Date();
hora.innerText =
  agora.getHours().toString().padStart(2, "0") + ":" +
  agora.getMinutes().toString().padStart(2, "0");

hora.style.fontSize = "11px";
hora.style.opacity = "0.6";
hora.style.marginTop = "6px";
hora.style.textAlign = tipo === "eu" ? "right" : "left";

msg.appendChild(hora);
  wrapper.appendChild(msg);
  chatArea.appendChild(wrapper);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function adicionarMensagemSistema(texto) {
  if (!chatArea) return;
  const msg = document.createElement("div");
  msg.innerText = texto;
  msg.style.fontSize = "13px";
  msg.style.color = "#777";
  msg.style.textAlign = "center";
  msg.style.margin = "12px 0";
  msg.style.fontStyle = "italic";
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ===== ENVIAR =====
async function enviarMensagem() {
  if (!chatInput || !window.db || !salaAtualId) return;

  const texto = chatInput.value.trim();
  if (!texto) return;

  adicionarMensagem(texto, "eu");
  chatInput.value = "";

  try {
    await window.db
      .collection("salas")
      .doc(salaAtualId)
      .collection("mensagens")
      .add({
        texto,
        autor: "usuario",
        criadoEm: new Date()
      });
  } catch {}
}

// ===== FILA =====
async function entrarNaFila() {
  if (!window.db) return;

  const salasRef = window.db.collection("salas");

  const snap = await salasRef
    .where("status", "==", "aguardando")
    .limit(1)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    salaAtualId = doc.id;
    await salasRef.doc(salaAtualId).update({ status: "conectado" });
    adicionarMensagemSistema("Usuário encontrado! Conectando… 💬");
    escutarSala(salaAtualId);
    escutarMensagens();
  } else {
    const nova = await salasRef.add({
      status: "aguardando",
      criadoEm: new Date()
    });
    salaAtualId = nova.id;
    adicionarMensagemSistema("Aguardando outro usuário… ⏳");
    escutarSala(salaAtualId);
    escutarMensagens();
  }
}

// ===== ESCUTAS =====
function escutarSala(id) {
  unsubscribeSala = window.db
    .collection("salas")
    .doc(id)
    .onSnapshot(doc => {
      if (!doc.exists) return;
      if (doc.data().status === "encerrado") pularConversa();
    });
}

function escutarMensagens() {
  if (!window.db || !salaAtualId) return;

  window.db
    .collection("salas")
    .doc(salaAtualId)
    .collection("mensagens")
    .orderBy("criadoEm")
    .onSnapshot(snap => {
      snap.docChanges().forEach(c => {
        const msg = c.doc.data();
        if (msg.autor !== "usuario") {
          adicionarMensagem(msg.texto, "estranho");
        }
      });
    });
}

// ===== ENCERRAR =====
function pularConversa() {
  if (unsubscribeSala) unsubscribeSala();
  document.getElementById("chat-area").style.display = "none";
  document.getElementById("chat-barra").style.display = "none";
  document.getElementById("conversa-encerrada").style.display = "block";
}

function novaConversa() {
  location.reload();
}


async function abrirCamera() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-preview");

  if (!modal || !video) return;

  modal.style.display = "flex";

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    video.srcObject = cameraStream;
    video.play();

  } catch (e) {
    console.error(e);
    alert("Não foi possível acessar a câmera 😕");
    fecharCamera();
  }
}

function fecharCamera() {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-preview");

  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }

  if (video) video.srcObject = null;
  if (modal) modal.style.display = "none";
}

function tirarFoto() {
  const video = document.getElementById("camera-preview");
  const canvas = document.getElementById("camera-canvas");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = document.createElement("img");
  img.src = canvas.toDataURL("image/jpeg");
  img.style.maxWidth = "70%";
  img.style.borderRadius = "12px";

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.justifyContent = "flex-end";
  wrapper.appendChild(img);

  chatArea.appendChild(wrapper);
  chatArea.scrollTop = chatArea.scrollHeight;

  fecharCamera();
}