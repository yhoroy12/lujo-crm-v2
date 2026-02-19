/* =====================================================
   CHAT CLIENTE - VERSÃO CORRIGIDA
===================================================== */

const service = window.AtendimentoServiceIntegrado;
const stateMachine = window.StateMachineManager;

const screens = {
  welcome: document.getElementById("screenWelcome"),
  conta: document.getElementById("screenIdentificarConta"),
  pessoa: document.getElementById("screenIdentificarPessoa"),
  fila: document.getElementById("screenFila"),
  chat: document.getElementById("screenChat"),
  finalizado: document.getElementById("screenFinalizado")
};

const headerStatus = document.getElementById("headerStatus");
const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const btnSend = document.getElementById("btnSend");
const loadingOverlay = document.getElementById("loadingOverlay");

let clienteState = {
  atendimentoId: null,
  status: null,
  uid: null,
  operador: null,
  timerInterval: null,
  segundosEspera: 0,
  segundosAtendimento: 0,
  listeners: { status: null, mensagens: null },
  reconexoes: 0,
  maxReconexoes: 5
};

/* =====================================================
   MONITORAMENTO DE POSIÇÃO NA FILA (Cloud Function)
===================================================== */

let _unsubscribePosicaoFila = null;

function iniciarMonitoramentoPosicaoFila(atendimentoId) {
  if (_unsubscribePosicaoFila) {
    _unsubscribePosicaoFila();
    _unsubscribePosicaoFila = null;
  }

  const db = window.FirebaseApp.db;
  const { doc, onSnapshot } = window.FirebaseApp.fStore;

  // Escuta o próprio documento do cliente
  // A Cloud Function atualiza posicao_fila sempre que a fila muda
  _unsubscribePosicaoFila = onSnapshot(
    doc(db, 'atend_chat_fila', atendimentoId),
    (docSnap) => {
      if (!docSnap.exists()) return;

      const dados = docSnap.data();
      const posicao = dados.posicao_fila || 1;

      const posicaoEl = document.getElementById('posicaoFila');
      const tempoEstEl = document.getElementById('tempoEstimado');
      const badgeEl = document.getElementById('badgeClasse');

      // Badge de classe
      if (badgeEl && dados.classe_cliente && dados.classe_cliente !== 'PADRAO') {
        const badges = {
          DIAMANTE: { emoji: '💎', label: 'Cliente Diamante', cor: '#60A5FA' },
          OURO: { emoji: '🥇', label: 'Cliente Ouro', cor: '#F59E0B' },
          PRATA: { emoji: '🥈', label: 'Cliente Prata', cor: '#9CA3AF' }
        };
        const badge = badges[dados.classe_cliente];
        if (badge) {
          badgeEl.textContent = `${badge.emoji} ${badge.label}`;
          badgeEl.style.color = badge.cor;
          badgeEl.style.display = 'block';
        }
      }

      // Exibe apenas a posição do cliente, sem revelar total
      if (posicaoEl) {
        posicaoEl.textContent = posicao === 1
          ? 'Você é o próximo!'
          : `${posicao}º na fila`;
      }

      const minutosEstimados = Math.max(1, (posicao - 1) * 3);
      if (tempoEstEl) {
        tempoEstEl.textContent = posicao === 1 ? 'Em breve!' : `~${minutosEstimados} min`;
      }
    },
    (error) => {
      console.error('❌ Erro no listener de posição:', error);
    }
  );

  console.log('👂 Monitorando posição individual na fila');
}

function pararMonitoramentoPosicaoFila() {
  if (_unsubscribePosicaoFila) {
    _unsubscribePosicaoFila();
    _unsubscribePosicaoFila = null;
  }
}

/* =====================================================
   SISTEMA DE INATIVIDADE (5 MINUTOS)
===================================================== */

const INATIVIDADE_MS = 5 * 60 * 1000;
let _inatividadeTimer = null;
let _inatividadeAviso = null;

function resetarTimerInatividade() {
  if (_inatividadeTimer) clearTimeout(_inatividadeTimer);
  if (_inatividadeAviso) clearTimeout(_inatividadeAviso);

  if (clienteState.status !== 'EM_ATENDIMENTO' && clienteState.status !== 'NOVO') return;

  _inatividadeAviso = setTimeout(() => {
    _exibirAvisoInatividade();
  }, INATIVIDADE_MS - 60 * 1000);

  _inatividadeTimer = setTimeout(async () => {
    await _encerrarPorInatividade();
  }, INATIVIDADE_MS);
}

