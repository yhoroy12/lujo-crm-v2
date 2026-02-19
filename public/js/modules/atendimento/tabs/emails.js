/**
 * EMAILS.JS - SISTEMA DE ATENDIMENTO E TRIAGEM (VERSÃO PROTEGIDA)
 * Foco: Performance Blaze, Prevenção de Race Condition e Reutilização Global
 * 
 * ✅ MELHORIAS IMPLEMENTADAS:
 * - Proteção contra re-inicialização (_initialized)
 * - Controle de listener de fila (pausar/retomar)
 * - Timer continua em background
 * - Funções globais preparadas para remoção futura
 * - Listeners via ModuleLifecycle
 */

import {
  collection, query, where, orderBy, limit, onSnapshot,
  doc, runTransaction, serverTimestamp, getDoc, addDoc, deleteDoc, updateDoc, getDocs, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const EmailsTab = {
  id: 'aba-emails',
  moduleId: 'atendimento',
  
  // ✅ NOVO: Controle de estado
  _initialized: false,
  
  // Estado de atendimento
  currentEmailId: null,
  emailTimerInterval: null,
  tempoAtualSegundos: 0,
  
  // ✅ NOVO: Referência do listener de fila
  unsubscribeFila: null,

  async init() {
    // ✅ PROTEÇÃO CONTRA RE-INICIALIZAÇÃO
    if (this._initialized) {
      console.warn('⚠️ EmailsTab já inicializado. Abortando duplicata.');
      return;
    }

    console.log('📧 Inicializando aba E-mails (Global Mode)');
    
    try {
      this.cacheElements();
      this.setupFilaListener();
      this.bindEvents();
      this.verificarAtendimentoEmAberto();
      
      // Torna o objeto acessível globalmente para os onclicks do HTML
      window.EmailsTab = this;

      // ✅ MARCAR COMO INICIALIZADO
      this._initialized = true;
      console.log('✅ EmailsTab inicializado com sucesso');

    } catch (error) {
      console.error('❌ Erro ao inicializar EmailsTab:', error);
      // ✅ RESET EM CASO DE ERRO
      this._initialized = false;
    }
  },

  cacheElements() {
    this.elements = {
      btnChamarProximo: document.getElementById('btnChamarProximo'),
      filaCont: document.getElementById('emailFilaLista'),
      countBadge: document.getElementById('emailFilaCount'),
      palcoVazio: document.getElementById('palco-vazio'),
      palcoAtivo: document.getElementById('palco-ativo'),
      resposta: document.getElementById('resposta-email'),
      btnEnviar: document.getElementById('btnEnviarResposta'),
      timerAtendimento: document.getElementById('timer-atendimento'),
      
      displayAssunto: document.getElementById('ativo-assunto'),
      displayRemetente: document.getElementById('ativo-cliente-email'),
      displayNomeCliente: document.getElementById('ativo-cliente-nome'),
      displayCorpo: document.getElementById('ativo-mensagem-conteudo')
    };
  },

  /**
   * ✅ MODIFICADO: Listener em tempo real da fila lateral
   * Agora salva referência para poder pausar/retomar
   */
  setupFilaListener() {
    // ✅ Se já existe listener, não criar duplicado
    if (this.unsubscribeFila) {
      console.log('ℹ️ Listener de fila já ativo');
      return;
    }

    console.log('🔊 Ativando listener de fila de emails');

    const q = query(
      collection(window.FirebaseApp.db, "atend_emails_fila"),
      where("status", "==", "novo"),
      where("grupo", "==", "triagem"),
      orderBy("metadata_recebido_em", "asc"),
      limit(20)
    );

    // ✅ SALVAR REFERÊNCIA PARA CLEANUP
    this.unsubscribeFila = onSnapshot(q, (snapshot) => {
      if (this.elements.countBadge) this.elements.countBadge.textContent = snapshot.size;
      this.renderListaLateral(snapshot);
    });
  },

  /**
   * ✅ NOVO: Para listener de fila (economiza Firebase)
   */
  pausarFilaListener() {
    if (this.unsubscribeFila) {
      console.log('⏸️ Pausando listener de fila de emails');
      this.unsubscribeFila();
      this.unsubscribeFila = null;
    }
  },

  renderListaLateral(snapshot) {
    if (!this.elements.filaCont) return;
    this.elements.filaCont.innerHTML = '';

    snapshot.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'email-fila-item';
      item.innerHTML = `
        <div class="info">
          <strong>${Utils.escapeHtml(data.remetente_nome || 'Desconhecido')}</strong>
          <span>${Utils.escapeHtml(data.assunto || '')}</span>
        </div>
      `;
      this.elements.filaCont.appendChild(item);
    });
  },

  async verificarAtendimentoEmAberto() {
    const user = window.FirebaseApp.auth.currentUser;
    const db = window.FirebaseApp.db;
    
    if (!user) {
      console.log("⏳ Auth ainda não carregou, tentando novamente em 1s...");
      setTimeout(() => this.verificarAtendimentoEmAberto(), 1000);
      return;
    }

    console.log("🔍 Buscando atendimento para o UID:", user.uid);

    try {
      const q = query(
        collection(db, "atend_emails_fila"),
        where("status", "==", "em_atendimento"),
        where("atribuido_para_uid", "==", user.uid),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        console.log("📌 Recuperando atendimento em aberto:", docSnap.id);
        
        this.currentEmailId = docSnap.id;
        const dados = docSnap.data();
        
        this.carregarDadosNoPalco(dados);
      }
    } catch (error) {
      console.error("Erro ao recuperar atendimento:", error);
    }
  },

  async chamarProximoAtendimento() {
    console.log('🔍 Buscando próximo e-mail...');
    const user = JSON.parse(sessionStorage.getItem('currentUser'));

    const q = query(
      collection(window.FirebaseApp.db, "atend_emails_fila"),
      where("status", "==", "novo"),
      where("grupo", "==", "triagem"),
      orderBy("metadata_recebido_em", "asc"),
      limit(1)
    );

    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        alert("Não há e-mails novos na fila de triagem.");
        return;
      }

      const emailDocRef = querySnapshot.docs[0].ref;

      await runTransaction(window.FirebaseApp.db, async (transaction) => {
        const sfDoc = await transaction.get(emailDocRef);
        if (sfDoc.data().status !== "novo") {
          throw "Este e-mail já foi pego por outro operador!";
        }

        transaction.update(emailDocRef, {
          status: "em_atendimento",
          atribuido_para_uid: user.uid,
          puxado_em: serverTimestamp(),
          "tracking_marcos.triagem_inicio": serverTimestamp()
        });
      });

      this.currentEmailId = emailDocRef.id;
      this.carregarDadosNoPalco(querySnapshot.docs[0].data());

    } catch (error) {
      console.error("Erro na transação:", error);
      if (typeof error === 'string') alert(error);
    }
  },

  carregarDadosNoPalco(data) {
    this.cacheElements();

    if (this.elements.palcoVazio) this.elements.palcoVazio.style.display = 'none';
    if (this.elements.palcoAtivo) this.elements.palcoAtivo.style.display = 'flex';

    if (this.elements.displayAssunto) 
      this.elements.displayAssunto.textContent = data.assunto || "Sem Assunto";
    
    if (this.elements.displayRemetente) 
      this.elements.displayRemetente.textContent = data.remetente_email || "E-mail não informado";
    
    if (this.elements.displayNomeCliente)
      this.elements.displayNomeCliente.textContent = data.remetente_nome || "Nome não informado";

    if (this.elements.displayCorpo) {
      // ATENÇÃO: corpo_html pode conter HTML legítimo de e-mails externos.
      // Use DOMPurify para sanitizar antes de injetar: https://github.com/cure53/DOMPurify
      // Exemplo: this.elements.displayCorpo.innerHTML = DOMPurify.sanitize(data.corpo_html || data.corpo || "Sem conteúdo");
      this.elements.displayCorpo.innerHTML = data.corpo_html || data.corpo || "Sem conteúdo";
    }

    this.iniciarCronometro();
  },

  async direcionarEmail(setorDestino) {
    if (!this.currentEmailId) return;
    const user = JSON.parse(sessionStorage.getItem('currentUser'));

    try {
      const docRef = doc(window.FirebaseApp.db, "atend_emails_fila", this.currentEmailId);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();

      const novoHistorico = data.historico_custodia || [];
      novoHistorico.push({
        acao: "direcionamento",
        detalhes: `Triagem: Direcionado para ${setorDestino}`,
        operador: user.name,
        timestamp: new Date()
      });

      await updateDoc(docRef, {
        grupo: setorDestino.toLowerCase(),
        status: "novo",
        atribuido_para_uid: null,
        historico_custodia: novoHistorico,
        "tracking_marcos.triagem_fim": serverTimestamp()
      });

      alert(`E-mail enviado para o setor: ${setorDestino}`);
      this.resetarPalco();
    } catch (error) {
      console.error("Erro ao direcionar:", error);
    }
  },

  abrirModalDevolucao() {
    const modal = document.getElementById('modalJustificativaDevolucao');
    const txt = document.getElementById('justificativaDevolucaoTexto');
    if (modal) {
      if (txt) txt.value = '';
      modal.style.display = 'flex';
    }
  },

  fecharModalDevolucao() {
    const modal = document.getElementById('modalJustificativaDevolucao');
    if (modal) modal.style.display = 'none';
  },

  async confirmarDevolucao() {
    const txtArea = document.getElementById('justificativaDevolucaoTexto');
    const justificativa = txtArea?.value.trim() || "";

    if (justificativa.length < 10) {
      alert("Por favor, insira uma justificativa com pelo menos 10 caracteres.");
      return;
    }

    if (!this.currentEmailId) return;

    try {
      console.log('🔄 Devolvendo e-mail com justificativa...');

      const docRef = doc(window.FirebaseApp.db, "atend_emails_fila", this.currentEmailId);
      const user = JSON.parse(sessionStorage.getItem('currentUser'));

      await updateDoc(docRef, {
        status: "novo",
        atribuido_para_uid: null,
        "tracking_marcos.devolvido_em": serverTimestamp(),
        ultima_justificativa: justificativa,
        historico_custodia: arrayUnion({
          acao: "devolucao",
          detalhes: `Devolvido para fila. Motivo: ${justificativa}`,
          operador: user?.name || "Sistema",
          timestamp: new Date()
        })
      });

      alert("E-mail devolvido com sucesso.");
      this.fecharModalDevolucao();
      this.resetarPalco();

    } catch (error) {
      console.error("Erro ao devolver:", error);
      alert("Erro ao processar devolução.");
    }
  },

  async devolverParaFila() {
    if (!this.currentEmailId) return;

    try {
      const docRef = doc(window.FirebaseApp.db, "atend_emails_fila", this.currentEmailId);
      await updateDoc(docRef, {
        status: "novo",
        atribuido_para_uid: null,
        "tracking_marcos.devolvido_em": serverTimestamp()
      });

      alert("E-mail devolvido para a fila.");
      this.resetarPalco();
    } catch (error) {
      console.error("Erro ao devolver:", error);
    }
  },

  validarResposta() {
    const resposta = this.elements.resposta?.value.trim() || "";
    const btn = this.elements.btnEnviar;

    if (resposta.length >= 15) {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
      btn.classList.add('ativo');
    } else {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    }
  },

  async finalizarAtendimento() {
    const resposta = this.elements.resposta?.value.trim();
    if (!resposta || !this.currentEmailId) {
      alert("Escreva uma resposta antes de enviar.");
      return;
    }

    try {
      console.log("📤 Finalizando atendimento...");
      const db = window.FirebaseApp.db;
      const docRef = doc(db, "atend_emails_fila", this.currentEmailId);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();

      await addDoc(collection(db, "atend_emails_historico"), {
        ...data,
        status: "concluido",
        resposta_final: resposta,
        finalizado_em: serverTimestamp(),
        duracao_atendimento: this.tempoAtualSegundos
      });

      await deleteDoc(docRef);

      alert("Atendimento finalizado com sucesso!");
      this.resetarPalco();
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      alert("Erro ao finalizar atendimento. Verifique o console.");
    }
  },

  /**
   * ✅ MODIFICADO: Timer continua em background
   */
  iniciarCronometro() {
    this.tempoAtualSegundos = 0;
    
    // ✅ Limpar timer anterior se existir
    if (this.emailTimerInterval) {
      clearInterval(this.emailTimerInterval);
    }

    this.emailTimerInterval = setInterval(() => {
      this.tempoAtualSegundos++;
      const m = Math.floor(this.tempoAtualSegundos / 60).toString().padStart(2, '0');
      const s = (this.tempoAtualSegundos % 60).toString().padStart(2, '0');
      
      // ✅ Só atualiza display se o elemento existir (pode estar em outra aba)
      if (this.elements.timerAtendimento) {
        this.elements.timerAtendimento.textContent = `${m}:${s}`;
      }
    }, 1000);

    console.log('⏱️ Timer de email iniciado (continuará em background)');
  },

  resetarPalco() {
    this.currentEmailId = null;
    
    // ✅ Parar timer
    if (this.emailTimerInterval) {
      clearInterval(this.emailTimerInterval);
      this.emailTimerInterval = null;
    }

    if (this.elements.palcoAtivo) this.elements.palcoAtivo.style.display = 'none';
    if (this.elements.palcoVazio) this.elements.palcoVazio.style.display = 'flex';
    if (this.elements.resposta) this.elements.resposta.value = '';
  },

  /**
   * ✅ MODIFICADO: Listeners via ModuleLifecycle
   */
  bindEvents() {
    if (this.elements.btnChamarProximo) {
      window.ModuleLifecycle.addListener(
        this.elements.btnChamarProximo,
        'click',
        () => this.chamarProximoAtendimento(),
        this.moduleId
      );
    }

    if (this.elements.btnEnviar) {
      window.ModuleLifecycle.addListener(
        this.elements.btnEnviar,
        'click',
        () => this.finalizarAtendimento(),
        this.moduleId
      );
    }

    // ✅ FUNÇÕES GLOBAIS (preparadas para remoção futura)
    // TODO: Quando migrar para módulos genéricos, mover para eventos locais
    window.validarResposta = () => this.validarResposta();
    window.confirmarDevolucao = () => EmailsTab.confirmarDevolucao();
    window.fecharModalDevolucao = () => EmailsTab.fecharModalDevolucao();
  },

  /**
   * ✅ NOVO: Método de refresh (chamado ao retornar para a aba)
   */
  async refresh() {
    console.log('🔄 Reativando EmailsTab...');

    try {
      // ✅ REATIVAR LISTENER DE FILA
      this.setupFilaListener();

      // Verificar se há atendimento em aberto
      if (this.currentEmailId) {
        console.log('ℹ️ Atendimento ativo mantido:', this.currentEmailId);
        // Timer já está rodando em background
      } else {
        await this.verificarAtendimentoEmAberto();
      }

      console.log('✅ EmailsTab reativado');
    } catch (error) {
      console.error('❌ Erro ao reativar EmailsTab:', error);
    }
  },

  /**
   * ✅ NOVO: Método de cleanup (chamado ao sair da aba)
   */
  cleanup() {
    console.log('🧹 Limpando EmailsTab...');

    try {
      // ✅ PAUSAR LISTENER DE FILA (economizar Firebase)
      this.pausarFilaListener();

      // ✅ IMPORTANTE: NÃO parar timer (continua em background)
      console.log('ℹ️ Timer mantido ativo (atendimento continua)');

      // ✅ NÃO resetar _initialized (tab continua carregada)
      console.log('✅ EmailsTab limpo (pronto para reuso)');

    } catch (error) {
      console.warn('⚠️ Erro no cleanup de EmailsTab:', error);
    }
  },

  /**
   * ✅ NOVO: Cleanup completo (apenas quando sair do módulo inteiro)
   */
  destroy() {
    console.log('🗑️ Destruindo EmailsTab completamente...');

    // Limpar TUDO
    this.pausarFilaListener();
    
    if (this.emailTimerInterval) {
      clearInterval(this.emailTimerInterval);
      this.emailTimerInterval = null;
    }

    // ✅ REMOVER FUNÇÕES GLOBAIS
    delete window.validarResposta;
    delete window.confirmarDevolucao;
    delete window.fecharModalDevolucao;

    this._initialized = false;
    console.log('✅ EmailsTab destruído');
  }
};

export default EmailsTab;