function pararTimerInatividade() {
  if (_inatividadeTimer) { clearTimeout(_inatividadeTimer); _inatividadeTimer = null; }
  if (_inatividadeAviso) { clearTimeout(_inatividadeAviso); _inatividadeAviso = null; }
  const aviso = document.getElementById('avisoInatividade');
  if (aviso) aviso.remove();
}

function _exibirAvisoInatividade() {
  if (!screens.chat?.classList.contains('active')) return;
  if (document.getElementById('avisoInatividade')) return;

  const aviso = document.createElement('div');
  aviso.id = 'avisoInatividade';
  aviso.style.cssText = `
    position: sticky; bottom: 0; left: 0; right: 0;
    background: #f59e0b; color: #1f2937;
    padding: 10px 16px; font-size: 13px; font-weight: 600;
    text-align: center; z-index: 100; animation: fadeIn 0.3s ease;
  `;
  aviso.innerHTML = `
    ⚠️ Sem atividade detectada. O atendimento será encerrado em <strong>1 minuto</strong> por inatividade.
    <button onclick="resetarTimerInatividade();this.parentElement.remove();"
      style="margin-left:12px;padding:4px 10px;background:#1f2937;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">
      Continuar
    </button>
  `;

  const inputArea = document.getElementById('messageInputContainer');
  if (inputArea) {
    inputArea.parentNode.insertBefore(aviso, inputArea);
  } else {
    screens.chat.appendChild(aviso);
  }
}

async function _encerrarPorInatividade() {
  if (!clienteState.atendimentoId) return;
  if (!screens.chat?.classList.contains('active')) return;

  console.warn('⏰ Encerrando por inatividade (5 min)');
  pararTimerInatividade();

  const protocolo = clienteState.atendimentoId;

  try {
    const db = window.FirebaseApp.db;
    const { doc, updateDoc, serverTimestamp, arrayUnion } = window.FirebaseApp.fStore;
    const Timestamp = window.FirebaseApp.fStore.Timestamp;
    const timestampAgora = Timestamp.now();


    await addDoc(collection(db, "atend_chat_fila", protocolo, "mensagem"), {
      autor: 'sistema',
      texto: `⏰ Atendimento encerrado por inatividade. Protocolo: ${protocolo}`,
      timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, "atend_chat_fila", protocolo), {

      status: 'CONCLUIDO',
      finalizadoPor: 'sistema_inatividade',
      finalizadoEm: serverTimestamp(),
      motivo_encerramento: 'inatividade_cliente',
      timeline: arrayUnion({
        descricao: "Atendimento encerrado automaticamente por inatividade do cliente",
        evento: "finalizacao_automatica",
        timestamp: timestampAgora,
        usuario: "sistema"
      })
    });

    _exibirProtocolo(protocolo, 'inatividade');

  } catch (error) {
    console.error('❌ Erro ao encerrar por inatividade:', error);
    _exibirProtocolo(protocolo, 'inatividade');
    mostrarTela(screens.finalizado);
  }
}

/* =====================================================
   EXIBIÇÃO DO PROTOCOLO
===================================================== */

function _exibirProtocolo(protocolo, motivo = 'conclusao') {
  const container = document.querySelector('.completed-container');
  if (!container) return;

  const anterior = document.getElementById('blocoProtocolo');
  if (anterior) anterior.remove();

  const mensagens = {
    conclusao: 'Seu atendimento foi concluído. Guarde o protocolo abaixo para consultas futuras.',
    encaminhado: 'Seu atendimento foi transferido para outro setor. Guarde o protocolo para acompanhar.',
    inatividade: 'Seu atendimento foi encerrado por inatividade. Guarde o protocolo para reabrir se necessário.'
  };

  const bloco = document.createElement('div');
  bloco.id = 'blocoProtocolo';
  bloco.style.cssText = `
    background: #f0fdf4; border: 2px solid #22c55e;
    border-radius: 12px; padding: 16px 20px; margin: 16px 0; text-align: center;
  `;
  bloco.innerHTML = `
    <p style="font-size:13px;color:#374151;margin-bottom:8px;">
      ${mensagens[motivo] || mensagens.conclusao}
    </p>
    <p style="font-size:11px;color:#6b7280;margin-bottom:6px;">Número do Protocolo</p>
    <div style="background:#fff;border:1px dashed #22c55e;border-radius:8px;padding:10px 16px;
      display:flex;align-items:center;justify-content:center;gap:10px;">
      <span id="textoProtocolo" style="font-family:monospace;font-size:14px;font-weight:700;
        color:#166534;letter-spacing:1px;">${protocolo}</span>
      <button onclick="
        navigator.clipboard.writeText('${protocolo}');
        this.textContent='✅';
        setTimeout(()=>this.textContent='📋',1500);
      " style="background:none;border:none;cursor:pointer;font-size:16px;padding:2px;"
        title="Copiar protocolo">📋</button>
    </div>
  `;

  const btnNovo = document.getElementById('btnNovoAtendimento');
  if (btnNovo) {
    container.insertBefore(bloco, btnNovo);
  } else {
    container.appendChild(bloco);
  }
}

/* =====================================================
   PERSISTÊNCIA DE SESSÃO
===================================================== */

function salvarEstadoSessao() {
  const estado = {
    atendimentoId: clienteState.atendimentoId,
    uid: clienteState.uid,
    status: clienteState.status,
    timestamp: Date.now()
  };
  sessionStorage.setItem('clienteAtendimento', JSON.stringify(estado));
  console.log('💾 Estado salvo na sessão:', estado);
}

function carregarEstadoSessao() {
  try {
    const estado = sessionStorage.getItem('clienteAtendimento');
    if (estado) {
      const parsed = JSON.parse(estado);
      const tempoDecorrido = Date.now() - parsed.timestamp;
      const EXPIRACAO = 30 * 60 * 1000;

      if (tempoDecorrido < EXPIRACAO) {
        clienteState.atendimentoId = parsed.atendimentoId;
        clienteState.uid = parsed.uid;
        clienteState.status = parsed.status;
        return parsed;
      } else {
        console.log('⌛ Sessão expirada, limpando...');
        limparSessao();
      }
    }
  } catch (error) {
    console.error('❌ Erro ao carregar sessão:', error);
  }
  return null;
}

function limparSessao() {
  pararTimerInatividade();
  pararMonitoramentoPosicaoFila();
  clienteState = {
    atendimentoId: null,
    status: null,
    uid: null,
    classeCliente: null,
    operador: null,
    timerInterval: null,
    segundosEspera: 0,
    segundosAtendimento: 0,
    listeners: { status: null, mensagens: null },
    reconexoes: 0,
    maxReconexoes: 5
  };
  sessionStorage.removeItem('clienteAtendimento');
  localStorage.removeItem('clienteAtendimentoBackup');
  sessionStorage.removeItem('atendimentoId');
  console.log('🧹 Sessão limpa');
}

/* =====================================================
   NORMALIZAÇÃO DE ESTADOS
===================================================== */

function normalizarStatus(status) {
  if (!status) return 'FILA';

  const mapa = {
    'novo': 'NOVO',
    'fila': 'FILA',
    'identidade_validada': 'IDENTIDADE_VALIDADA',
    'em_atendimento': 'EM_ATENDIMENTO',
    'concluido': 'CONCLUIDO',
    'encaminhado': 'ENCAMINHADO',
    'cancelado': 'CANCELADO'
  };

  const statusLower = status.toLowerCase();
  const normalizado = mapa[statusLower];
  if (normalizado) return normalizado;
  if (status === status.toUpperCase()) return status;
  return status.toUpperCase();
}

/* =====================================================
   GERENCIADOR DE LISTENERS
===================================================== */

class ClienteListenerManager {
  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;
  }

  iniciarMonitoramento(atendimentoId) {
    this.pararMonitoramento();
    this.iniciarListenerStatus(atendimentoId);
    this.iniciarListenerMensagens(atendimentoId);
  }

  iniciarListenerStatus(atendimentoId) {
    if (clienteState.listeners.status) {
      clienteState.listeners.status();
    }

    const docRef = this.fStore.doc(this.db, "atend_chat_fila", atendimentoId);

    clienteState.listeners.status = this.fStore.onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          console.error('❌ Atendimento não encontrado:', atendimentoId);
          this.tratarAtendimentoNaoEncontrado();
          return;
        }

        const dados = docSnap.data();
        const statusNormalizado = normalizarStatus(dados.status);

        console.log('📊 Status atualizado:', {
          antigo: clienteState.status,
          novo: statusNormalizado
        });

        clienteState.status = statusNormalizado;
        clienteState.operador = dados.operador;

        // Capturar classe quando a Cloud Function classificar
        if (dados.classe_cliente) {
          clienteState.classeCliente = dados.classe_cliente;
        }

        this.processarStatus(statusNormalizado, dados);
      },
      (error) => {
        console.error('❌ Erro no listener de status:', error);
        this.tratarErroListener(error, 'status');
      }
    );

    console.log('👂 Listener de status iniciado para:', atendimentoId);
  }

  iniciarListenerMensagens(atendimentoId) {
    if (clienteState.listeners.mensagens) {
      clienteState.listeners.mensagens();
    }

    const mensagensRef = this.fStore.collection(
      this.db, "atend_chat_fila", atendimentoId, "mensagem"
    );

    const q = this.fStore.query(
      mensagensRef,
      this.fStore.orderBy("timestamp", "asc")
    );

    clienteState.listeners.mensagens = this.fStore.onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            this.renderizarMensagem(change.doc.data());
          }
        });
      },
      (error) => {
        console.error('❌ Erro no listener de mensagens:', error);
        this.tratarErroListener(error, 'mensagens');
      }
    );

    console.log('👂 Listener de mensagens iniciado para:', atendimentoId);
  }

  // ✅ CORRIGIDO: switch com todos os casos corretos
  processarStatus(status, dados) {
    switch (status) {

      case 'FILA':
        // Atualiza badge de classe quando a Cloud Function classificar
        if (dados.classe_cliente && dados.classe_cliente !== 'PADRAO') {
          const badges = {
            DIAMANTE: { emoji: '💎', label: 'Cliente Diamante', cor: '#60A5FA' },
            OURO: { emoji: '🥇', label: 'Cliente Ouro', cor: '#F59E0B' },
            PRATA: { emoji: '🥈', label: 'Cliente Prata', cor: '#9CA3AF' }
          };
          const badge = badges[dados.classe_cliente];
          const badgeEl = document.getElementById('badgeClasse');
          if (badgeEl && badge) {
            badgeEl.textContent = `${badge.emoji} ${badge.label}`;
            badgeEl.style.color = badge.cor;
            badgeEl.style.display = 'block';
          }
        }
        break;

      // ✅ NOVO: caso NOVO adicionado — operador aceitou, redireciona para chat
      case 'NOVO':
        this.aoOperadorAceitar(dados);
        break;

      case 'EM_ATENDIMENTO':
        this.aoIniciarAtendimento(dados);
        break;

      case 'ENCAMINHADO':
        this.aoEncaminharAtendimento(dados);
        break;

      case 'CONCLUIDO':
        this.aoConcluirAtendimento(dados);
        break;

      case 'CANCELADO':
        this.aoCancelarAtendimento();
        break;
    }
  }

  aoOperadorAceitar(dados) {
    console.log('✅ Operador aceitou o atendimento');

    // Para o monitoramento de posição na fila
    pararMonitoramentoPosicaoFila();

    if (clienteState.timerInterval) {
      clearInterval(clienteState.timerInterval);
    }

    mostrarTela(screens.chat);

    clienteState.segundosAtendimento = 0;
    clienteState.timerInterval = setInterval(atualizarTimerChat, 1000);

    if (headerStatus) {
      const statusText = headerStatus.querySelector('.status-text');
      const statusDot = headerStatus.querySelector('.status-dot');
      if (statusText) {
        statusText.textContent = `Conversando com ${dados.operador?.nome || "Atendente"}`;
      }
      if (statusDot) statusDot.classList.add('online');
    }

    const operatorInfo = document.getElementById('operatorInfo');
    const operatorName = document.getElementById('operatorName');
    if (operatorInfo && operatorName) {
      operatorInfo.style.display = 'flex';
      operatorName.textContent = dados.operador?.nome || "Atendente";
    }

    resetarTimerInatividade();
    toast("Um atendente aceitou seu chamado!", "success");
  }

  aoIniciarAtendimento(dados) {
    console.log('🚀 Atendimento em andamento');
    resetarTimerInatividade();
  }

  aoEncaminharAtendimento(dados) {
    console.log('🔀 Atendimento encaminhado para outro setor');

    pararTimerInatividade();
    pararMonitoramentoPosicaoFila();

    if (clienteState.timerInterval) {
      clearInterval(clienteState.timerInterval);
      clienteState.timerInterval = null;
    }

    this.pararMonitoramento();
    mostrarTela(screens.finalizado);

    const h2 = screens.finalizado?.querySelector('h2');
    const p = screens.finalizado?.querySelector('p');
    if (h2) h2.textContent = 'Atendimento Transferido';
    if (p) p.textContent = 'Seu chamado foi encaminhado para outro setor. Em breve você será atendido.';

    copiarMensagensParaHistorico();
    _exibirProtocolo(clienteState.atendimentoId, 'encaminhado');
    salvarEstadoSessao();

    toast("Seu atendimento foi transferido para outro setor.", "info");
  }

  aoConcluirAtendimento(dados) {
    console.log('🏁 Atendimento concluído');

    pararTimerInatividade();
    pararMonitoramentoPosicaoFila();

    if (clienteState.timerInterval) {
      clearInterval(clienteState.timerInterval);
      clienteState.timerInterval = null;
    }

    this.pararMonitoramento();
    mostrarTela(screens.finalizado);

    const h2 = screens.finalizado?.querySelector('h2');
    const p = screens.finalizado?.querySelector('p');
    if (h2) h2.textContent = 'Atendimento Finalizado';
    if (p) p.textContent = 'Obrigado por entrar em contato conosco!';

    copiarMensagensParaHistorico();
    _exibirProtocolo(clienteState.atendimentoId, 'conclusao');
    salvarEstadoSessao();
  }

  aoCancelarAtendimento() {
    console.log('❌ Atendimento cancelado');

    pararTimerInatividade();
    pararMonitoramentoPosicaoFila();

    if (clienteState.timerInterval) {
      clearInterval(clienteState.timerInterval);
      clienteState.timerInterval = null;
    }

    this.pararMonitoramento();
    mostrarTela(screens.welcome);
    limparSessao();

    toast("Atendimento cancelado", "info");
  }

  renderizarMensagem(msgData) {
    resetarTimerInatividade();
    if (!messagesContainer) return;

    const msgDiv = document.createElement("div");
    const isCliente = msgData.autor === 'cliente';
    const isSistema = msgData.autor === 'sistema';

    if (isSistema) {
      msgDiv.className = 'message system';
      msgDiv.style.cssText = 'text-align:center;margin:8px 0;';
      msgDiv.innerHTML = `
        <div style="display:inline-block;background:#f3f4f6;color:#6b7280;
          font-size:12px;padding:6px 12px;border-radius:12px;font-style:italic;">
          ${escapeHtml(msgData.texto || '')}
        </div>
      `;
      messagesContainer.appendChild(msgDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    msgDiv.className = `message ${isCliente ? 'user' : 'operator'}`;

    let hora = '--:--';
    try {
      const timestamp = msgData.timestamp;
      if (timestamp && typeof timestamp.toDate === 'function') {
        hora = timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (timestamp?.seconds) {
        hora = new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (timestamp) {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    msgDiv.innerHTML = `
      <div class="message-content">
        <p>${escapeHtml(msgData.texto || '')}</p>
        <span class="time">${hora}</span>
      </div>
    `;

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  tratarErroListener(error, tipo) {
    console.error(`❌ Erro no listener de ${tipo}:`, error);
    clienteState.reconexoes++;

    if (clienteState.reconexoes <= clienteState.maxReconexoes) {
      const delay = Math.min(1000 * Math.pow(2, clienteState.reconexoes), 30000);
      console.log(`🔄 Reconexão ${clienteState.reconexoes}/${clienteState.maxReconexoes} em ${delay}ms`);
      setTimeout(() => {
        if (clienteState.atendimentoId) {
          this.iniciarListenerStatus(clienteState.atendimentoId);
        }
      }, delay);
    } else {
      console.error('❌ Máximo de tentativas atingido');
      toast("Conexão perdida. Por favor, recarregue a página.", "error");
    }
  }

  tratarAtendimentoNaoEncontrado() {
    toast("Atendimento não encontrado. Inicie um novo.", "error");
    limparSessao();
    mostrarTela(screens.welcome);
  }

  pararMonitoramento() {
    if (clienteState.listeners.status) {
      clienteState.listeners.status();
      clienteState.listeners.status = null;
    }
    if (clienteState.listeners.mensagens) {
      clienteState.listeners.mensagens();
      clienteState.listeners.mensagens = null;
    }
    console.log('🛑 Monitoramento parado');
  }
}

const clienteListeners = new ClienteListenerManager();

/* =====================================================
   FUNÇÕES AUXILIARES
===================================================== */

function mostrarTela(tela) {
  if (!tela) return;
  Object.values(screens).forEach(s => s?.classList.remove("active"));
  tela.classList.add("active");
}

function toast(message, type = "success") {
  console.log(`[${type.toUpperCase()}]: ${message}`);
  if (window.NovoClienteNotificacaoManager) {
    window.NovoClienteNotificacaoManager.mostrarToast(message, type);
    return;
  }
  const toastDiv = document.createElement('div');
  toastDiv.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'info' ? '#3b82f6' : '#10b981'};
    color: white; padding: 16px 24px; border-radius: 8px;
    z-index: 10000; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  toastDiv.textContent = message;
  document.body.appendChild(toastDiv);
  setTimeout(() => {
    toastDiv.style.opacity = '0';
    toastDiv.style.transition = 'opacity 0.3s';
    setTimeout(() => toastDiv.remove(), 300);
  }, 3000);
}

// ✅ REMOVIDO: atualizarTimerFila com hardcoded substituído pelo listener da Cloud Function
// Mantida apenas para o timer de tempo decorrido de espera (secundário)
function atualizarTimerFila() {
  clienteState.segundosEspera++;
  // Posição e tempo estimado agora vêm do listener do fila_controle
  // Esta função só mantém o contador interno de segundos se necessário
}

function atualizarTimerChat() {
  clienteState.segundosAtendimento++;
  const mins = Math.floor(clienteState.segundosAtendimento / 60);
  const secs = clienteState.segundosAtendimento % 60;
  const timerElement = document.getElementById("tempoAtendimento");
  if (timerElement) {
    timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function mostrarLoading(mostrar, texto = "Carregando...") {
  if (!loadingOverlay) return;
  if (mostrar) {
    loadingOverlay.classList.remove('hidden');
    const textElement = loadingOverlay.querySelector('#loadingText');
    if (textElement) textElement.textContent = texto;
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

/* =====================================================
   AUTENTICAÇÃO E HISTÓRICO
===================================================== */

async function autenticarClienteAnonimo() {
  try {
    const auth = window.FirebaseApp?.auth;
    if (auth.currentUser) {
      console.log("✅ Cliente já autenticado:", auth.currentUser.uid);
      return auth.currentUser;
    }
    const userCredential = await window.FirebaseApp.fAuth.signInAnonymously(auth);
    console.log("✅ Cliente autenticado anonimamente:", userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error("❌ Erro na autenticação:", error);
    throw error;
  }
}

async function copiarMensagensParaHistorico() {
  const messagesReadonly = document.getElementById('messagesReadonly');
  if (!messagesReadonly) return;

  const atendimentoId = clienteState.atendimentoId || sessionStorage.getItem('atendimentoId');
  if (!atendimentoId) {
    if (messagesContainer?.innerHTML) messagesReadonly.innerHTML = messagesContainer.innerHTML;
    return;
  }

  try {
    const db = window.FirebaseApp.db;
    const { collection, query, orderBy, getDocs } = window.FirebaseApp.fStore;

    const snapshot = await getDocs(query(
      collection(db, "atend_chat_fila", atendimentoId, "mensagem"),
      orderBy("timestamp", "asc")
    ));

    messagesReadonly.innerHTML = '';

    snapshot.forEach((doc) => {
      const msg = doc.data();
      const isCliente = msg.autor === 'cliente';
      const isSistema = msg.autor === 'sistema';

      let hora = '--:--';
      if (msg.timestamp?.toDate) {
        hora = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      const msgDiv = document.createElement('div');

      if (isSistema) {
        msgDiv.className = 'message system';
        msgDiv.style.cssText = 'text-align:center;margin:8px 0;';
        msgDiv.innerHTML = `
          <div style="display:inline-block;background:#f3f4f6;color:#6b7280;
            font-size:12px;padding:6px 12px;border-radius:12px;font-style:italic;">
            ${escapeHtml(msg.texto)}
          </div>
        `;
      } else {
        msgDiv.className = `message ${isCliente ? 'user' : 'operator'}`;
        msgDiv.innerHTML = `
          <div class="message-content">
            <p>${escapeHtml(msg.texto)}</p>
            <span class="time">${hora}</span>
          </div>
        `;
      }

      messagesReadonly.appendChild(msgDiv);
    });

    console.log(`✅ Histórico carregado (${snapshot.size} mensagens)`);
  } catch (error) {
    console.error("❌ Erro ao carregar histórico:", error);
    if (messagesContainer?.innerHTML) messagesReadonly.innerHTML = messagesContainer.innerHTML;
  }
}

/* =====================================================
   FLUXO DE ATENDIMENTO
===================================================== */

async function iniciarNovoAtendimento(dados) {
  try {
    mostrarLoading(true, "Iniciando atendimento...");

    const user = await autenticarClienteAnonimo();
    dados.uid_cliente = user.uid;
    clienteState.uid = user.uid;

    const atendimentoId = await service.clienteIniciarAtendimento(dados);

    clienteState.atendimentoId = atendimentoId;
    clienteState.status = 'FILA';
    clienteState.segundosEspera = 0;

    clienteListeners.iniciarMonitoramento(atendimentoId);

    // ✅ Listener da Cloud Function — substitui o timer hardcoded
    iniciarMonitoramentoPosicaoFila(atendimentoId);

    salvarEstadoSessao();
    mostrarTela(screens.fila);
    toast("Você entrou na fila de espera", "success");

  } catch (error) {
    console.error('❌ Erro ao iniciar atendimento:', error);
    toast("Falha ao iniciar atendimento. Tente novamente.", "error");
    mostrarTela(screens.welcome);
  } finally {
    mostrarLoading(false);
  }
}

/* =====================================================
   ENVIO DE MENSAGENS
===================================================== */

async function enviarMensagem() {
  const texto = messageInput?.value.trim();
  if (!texto || !clienteState.atendimentoId) return;

  try {
    const textoBackup = texto;
    messageInput.value = '';
    resetarTimerInatividade();

    const db = window.FirebaseApp.db;
    const fStore = window.FirebaseApp.fStore;
    const auth = window.FirebaseApp.auth;

    await fStore.addDoc(
      fStore.collection(db, "atend_chat_fila", clienteState.atendimentoId, "mensagem"),
      {
        autor: "cliente",
        texto: textoBackup,
        timestamp: fStore.serverTimestamp(),
        uid_autor: auth.currentUser?.uid || clienteState.uid
      }
    );

    console.log('✅ Mensagem enviada pelo cliente');
    messageInput.focus();

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    toast("Erro ao enviar mensagem", "error");
    if (messageInput) messageInput.value = texto;
  }
}

/* =====================================================
   RESTAURAÇÃO DE SESSÃO
===================================================== */

async function restaurarSessao() {
  console.log('🔍 Verificando sessão existente...');

  const estado = carregarEstadoSessao();
  
  if (estado && (estado.status === 'CONCLUIDO' || estado.status === 'ENCAMINHADO')) {
    console.log('ℹ️ Atendimento anterior já foi finalizado. Iniciando nova sessão.');
    limparSessao();
    return;
  }
  if (!estado || !estado.atendimentoId) {
    console.log('ℹ️ Nenhuma sessão ativa encontrada');
    return;
  }

  console.log('🔄 Restaurando sessão:', estado);

  try {
    mostrarLoading(true, "Restaurando atendimento...");
    await autenticarClienteAnonimo();

    const db = window.FirebaseApp.db;
    const fStore = window.FirebaseApp.fStore;
    const docSnap = await fStore.getDoc(fStore.doc(db, "atend_chat_fila", estado.atendimentoId));

    if (!docSnap.exists()) {
      console.warn('⚠️ Atendimento não encontrado no Firestore');
      limparSessao();
      return;
    }

    const dados = docSnap.data();
    const status = normalizarStatus(dados.status);

    clienteState.atendimentoId = estado.atendimentoId;
    clienteState.status = status;
    clienteState.uid = estado.uid;
    clienteState.operador = dados.operador;
    clienteState.classeCliente = dados.classe_cliente || null;

    if (status === 'FILA') {
      mostrarTela(screens.fila);
      clienteListeners.iniciarMonitoramento(estado.atendimentoId);
      iniciarMonitoramentoPosicaoFila(estado.atendimentoId); // ✅ restaura listener de posição
    } else if (status === 'NOVO' || status === 'EM_ATENDIMENTO') {
      mostrarTela(screens.chat);
      clienteListeners.iniciarMonitoramento(estado.atendimentoId);
      clienteListeners.aoOperadorAceitar(dados);
    } else if (status === 'CONCLUIDO') {
      mostrarTela(screens.finalizado);
      copiarMensagensParaHistorico();
      _exibirProtocolo(estado.atendimentoId, 'conclusao');
    } else if (status === 'ENCAMINHADO') {
      mostrarTela(screens.finalizado);
      const h2 = screens.finalizado?.querySelector('h2');
      const p = screens.finalizado?.querySelector('p');
      if (h2) h2.textContent = 'Atendimento Transferido';
      if (p) p.textContent = 'Seu chamado foi encaminhado para outro setor.';
      copiarMensagensParaHistorico();
      _exibirProtocolo(estado.atendimentoId, 'encaminhado');
    } else {
      mostrarTela(screens.welcome);
    }

    console.log('✅ Sessão restaurada com sucesso');

  } catch (error) {
    console.error('❌ Erro ao restaurar sessão:', error);
    limparSessao();
    mostrarTela(screens.welcome);
  } finally {
    mostrarLoading(false);
  }
}

/* =====================================================
   EVENT LISTENERS
===================================================== */

const btnIniciar = document.getElementById("btnIniciarAtendimento");
if (btnIniciar) btnIniciar.onclick = () => mostrarTela(screens.conta);

const btnVoltarWelcome = document.getElementById('btnVoltarWelcome');
if (btnVoltarWelcome) btnVoltarWelcome.onclick = () => mostrarTela(screens.welcome);

const btnVoltarConta = document.getElementById('btnVoltarConta');
if (btnVoltarConta) btnVoltarConta.onclick = () => mostrarTela(screens.conta);

const formConta = document.getElementById('formIdentificarConta');
if (formConta) formConta.onsubmit = (e) => { e.preventDefault(); mostrarTela(screens.pessoa); };

const formPessoa = document.getElementById('formIdentificarPessoa');
if (formPessoa) {
  formPessoa.onsubmit = async (e) => {
    e.preventDefault();
    await iniciarNovoAtendimento({
      nome: document.getElementById('nomeCompleto').value.trim(),
      telefone: document.getElementById('telefone').value.trim(),
      email: document.getElementById('emailConta').value.trim()
    });
  };
}

if (btnSend) btnSend.onclick = enviarMensagem;

if (messageInput) {
  messageInput.onkeypress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };
}

const btnCancelarFila = document.getElementById('btnCancelarFila');
if (btnCancelarFila) {
  btnCancelarFila.onclick = async () => {
    if (!confirm('Deseja realmente sair da fila de atendimento?')) return;
    try {
      if (!clienteState.atendimentoId) return;
      const db = window.FirebaseApp.db;
      const { doc, updateDoc, serverTimestamp, arrayUnion } = window.FirebaseApp.fStore;
      const Timestamp = window.FirebaseApp.fStore.Timestamp;
      const timestampAgora = Timestamp.now();

      await updateDoc(doc(db, "atend_chat_fila", clienteState.atendimentoId), {
        status: "CANCELADO",
        canceladoEm: serverTimestamp(),
        canceladoPor: "cliente",
        timeline: arrayUnion({
          descricao: "O cliente desistiu da espera e saiu da fila.",
          evento: "cancelado_pelo_cliente",
          timestamp: timestampAgora,
          usuario: "cliente"
        })
      });
      toast("Você saiu da fila", "info");
    } catch (error) {
      console.error("❌ Erro ao cancelar:", error);
      toast("Erro ao cancelar atendimento", "error");
    }
  };
}

let notaSelecionada = 0;
const stars = document.querySelectorAll(".star");
stars.forEach((star, index) => {
  star.addEventListener("click", () => {
    notaSelecionada = index + 1;
    stars.forEach((s, i) => s.classList.toggle("selected", i <= index));
  });
});

const btnEnviarAvaliacao = document.getElementById('btnEnviarAvaliacao');
if (btnEnviarAvaliacao) {
  btnEnviarAvaliacao.onclick = async () => {
    if (notaSelecionada === 0) {
      toast("Por favor, selecione uma nota", "warning");
      return;
    }
    const comentario = document.getElementById("comentarioAvaliacao")?.value || "";
    try {
      if (!clienteState.atendimentoId) return;
      const db = window.FirebaseApp.db;
      const { doc, updateDoc, serverTimestamp } = window.FirebaseApp.fStore;
      await updateDoc(doc(db, "atend_chat_fila", clienteState.atendimentoId), {
        avaliacao: notaSelecionada,
        comentarioAvaliacao: comentario,
        avaliadoEm: serverTimestamp()
      });
      toast("Obrigado pela sua avaliação!", "success");
      const ratingContainer = document.getElementById('ratingContainer');
      if (ratingContainer) ratingContainer.style.display = 'none';
    } catch (error) {
      console.error("❌ Erro ao salvar avaliação:", error);
      toast("Erro ao enviar avaliação", "error");
    }
  };
}

const btnNovoAtendimento = document.getElementById("btnNovoAtendimento");
if (btnNovoAtendimento) {
  btnNovoAtendimento.onclick = () => {
    limparSessao();
    location.reload();
  };
}

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Chat Cliente inicializando...');

  await restaurarSessao();

  window.addEventListener('beforeunload', () => {
    pararTimerInatividade();
    pararMonitoramentoPosicaoFila();
    clienteListeners.pararMonitoramento();
    if (clienteState.timerInterval) clearInterval(clienteState.timerInterval);
  });

  const auth = window.FirebaseApp?.auth;
  if (auth) {
    auth.onAuthStateChanged(user => {
      if (user) {
        console.log("🧑‍💻 UID:", user.uid);
        console.log("🔐 Tipo:", user.isAnonymous ? "ANÔNIMO" : "REGISTRADO");
      }
    });
  }

  console.log('✅ Chat Cliente pronto!');
});