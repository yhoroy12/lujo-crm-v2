/**
 * ABA: ATENDIMENTO WHATSAPP (VERSÃO COMPLETA)
 * Gerencia atendimento via WhatsApp/Telefone
 * 
 * ✅ FUNCIONALIDADES IMPLEMENTADAS:
 * - Proteção contra re-inicialização
 * - Notificação inteligente
 * - Sistema de validação de identidade
 * - Salvamento otimizado (apenas ao concluir)
 * - Campos do formulário de atendimento
 */

const WhatsAppTab = {
  id: 'aba-atendimento',
  moduleId: 'atendimento',
  elements: {},

  // ✅ Controle de estado
  _initialized: false,

  // Listeners Firebase
  unsubscribeChat: null,
  unsubscribeFila: null,

  // ✅ NOVO: Estado local dos campos (não salva até finalizar)
  dadosAtendimento: {
    validacao_identidade: {
      concluida: false,
      campos_verificados: []
    },
    tipo_conta: '',
    tipo_demanda: '',
    setor_responsavel: '',
    descricao_solicitacao: '',
    observacoes_internas: ''
  },

  async init() {
    // ✅ PROTEÇÃO CONTRA RE-INICIALIZAÇÃO
    if (this._initialized) {
      console.warn('⚠️ WhatsAppTab já inicializado. Abortando duplicata.');
      return;
    }

    console.log('📱 Inicializando aba WhatsApp');

    if (this.unsubscribeChat) {
      console.log("🧹 Removendo listener de chat duplicado...");
      this.unsubscribeChat();
      this.unsubscribeChat = null;
    }

    try {
      this.cacheElements();
      this.bindEvents();
      this.registrarListenerFila();

      const stateAtendimento = window.StateManager.get('atendimento') || {};
      const idSalvo = stateAtendimento.currentTicketId || localStorage.getItem('atendimento_ativo_id');

      if (idSalvo && typeof idSalvo === 'string') {
        console.log("🎯 Recuperando atendimento ativo:", idSalvo);
        await this.restaurarVisualAtendimento(idSalvo);
      }

      this._initialized = true;
      console.log('✅ WhatsAppTab inicializado com sucesso');

    } catch (error) {
      console.error('❌ Erro em WhatsApp:', error);
      this._initialized = false;
    }
  },

  cacheElements() {
    this.elements = {
      // Popup e workspace
      popup: document.getElementById('popupAtendimento'),
      workspace: document.getElementById('workspaceGrid'),
      emptyState: document.getElementById('emptyState'),
      // ✅ Popup de Encaminhamento
      popupEncaminhar: document.getElementById('popupEncaminhar'),
      btnFecharEncaminhar: document.getElementById('btnFecharEncaminhar'),
      btnCancelarEncaminhar: document.getElementById('btnCancelarEncaminhar'),
      btnConfirmarEncaminhar: document.getElementById('btnConfirmarEncaminhar'),
      popupSetorDestino: document.getElementById('popupSetorDestino'),
      popupDescricaoSolicitacao: document.getElementById('popupDescricaoSolicitacao'),
      justificativaEncaminhamento: document.getElementById('justificativaEncaminhamento'),
      charCount: document.getElementById('charCount'),

      // Botões principais do chat
      btnAceitar: document.getElementById('btnIniciarAtendimentoPopup'),
      btnEnviar: document.getElementById('btnEnviarMensagem'),
      btnConcluir: document.getElementById('btnConcluir'),

      // Chat
      chatbox: document.getElementById('chatbox'),
      chatInput: document.getElementById('chatInput'),

      // Dados do cliente (coluna 1)
      clienteNome: document.getElementById('clienteNome'),
      clienteTelefone: document.getElementById('clienteTelefone'),
      clienteEmail: document.getElementById('clienteEmail'),
      tipoConta: document.getElementById('tipoConta'),

      // ✅ NOVO: Checkboxes de validação
      checkNome: document.getElementById('checkNome'),
      checkTelefone: document.getElementById('checkTelefone'),
      checkEmail: document.getElementById('checkEmail'),
      btnValidarIdentidade: document.getElementById('btnValidarIdentidade'),
      // ✅ Botões de estado
      btnIniciarAtendimento: document.getElementById('btnIniciarAtendimento'),
      btnConcluir: document.getElementById('btnConcluir'),
      btnEncaminhar: document.getElementById('btnEncaminhar'),

      // ✅ NOVO: Campos do formulário (coluna 3)
      tipoDemanda: document.getElementById('tipoDemanda'),
      setorResponsavel: document.getElementById('setorResponsavel'),
      descricaoSolicitacao: document.getElementById('descricaoSolicitacao'),
      observacoesInternas: document.getElementById('observacoesInternas'),
      // Outros elementos do ticket
      ticketId: document.getElementById('ticketId'),
      stateIndicator: document.getElementById('stateIndicator'),
      statusBadge: document.getElementById('statusBadge'),
      timeline: document.getElementById('timeline')
    };
  },

  bindEvents() {
    // Eventos existentes
    if (this.elements.btnAceitar) {
      window.ModuleLifecycle.addListener(
        this.elements.btnAceitar,
        'click',
        () => this.acceptCall(),
        this.moduleId
      );
    }

    if (this.elements.btnEnviar) {
      window.ModuleLifecycle.addListener(
        this.elements.btnEnviar,
        'click',
        () => this.sendMessage(),
        this.moduleId
      );
    }

    if (this.elements.chatInput) {
      window.ModuleLifecycle.addListener(
        this.elements.chatInput,
        'keypress',
        (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
          }
        },
        this.moduleId
      );
    }

    // ✅ NOVO: Eventos das checkboxes
    [this.elements.checkNome, this.elements.checkTelefone, this.elements.checkEmail].forEach(checkbox => {
      if (checkbox) {
        window.ModuleLifecycle.addListener(
          checkbox,
          'change',
          () => this.verificarCheckboxes(),
          this.moduleId
        );
      }
    });

    // ✅ NOVO: Evento do botão de validar identidade
    if (this.elements.btnValidarIdentidade) {
      window.ModuleLifecycle.addListener(
        this.elements.btnValidarIdentidade,
        'click',
        () => this.confirmarValidacaoIdentidade(),
        this.moduleId
      );
    }

    // ✅ NOVO: Eventos dos campos do formulário (salvar em memória)
    [
      this.elements.tipoDemanda,
      this.elements.setorResponsavel,
      this.elements.descricaoSolicitacao,
      this.elements.observacoesInternas
    ].forEach(field => {
      if (field) {
        window.ModuleLifecycle.addListener(
          field,
          'change',
          () => this.atualizarDadosLocais(),
          this.moduleId
        );
      }
    });

    // ✅ NOVO: Evento para botão "Iniciar Atendimento"
    if (this.elements.btnIniciarAtendimento) {
      window.ModuleLifecycle.addListener(
        this.elements.btnIniciarAtendimento,
        'click',
        () => this.iniciarAtendimento(),
        this.moduleId
      );
    }

    // ✅ NOVO: Evento para botão "Encaminhar"
    if (this.elements.btnEncaminhar) {
      window.ModuleLifecycle.addListener(
        this.elements.btnEncaminhar,
        'click',
        () => this.encaminharAtendimento(),
        this.moduleId
      );
    }
    // ✅ Eventos do popup de encaminhamento
    if (this.elements.btnFecharEncaminhar) {
      window.ModuleLifecycle.addListener(
        this.elements.btnFecharEncaminhar,
        'click',
        () => this.fecharPopupEncaminhar(),
        this.moduleId
      );
    }

    if (this.elements.btnCancelarEncaminhar) {
      window.ModuleLifecycle.addListener(
        this.elements.btnCancelarEncaminhar,
        'click',
        () => this.fecharPopupEncaminhar(),
        this.moduleId
      );
    }

    if (this.elements.btnConfirmarEncaminhar) {
      window.ModuleLifecycle.addListener(
        this.elements.btnConfirmarEncaminhar,
        'click',
        () => this.confirmarEncaminhamento(),
        this.moduleId
      );
    }

    if (this.elements.justificativaEncaminhamento) {
      window.ModuleLifecycle.addListener(
        this.elements.justificativaEncaminhamento,
        'input',
        () => this.atualizarContadorCaracteres(),
        this.moduleId
      );
    }

    // ✅ NOVO: Evento do botão Concluir
    if (this.elements.btnConcluir) {
      window.ModuleLifecycle.addListener(
        this.elements.btnConcluir,
        'click',
        () => this.concluirAtendimento(),
        this.moduleId
      );
    }
    // Outros eventos podem ser adicionados aqui

  },

  registrarListenerFila() {
    // Se o manager ainda não carregou, aguarda até 3 segundos
    if (!window.RealtimeListenersManager) {
      console.warn('⏳ RealtimeListenersManager ainda não disponível, aguardando...');
      let tentativas = 0;
      const intervalo = setInterval(() => {
        tentativas++;
        if (window.RealtimeListenersManager) {
          clearInterval(intervalo);
          console.log('✅ RealtimeListenersManager disponível, registrando listener...');
          this._configurarCallbackFila();
        } else if (tentativas >= 10) {
          clearInterval(intervalo);
          console.error('❌ RealtimeListenersManager não disponível após 3s');
        }
      }, 300);
      return;
    }

    this._configurarCallbackFila();
  },

 
_configurarCallbackFila() {
  window.RealtimeListenersManager.registrarCallback('NovoClienteFila', (dadosCliente) => {
    // VERIFICAR SE PODE NOTIFICAR
    const temAtivo = !!localStorage.getItem('atendimento_ativo_id');
    const posicao = dadosCliente.posicao_fila ?? 1;
    
    // OBTER aba ativa do StateManager (ja e mantida pelo TabManager!)
    const state = window.StateManager.get('atendimento') || {};
    const abaAtiva = state.activeTab || 'aba-atendimento';
    const abasPermitidas = ['atendimento'];
    
    console.log('[FILA] Verificando: temAtivo=' + temAtivo + ', abaAtiva=' + abaAtiva);
    
    // Se OCUPADO, IGNORA tudo
    if (temAtivo) {
      console.log('[FILA] Operador OCUPADO - bloqueado');
      return;
    }
    
    // Se em aba ERRADA, IGNORA
    if (!abasPermitidas.includes(abaAtiva)) {
      console.log('[FILA] Aba nao permitida (' + abaAtiva + ') - bloqueado');
      return;
    }
    
    // Se eh primeiro da fila, guarda como ticket
    if (posicao === 1) {
      this.ticketAtual = dadosCliente;
    }
    
    // SO AGORA notifica (operador esta LIVRE e em aba CORRETA)
    this.notificarNovoAtendimento(dadosCliente);
  });

  window.RealtimeListenersManager.escutarFilaClientes();
  console.log('[FILA] Listener registrado');
},
  /**
   * ✅ NOVO: Verificar se todas as checkboxes estão marcadas
   */
  verificarCheckboxes() {
    const todasMarcadas =
      this.elements.checkNome?.checked &&
      this.elements.checkTelefone?.checked &&
      this.elements.checkEmail?.checked;

    if (this.elements.btnValidarIdentidade) {
      this.elements.btnValidarIdentidade.disabled = !todasMarcadas;

      // Visual feedback
      if (todasMarcadas) {
        this.elements.btnValidarIdentidade.classList.add('btn-ready');
      } else {
        this.elements.btnValidarIdentidade.classList.remove('btn-ready');
      }
    }

    console.log(`✅ Checkboxes: ${todasMarcadas ? 'Todas marcadas' : 'Incompleto'}`);
  },

  /**
   * ✅ NOVO: Confirmar validação de identidade
   * (Salva APENAS a validação no Firebase) + INTEGRAÇÃO COM STATE MACHINE
   */
  async confirmarValidacaoIdentidade() {
    const atendimentoId = localStorage.getItem('atendimento_ativo_id');

    if (!atendimentoId) {
      console.error('❌ Nenhum atendimento ativo');
      alert('Erro: Nenhum atendimento ativo encontrado');
      return;
    }

    try {
      const user = window.AuthSystem.getCurrentUser();

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // ✅ 1. Obter status atual do Firebase
      const db = window.FirebaseApp.db;
      const { doc, getDoc, updateDoc, serverTimestamp, arrayUnion } = window.FirebaseApp.fStore;
      const docRef = doc(db, 'atend_chat_fila', atendimentoId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Atendimento não encontrado no Firebase');
      }

      const ticketData = docSnap.data();

      // ✅ 2. Normalizar estado atual usando State Machine Manager
      const estadoAtual = window.StateMachineManager.normalizarEstado(ticketData.status);
      const estadoAlvo = 'IDENTIDADE_VALIDADA';

      console.group('🔐 VALIDAÇÃO DE IDENTIDADE');
      console.log('Atendimento ID:', atendimentoId);
      console.log('Status no Firebase:', ticketData.status);
      console.log('Estado Normalizado:', estadoAtual);
      console.log('Estado Alvo:', estadoAlvo);
      console.log('User Role:', user.role);

      // ✅ 3. Validar transição usando State Machine
      const validacao = window.StateMachineManager.validarTransicao(
        estadoAtual,
        estadoAlvo,
        user?.role || 'ATENDENTE'
      );

      console.log('Validação:', validacao);
      console.groupEnd();

      if (!validacao.valido) {
        alert(`⚠️ Transição não permitida: ${validacao.erro}`);
        console.error('❌ Validação falhou:', validacao);
        return;
      }

      // ✅ 4. Preparar dados de validação
      const dadosValidacao = {
        concluida: true,
        validado_por: user?.name || 'Operador',
        validado_por_uid: user?.uid,
        validado_em: new Date(),
        campos_verificados: ['nome', 'telefone', 'email']
      };

      // ✅ 5. Executar transição com State Machine (salva status + log de auditoria)
      await window.StateMachineManager.executarTransicao(
        atendimentoId,
        estadoAtual,
        estadoAlvo,
        'Identidade validada pelo operador'
      );

      // ✅ Criar item de timeline
      const agora = () => window.FirebaseApp.fStore.Timestamp.now();
      const timelineItem = {
        evento: "identidade_validada",
        timestamp: agora(),
        usuario: user?.uid || 'desconhecido',
        descricao: `Identidade do cliente validada por ${user?.name || 'Operador'}`
      };
      // ✅ 6. Atualizar campos de validação no documento
      await updateDoc(docRef, {
        validacao_identidade: dadosValidacao,
        'cliente.validadoEm': serverTimestamp(), // ✅ serverTimestamp() pode ser usado aqui (campo direto)
        timeline: arrayUnion(timelineItem) // ✅ Usando objeto já com timestamp
      });

      // ✅ 7. Atualizar estado local
      this.dadosAtendimento.validacao_identidade = dadosValidacao;

      // ✅ 8. Feedback visual - desabilitar checkboxes
      ['checkNome', 'checkTelefone', 'checkEmail'].forEach(checkId => {
        const checkbox = this.elements[checkId];
        if (checkbox) {
          checkbox.checked = true;
          checkbox.disabled = true;
        }
      });

      // ✅ 9. Atualizar botão de validação
      if (this.elements.btnValidarIdentidade) {
        this.elements.btnValidarIdentidade.textContent = '✓ Identidade Confirmada';
        this.elements.btnValidarIdentidade.disabled = true;
        this.elements.btnValidarIdentidade.classList.remove('btn-primary');
        this.elements.btnValidarIdentidade.classList.add('btn-success');
      }

      console.log('✅ Identidade validada com sucesso');
      console.log('📊 Estado após validação:', await window.StateMachineManager.verificarEstado(atendimentoId));

      // Mensagem de sucesso
      if (window.ToastManager) {
        window.ToastManager.show('✅ Identidade do cliente validada!', 'success');
      } else {
        alert('✅ Identidade do cliente validada!');
      }

    } catch (error) {
      console.error('❌ Erro ao validar identidade:', error);

      // Mensagem de erro detalhada
      let mensagemErro = 'Erro ao validar identidade.';

      if (error.message.includes('Transição não permitida')) {
        mensagemErro = `Transição de estado não permitida. ${error.message}`;
      } else if (error.message.includes('não autenticado')) {
        mensagemErro = 'Você precisa estar autenticado para validar identidade.';
      } else {
        mensagemErro = `Erro: ${error.message}`;
      }

      alert(mensagemErro);
      console.error('Stack trace:', error.stack);
    }
  },
  /**
 * ✅ NOVO: Atualizar visibilidade dos botões baseado no estado
 */
  atualizarBotoesPorEstado(status) {
    // Ocultar todos os botões primeiro
    if (this.elements.btnIniciarAtendimento) {
      this.elements.btnIniciarAtendimento.classList.add('hidden');
    }
    if (this.elements.btnConcluir) {
      this.elements.btnConcluir.classList.add('hidden');
    }
    if (this.elements.btnEncaminhar) {
      this.elements.btnEncaminhar.classList.add('hidden');
    }

    // Normalizar status para garantir comparação
    const statusNormalizado = (status || '').toUpperCase();

    // Mostrar botões conforme estado
    switch (statusNormalizado) {
      case 'IDENTIDADE_VALIDADA':
        if (this.elements.btnIniciarAtendimento) {
          this.elements.btnIniciarAtendimento.classList.remove('hidden');
        }
        break;

      case 'EM_ATENDIMENTO':
        if (this.elements.btnConcluir) {
          this.elements.btnConcluir.classList.remove('hidden');
        }
        if (this.elements.btnEncaminhar) {
          this.elements.btnEncaminhar.classList.remove('hidden');
        }
        break;

      // Outros estados podem não mostrar botões específicos
      case 'NOVO':
      case 'FILA':
      case 'ENCAMINHADO':
      case 'CONCLUIDO':
        // Não mostrar botões de ação nestes estados
        break;

      default:
        console.warn(`⚠️ Estado desconhecido: ${status}`);
    }

    console.log(`✅ Botões atualizados para estado: ${statusNormalizado}`);
  },

  /**
   * ✅ NOVO: Atualizar dados locais (NÃO salva no Firebase ainda)
   */
  atualizarDadosLocais() {
    this.dadosAtendimento.tipo_demanda = this.elements.tipoDemanda?.value || '';
    this.dadosAtendimento.setor_responsavel = this.elements.setorResponsavel?.value || '';
    this.dadosAtendimento.descricao_solicitacao = this.elements.descricaoSolicitacao?.value || '';
    this.dadosAtendimento.observacoes_internas = this.elements.observacoesInternas?.value || '';
    // Remover classes de erro quando preencher
    if (this.elements.setorResponsavel && this.dadosAtendimento.setor_responsavel) {
      this.elements.setorResponsavel.classList.remove('input-error');
    }

    if (this.elements.descricaoSolicitacao && this.dadosAtendimento.descricao_solicitacao) {
      this.elements.descricaoSolicitacao.classList.remove('input-error');
    }
    console.log('💾 Dados atualizados na memória (não salvos ainda):', this.dadosAtendimento);
  },
  /**
 * ✅ Iniciar atendimento (transição: IDENTIDADE_VALIDADA → EM_ATENDIMENTO)
 */
  async iniciarAtendimento() {
    const atendimentoId = localStorage.getItem('atendimento_ativo_id');

    if (!atendimentoId) {
      alert('❌ Nenhum atendimento ativo');
      return;
    }

    try {
      const user = window.AuthSystem.getCurrentUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Validar transição
      const validacao = window.StateMachineManager.validarTransicao(
        'IDENTIDADE_VALIDADA',
        'EM_ATENDIMENTO',
        user.role || 'ATENDENTE'
      );

      if (!validacao.valido) {
        alert(`❌ Transição não permitida: ${validacao.erro}`);
        return;
      }

      // Confirmar ação
      if (!confirm('Deseja iniciar o atendimento? O chat será ativado.')) {
        return;
      }

      // Executar transição
      await window.StateMachineManager.executarTransicao(
        atendimentoId,
        'IDENTIDADE_VALIDADA',
        'EM_ATENDIMENTO',
        'Atendimento iniciado pelo operador'
      );

      // Atualizar timestamp de início
      const fStore = window.FirebaseApp.fStore;
      await fStore.updateDoc(
        fStore.doc(window.FirebaseApp.db, "atend_chat_fila", atendimentoId),
        {
          inicioAtendimento: fStore.serverTimestamp()
        }
      );

      // Feedback
      if (window.ToastManager) {
        window.ToastManager.show('✅ Atendimento iniciado!', 'success');
      } else {
        alert('✅ Atendimento iniciado!');
      }

      console.log('✅ Atendimento iniciado com sucesso');

    } catch (error) {
      console.error('❌ Erro ao iniciar atendimento:', error);
      alert(`Erro: ${error.message}`);
    }
  },
  /**
   * ✅ Encaminhar atendimento (transição: EM_ATENDIMENTO → ENCAMINHADO)
   */
  async encaminharAtendimento() {
    const atendimentoId = localStorage.getItem('atendimento_ativo_id');

    if (!atendimentoId) {
      alert('❌ Nenhum atendimento ativo');
      return;
    }

    // ✅ Verificar se há dados preenchidos
    if (!this.dadosAtendimento.setor_responsavel || !this.dadosAtendimento.descricao_solicitacao || !this.dadosAtendimento.tipo_conta) {
      alert('⚠️ Para encaminhar, é necessário preencher o setor responsável, a descrição da solicitação e o tipo de conta.');

      // Destacar campos que precisam ser preenchidos
      if (this.elements.setorResponsavel) {
        this.elements.setorResponsavel.focus();
        this.elements.setorResponsavel.classList.add('input-error');
      }

      if (this.elements.descricaoSolicitacao && !this.dadosAtendimento.descricao_solicitacao) {
        this.elements.descricaoSolicitacao.classList.add('input-error');
      }
      if (this.elements.tipoConta && !this.dadosAtendimento.tipo_conta) {
        this.elements.tipoConta.classList.add('input-error');
      }
      return;
    }

    // ✅ Mostrar popup de confirmação
    this.mostrarPopupEncaminhar();
  },
  /**
 * ✅ NOVO: Mostrar popup de encaminhamento
 */
  mostrarPopupEncaminhar() {
    if (!this.elements.popupEncaminhar) return;

    // Preencher informações no popup
    if (this.elements.popupSetorDestino) {
      this.elements.popupSetorDestino.textContent = this.dadosAtendimento.setor_responsavel || 'Não informado';
    }

    if (this.elements.popupDescricaoSolicitacao) {
      this.elements.popupDescricaoSolicitacao.textContent = this.dadosAtendimento.descricao_solicitacao || 'Não informado';
    }

    // Limpar campos
    if (this.elements.justificativaEncaminhamento) {
      this.elements.justificativaEncaminhamento.value = '';
    }

    if (this.elements.charCount) {
      this.elements.charCount.textContent = '0';
    }

    // Mostrar popup
    this.elements.popupEncaminhar.classList.add('active');

    // Focar no campo de justificativa
    setTimeout(() => {
      if (this.elements.justificativaEncaminhamento) {
        this.elements.justificativaEncaminhamento.focus();
      }
    }, 100);

    console.log('📤 Popup de encaminhamento aberto');
  },
  /**
   * ✅ NOVO: Fechar popup de encaminhamento
   */
  fecharPopupEncaminhar() {
    document.getElementById('popupEncaminhar').classList.remove('active');
  },
  /**
   * ✅ NOVO: Atualizar contador de caracteres
   */
  atualizarContadorCaracteres() {
    if (!this.elements.justificativaEncaminhamento || !this.elements.charCount) return;

    const texto = this.elements.justificativaEncaminhamento.value;
    const contador = texto.length;

    this.elements.charCount.textContent = contador;

    // Alterar cor se atingir limite
    if (contador >= 490) {
      this.elements.charCount.style.color = '#f44336';
    } else if (contador >= 400) {
      this.elements.charCount.style.color = '#ff9800';
    } else {
      this.elements.charCount.style.color = '#666';
    }
  },
  /**
   * ✅ NOVO: Confirmar encaminhamento (chamado pelo popup)
   */
  async confirmarEncaminhamento() {
    const atendimentoId = localStorage.getItem('atendimento_ativo_id');
    const btnConfirmar = document.querySelector('#popupEncaminhar .btn-confirmar-encaminhamento'); // Ajuste o seletor se necessário

    if (!atendimentoId) {
      alert('❌ Nenhum atendimento ativo');
      this.fecharPopupEncaminhar();
      return;
    }

    try {
      if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fi fi-rr-spinner spinner"></i> Processando...';
        btnConfirmar.style.opacity = '0.7';
        btnConfirmar.style.cursor = 'not-allowed';
      }

      const user = window.AuthSystem.getCurrentUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Obter justificativa do popup
      const justificativa = this.elements.justificativaEncaminhamento?.value.trim();

      if (!justificativa || justificativa.length < 10) {
        alert('❌ A justificativa deve ter pelo menos 10 caracteres');
        if (this.elements.justificativaEncaminhamento) {
          this.elements.justificativaEncaminhamento.focus();
          this.elements.justificativaEncaminhamento.classList.add('input-error');
        }
        return;
      }

      // Validar transição
      const validacao = window.StateMachineManager.validarTransicao(
        'EM_ATENDIMENTO',
        'ENCAMINHADO',
        user.role || 'ATENDENTE',
        justificativa
      );

      if (!validacao.valido) {
        alert(`❌ Transição não permitida: ${validacao.erro}`);
        return;
      }

      // Executar transição
      await window.StateMachineManager.executarTransicao(
        atendimentoId,
        'EM_ATENDIMENTO',
        'ENCAMINHADO',
        justificativa
      );

      // Atualizar documento no Firebase com todos os dados
      const fStore = window.FirebaseApp.fStore;
      const timestampAgora = fStore.Timestamp.now(); // ← Firestore Timestamp, válido dentro de arrayUnion
      const updateData = {
        setor_responsavel: this.dadosAtendimento.setor_responsavel,
        descricao_solicitacao: this.dadosAtendimento.descricao_solicitacao,
        encaminhado_por: user.name || 'Operador',
        encaminhado_por_uid: user.uid,
        encaminhado_em: fStore.serverTimestamp(),
        timeline: fStore.arrayUnion({
          descricao: `Atendimento encaminhado para o setor: ${this.dadosAtendimento.setor_responsavel || 'Não definido'}. Justificativa: ${justificativa}`,
          evento: "atendimento_encaminhado",
          timestamp: timestampAgora,
          usuario: user.uid,
          nome_usuario: user.name || 'Operador'
        })
      };

      // Adicionar observações se existirem
      if (this.dadosAtendimento.observacoes_internas) {
        updateData.observacoes_internas = this.dadosAtendimento.observacoes_internas;
      }

      // Adicionar tipo de demanda se existir
      if (this.dadosAtendimento.tipo_demanda) {
        updateData.tipo_demanda = this.dadosAtendimento.tipo_demanda;
      }
      // Adicionar tipo de conta se existir
      if (this.dadosAtendimento.tipo_conta) {
        updateData.tipo_conta = this.dadosAtendimento.tipo_conta;
      }

      await fStore.updateDoc(
        fStore.doc(window.FirebaseApp.db, "atend_chat_fila", atendimentoId),
        updateData
      );


      // 3️⃣ TERCEIRO: CRIAR REGISTRO NA COLEÇÃO DE DEMANDAS (NOVA INTEGRAÇÃO)
      const dadosDemanda = {
        setor_responsavel: this.dadosAtendimento.setor_responsavel,
        descricao_solicitacao: this.dadosAtendimento.descricao_solicitacao,
        justificativa: justificativa,
        observacoes_internas: this.dadosAtendimento.observacoes_internas,
        tipo_demanda: this.dadosAtendimento.tipo_demanda,
        tipo_conta: this.dadosAtendimento.tipo_conta,
        prioridade: await this.determinarPrioridade(this.dadosAtendimento)
      };




      // Executa em paralelo, não bloqueia o fluxo principal
      await this.encaminharParaColecaoGeral(atendimentoId, dadosDemanda)
        .then(success => {
          if (success) {
            console.log('📋 Demanda registrada na coleção geral com sucesso');
          }
        })
        .catch(err => {
          console.warn('⚠️ Demanda não registrada na coleção geral, mas atendimento foi encaminhado:', err);
        });

      // Fechar popup
      this.fecharPopupEncaminhar();

      // Limpar interface (pois não é mais responsabilidade deste operador)
      this.limparInterface();
      localStorage.removeItem('atendimento_ativo_id');
      if (window.StateManager) window.StateManager.set('atendimento', { currentTicketId: null });

      // Feedback
      const setorDestino = this.dadosAtendimento.setor_responsavel || 'outro setor';
      if (window.ToastManager) {
        window.ToastManager.show(`✅ Encaminhado para ${setorDestino}!`, 'success');
      } else {
        alert(`✅ Encaminhado para ${setorDestino}!`);
      }

      console.log('✅ Atendimento encaminhado com sucesso', {
        setor: this.dadosAtendimento.setor_responsavel,
        descricao: this.dadosAtendimento.descricao_solicitacao,
        justificativa: justificativa
      });

    } catch (error) {
      console.error('❌ Erro ao confirmar encaminhamento:', error);
      alert(`Erro: ${error.message}`);
      if (btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = 'Confirmar Encaminhamento';
        btnConfirmar.style.opacity = '1';
        btnConfirmar.style.cursor = 'pointer';
      }
    }
  },
  /**
 * ✅ NOVA FUNÇÃO: Encaminhar para coleção geral_demandas (Integração paralela)
 */
  async encaminharParaColecaoGeral(atendimentoId, dadosEncaminhamento) {
    try {
      const fStore = window.FirebaseApp.fStore;
      const db = window.FirebaseApp.db;
      const user = window.AuthSystem.getCurrentUser();

      if (!user) {
        console.warn('⚠️ Usuário não autenticado para criar demanda externa');
        return false;
      }

      // 1. Buscar dados completos do atendimento
      const atendimentoDoc = await fStore.getDoc(
        fStore.doc(db, "atend_chat_fila", atendimentoId)
      );

      if (!atendimentoDoc.exists()) {
        console.error('❌ Documento do atendimento não encontrado:', atendimentoId);
        return false;
      }

      const atendimentoData = atendimentoDoc.data();

      // 2. Gerar ID único para a demanda
      const timestamp = Date.now();
      const demandaId = `DEM-${timestamp}-${Math.random().toString(36).substr(2, 6)}`;

      // 3. Mapear setor responsável para o formato da demanda
      const setorDestino = this.mapearSetorDestino(dadosEncaminhamento.setor_responsavel);

      // 4. Criar documento na coleção geral_demandas
      const demandaRef = fStore.doc(db, "geral_demandas", demandaId);

      const demandaData = {
        demandaId: demandaId,
        atendimentoId: atendimentoId,

        // Dados para o Card (evita fetch extra)
        cliente: {
          nome: atendimentoData.cliente?.nome || 'Não informado',
          uid: atendimentoData.uid_cliente || '',
          email: atendimentoData.cliente?.email || '',
          telefone: atendimentoData.cliente?.telefone || ''
        },

        // Roteamento
        setor_origem: "atendimento",
        setor_destino: setorDestino,
        operador_origem_uid: user.uid,
        operador_origem_nome: user.name || 'Operador',
        operador_destino_uid: null,
        operador_destino_nome: null,

        // Status e Prioridade
        status: "PENDENTE",
        prioridade: dadosEncaminhamento.prioridade || this.determinarPrioridade(atendimentoData),
        resumo: dadosEncaminhamento.descricao_solicitacao || 'Solicitação encaminhada',
        justificativa_encaminhamento: dadosEncaminhamento.justificativa || '',

        // Dados adicionais para referência rápida
        tipo: atendimentoData.tipo || 'suporte',
        canal: atendimentoData.canal || 'web',
        criado_em_chat: atendimentoData.criadoEm,

        // Marcos Temporais
        timestamps: {
          criada_em: fStore.serverTimestamp(),
          encaminhada_em: fStore.serverTimestamp(),
          assumida_em: null,
          concluida_em: null,
          ultima_atualizacao: fStore.serverTimestamp()
        },

        // Histórico resumido de transições
        historico_status: [{
          status: "PENDENTE",
          timestamp: new Date().toISOString(),
          usuario: user.name || 'Operador',
          acao: 'encaminhado',
          setor_destino: setorDestino,
          justificativa: dadosEncaminhamento.justificativa?.substring(0, 100) || ''
        }]
      };

      // Adicionar observações se existirem
      if (dadosEncaminhamento.observacoes_internas) {
        demandaData.observacoes_internas = dadosEncaminhamento.observacoes_internas;
      }

      // Adicionar tipo de demanda se existir
      if (dadosEncaminhamento.tipo_demanda) {
        demandaData.tipo_demanda = dadosEncaminhamento.tipo_demanda;
      }

      // Adicionar dados do atendimento original para referência
      demandaData.atendimento_info = {
        status_atual: atendimentoData.status,
        setor_anterior: atendimentoData.setor_responsavel,
        ultima_mensagem_em: atendimentoData.ultimaMensagemEm,
        timeline_count: atendimentoData.timeline?.length || 0
      };

      await fStore.setDoc(demandaRef, demandaData);

      console.log('✅ Demanda externa criada na coleção geral_demandas:', {
        demandaId: demandaId,
        atendimentoId: atendimentoId,
        setorDestino: setorDestino
      });

      return true;

    } catch (error) {
      console.error('❌ Erro ao criar demanda na coleção geral:', error);
      // Não interrompe o fluxo principal, apenas loga o erro
      return false;
    }
  },

  /**
   * ✅ FUNÇÃO AUXILIAR: Mapear setor responsável para formato padronizado
   */
  mapearSetorDestino(setorInput) {
    if (!setorInput) return 'outros';

    const mapeamento = {
      'financeiro': 'financeiro',
      'financeira': 'financeiro',
      'finanças': 'financeiro',
      'suporte': 'suporte',
      'tecnico': 'suporte',
      'técnico': 'suporte',
      'comercial': 'comercial',
      'vendas': 'comercial',
      'juridico': 'juridico',
      'jurídico': 'juridico',
      'marketing': 'marketing',
      'administrativo': 'administrativo',
      'rh': 'rh',
      'recursoshumanos': 'rh',
      'atendimento': 'atendimento',
      'operacional': 'operacional'
    };

    const setorLower = setorInput.toLowerCase().trim();
    return mapeamento[setorLower] || setorLower;
  },

  /**
   * ✅ FUNÇÃO AUXILIAR: Determinar prioridade da demanda
   */
  async determinarPrioridade(atendimentoData) {
    const demanda = this.dadosAtendimento.tipo_demanda;
    let complexidade = 'media';

    // 1. Define as listas de exceção para o Score
    const demandasAlta = ['Aprovar Advanced', 'Takedown', 'Aplicar Strike', 'Analisar conteúdo'];
    const demandasBaixa = ['Smart-Links', 'Resetar Tipaldi', 'Liberar Verificador em Dois Fatores'];

    if (demandasAlta.includes(demanda)) {
      complexidade = 'alta';
    } else if (demandasBaixa.includes(demanda)) {
      complexidade = 'baixa';
    }

    // 2. Calcula via PriorityMaster
    const resultado = await window.PriorityMaster.calcularScore({
      tipoConta: this.dadosAtendimento.tipo_conta,
      emailCliente: atendimentoData.cliente?.email || '',
      complexidade: complexidade
    });

    return resultado.total;
  },

  /**
   * ✅ NOVO: Concluir atendimento (SALVA TUDO) + INTEGRAÇÃO STATE MACHINE
   */
  async concluirAtendimento() {
    const atendimentoId = localStorage.getItem('atendimento_ativo_id');

    if (!atendimentoId) {
      alert('❌ Nenhum atendimento ativo');
      return;
    }

    // ✅ VALIDAÇÃO: Verificar se identidade foi confirmada
    if (!this.dadosAtendimento.validacao_identidade.concluida) {
      alert('⚠️ Por favor, confirme a validação de identidade antes de concluir.');
      return;
    }

    // ✅ Confirmar ação
    if (!confirm('Deseja realmente concluir este atendimento?')) {
      return;
    }

    try {
      const user = window.AuthSystem.getCurrentUser();
      if (!user) throw new Error('Usuário não autenticado');

      console.log('📤 Finalizando atendimento e salvando todos os dados...');

      // ✅ Validar transição usando estado FIXO (igual ao encaminhamento)
      const validacao = window.StateMachineManager.validarTransicao(
        'EM_ATENDIMENTO',    // ⭐ ESTADO FIXO - igual ao encaminhar
        'CONCLUIDO',
        user.role || 'ATENDENTE'
      );

      if (!validacao.valido) {
        alert(`❌ Transição não permitida: ${validacao.erro}`);
        return;
      }

      // ✅ Executar transição usando executarTransicao (igual ao encaminhar)
      await window.StateMachineManager.executarTransicao(
        atendimentoId,
        'EM_ATENDIMENTO',
        'CONCLUIDO',
        'Atendimento finalizado pelo operador'
      );

      // ✅ Atualizar dados locais com valores atuais
      this.atualizarDadosLocais();

      // ✅ Preparar dados para salvar (igual ao encaminhar, mas para CONCLUIDO)
      const fStore = window.FirebaseApp.fStore;
      const updateData = {
        status: 'CONCLUIDO',
        concluido_em: fStore.serverTimestamp(),
        concluido_por: user.name || 'Operador',
        concluido_por_uid: user.uid
      };

      // ✅ Adicionar validação (se não foi salva antes)
      if (this.dadosAtendimento.validacao_identidade.concluida) {
        updateData.validacao_identidade = {
          concluida: true,
          validado_por: this.dadosAtendimento.validacao_identidade.validado_por,
          validado_em: this.dadosAtendimento.validacao_identidade.validado_em || fStore.serverTimestamp(),
          campos_verificados: this.dadosAtendimento.validacao_identidade.campos_verificados
        };
      }

      // ✅ Adicionar campos do formulário (igual ao encaminhar)
      if (this.dadosAtendimento.tipo_demanda) {
        updateData.tipo_demanda = this.dadosAtendimento.tipo_demanda;
      }

      if (this.dadosAtendimento.setor_responsavel) {
        updateData.setor_responsavel = this.dadosAtendimento.setor_responsavel;
      }

      if (this.dadosAtendimento.descricao_solicitacao) {
        updateData.descricao_solicitacao = this.dadosAtendimento.descricao_solicitacao;
      }

      if (this.dadosAtendimento.observacoes_internas) {
        updateData.observacoes_internas = this.dadosAtendimento.observacoes_internas;
      }

      console.log('📊 Dados a salvar:', updateData);

      // ✅ Salvar no Firebase (igual ao encaminhar)
      await fStore.updateDoc(
        fStore.doc(window.FirebaseApp.db, "atend_chat_fila", atendimentoId),
        updateData
      );

      console.log('✅ Atendimento concluído com sucesso');

      // ✅ Feedback visual
      if (window.ToastManager) {
        window.ToastManager.show('✅ Atendimento concluído com sucesso!', 'success');
      } else {
        alert('✅ Atendimento concluído com sucesso!');
      }

      // ✅ Limpar interface (igual ao encaminhar)
      this.limparInterface();

      // ✅ Limpar localStorage
      localStorage.removeItem('atendimento_ativo_id');
      window.StateManager.set('atendimento', { currentTicketId: null });

    } catch (error) {
      console.error('❌ Erro ao concluir atendimento:', error);
      alert(`Erro: ${error.message}`);
    }
  },
  /**
   * ✅ NOVO: Limpar interface após conclusão
   */
limparInterface() {
  // Ocultar workspace
  if (this.elements.workspace) {
    this.elements.workspace.classList.add('hidden');
  }

  // Mostrar empty state
  if (this.elements.emptyState) {
    this.elements.emptyState.classList.remove('hidden');
  }

  // Limpar chat
  if (this.elements.chatbox) {
    this.elements.chatbox.innerHTML = '';
  }

  // Resetar campos
  if (this.elements.tipoDemanda) this.elements.tipoDemanda.value = '';
  if (this.elements.setorResponsavel) this.elements.setorResponsavel.value = '';
  if (this.elements.descricaoSolicitacao) this.elements.descricaoSolicitacao.value = '';
  if (this.elements.observacoesInternas) this.elements.observacoesInternas.value = '';

  // Resetar checkboxes
  if (this.elements.checkNome) {
    this.elements.checkNome.checked = false;
    this.elements.checkNome.disabled = false;
  }
  if (this.elements.checkTelefone) {
    this.elements.checkTelefone.checked = false;
    this.elements.checkTelefone.disabled = false;
  }
  if (this.elements.checkEmail) {
    this.elements.checkEmail.checked = false;
    this.elements.checkEmail.disabled = false;
  }

  // Resetar botao de validacao
  if (this.elements.btnValidarIdentidade) {
    this.elements.btnValidarIdentidade.disabled = true;
    this.elements.btnValidarIdentidade.textContent = 'Confirmar Identidade';
    this.elements.btnValidarIdentidade.classList.remove('btn-success', 'btn-ready');
  }

  // Ocultar botoes de acao
  if (this.elements.btnIniciarAtendimento) {
    this.elements.btnIniciarAtendimento.classList.add('hidden');
  }
  if (this.elements.btnConcluir) {
    this.elements.btnConcluir.classList.add('hidden');
  }
  if (this.elements.btnEncaminhar) {
    this.elements.btnEncaminhar.classList.add('hidden');
  }

  // Resetar estado local
  this.dadosAtendimento = {
    validacao_identidade: {
      concluida: false,
      campos_verificados: []
    },
    tipo_demanda: '',
    setor_responsavel: '',
    descricao_solicitacao: '',
    observacoes_internas: ''
  };

  console.log('[INTERFACE] Interface limpa apos conclusao');
  
  // RE-INICIALIZAR listener apos conclusao
  // Isso garante que o proximo cliente na fila SERA notificado
  setTimeout(() => {
    console.log('[LISTENER] Re-inicializando listener da fila...');
    this._configurarCallbackFila();
    console.log('[LISTENER] Listener da fila re-inicializado');
  }, 500);
},

  /**
   * NOVO: Reiniciar listener da fila apos conclusao de atendimento
   * Permite que proximas notificacoes cheguem sem precisar atualizar pagina
   */
  reiniciarListenerFila() {
    // Aguardar um tempo antes de reiniciar (evita race condition)
    setTimeout(() => {
      console.log('Reiniciando listener da fila...');

      // Se o manager ainda nao carregou, aguarda
      if (!window.RealtimeListenersManager) {
        console.warn('Aguardando RealtimeListenersManager...');
        let tentativas = 0;
        const intervalo = setInterval(() => {
          tentativas++;
          if (window.RealtimeListenersManager) {
            clearInterval(intervalo);
            console.log('OK RealtimeListenersManager disponivel, reiniciando listener...');
            this._configurarCallbackFila();
          } else if (tentativas >= 10) {
            clearInterval(intervalo);
            console.error('ERRO RealtimeListenersManager nao disponivel');
          }
        }, 300);
        return;
      }

      // Se ja existe callback, registra novamente
      this._configurarCallbackFila();

      // Tambem inicia listener na fila para nao perder novos clientes
      if (window.RealtimeListenersManager && window.RealtimeListenersManager.escutarFilaClientes) {
        window.RealtimeListenersManager.escutarFilaClientes();
      }

      console.log('OK Listener da fila reiniciado com sucesso');
    }, 1000); // 1 segundo de delay para evitar race condition
  },
  /**
   * ✅ Lógica de notificação inteligente
   */
 notificarNovoAtendimento(ticket) {
  // Neste ponto, JA foi verificado tudo em _configurarCallbackFila()
  // SO mostra a notificacao

  console.log('[NOTIFICACAO] Exibindo: ' + ticket.atendimentoId);

  if (window.NovoClienteNotificacaoManager) {
    window.NovoClienteNotificacaoManager.mostrarNotificacao(
      ticket,
      // onAceitar
      (dadosCliente) => {
        this.ticketAtual = dadosCliente;
        this.acceptCall();
      },
      // onRejeitar
      (dadosCliente) => {
        console.log('[NOTIFICACAO] Rejeitado: ' + dadosCliente.atendimentoId);
      }
    );
  } else {
    this.mostrarPopup(ticket);
  }
},

  mostrarPopup(ticket) {
    // Fallback simples — só usado se NovoClienteNotificacaoManager não estiver disponível
    const nomeExibicao = document.getElementById('popupCliente');
    if (nomeExibicao) nomeExibicao.textContent = ticket.cliente?.nome || 'Cliente';
    if (this.elements.popup) this.elements.popup.style.display = 'flex';
  },

  async acceptCall() {
    if (!this.ticketAtual) return;

    // Busca dados frescos do Firestore para garantir que é o ticket correto
    try {
      const db = window.FirebaseApp.db;
      const { doc, getDoc } = window.FirebaseApp.fStore;

      const docSnap = await getDoc(
        doc(db, 'atend_chat_fila', this.ticketAtual.atendimentoId)
      );

      if (!docSnap.exists()) {
        console.warn('⚠️ Ticket não encontrado, pode ter sido aceito por outro operador');
        window.ToastManager?.show('Este atendimento não está mais disponível.', 'warning');
        this.ticketAtual = null;
        return;
      }

      const dadosAtuais = docSnap.data();

      // Verificar se ainda está em FILA — outro operador pode ter aceitado antes
      if (dadosAtuais.status !== 'FILA') {
        console.warn('⚠️ Ticket já foi aceito por outro operador:', dadosAtuais.status);
        window.ToastManager?.show('Este atendimento já foi aceito por outro operador.', 'warning');
        this.ticketAtual = null;
        return;
      }

      const ticket = { atendimentoId: docSnap.id, ...dadosAtuais };

      localStorage.setItem('atendimento_ativo_id', ticket.atendimentoId);
      window.StateManager.set('atendimento', { currentTicketId: ticket.atendimentoId });

      this.renderizarInterfaceAtendimento(ticket);
      this.vincularOperadorNoFirebase(ticket.atendimentoId);
      this.conectarChat(ticket.atendimentoId);

    } catch (error) {
      console.error('❌ Erro ao aceitar atendimento:', error);
      window.ToastManager?.show('Erro ao aceitar atendimento.', 'error');
    }
  },

  async restaurarVisualAtendimento(atendimentoId) {
    try {
      const db = window.FirebaseApp.db;
      const { doc, getDoc } = window.FirebaseApp.fStore;
      const docSnap = await getDoc(doc(db, "atend_chat_fila", atendimentoId));

      if (!docSnap.exists()) {
        localStorage.removeItem('atendimento_ativo_id');
        return;
      }

      const ticket = docSnap.data();
      const statusNormalizado = (ticket.status || '').toUpperCase();

      // ✅ Status final: limpa sem renderizar nada
      if (statusNormalizado === 'CONCLUIDO' || statusNormalizado === 'ENCAMINHADO') {
        console.log(`ℹ️ Atendimento restaurado com status final (${statusNormalizado}). Limpando.`);
        localStorage.removeItem('atendimento_ativo_id');
        if (window.StateManager) {
          window.StateManager.set('atendimento', { currentTicketId: null });
        }
        return;
      }

      // Status ativo: restaura normalmente
      this.ticketAtual = ticket;
      window.AtendimentoDataStructure.state.atendimentoId = atendimentoId;

      this.renderizarInterfaceAtendimento(ticket);
      this.conectarChat(atendimentoId);
      this.restaurarCamposFormulario(ticket);

    } catch (error) {
      console.error("❌ Erro ao restaurar:", error);
    }
  },

  /**
   * ✅ NOVO: Restaurar campos do formulário
   */
  restaurarCamposFormulario(ticket) {
    console.log('🔄 Restaurando campos do formulário...');

    // Restaurar validação de identidade
    if (ticket.validacao_identidade?.concluida) {
      if (this.elements.checkNome) {
        this.elements.checkNome.checked = true;
        this.elements.checkNome.disabled = true;
      }
      if (this.elements.checkTelefone) {
        this.elements.checkTelefone.checked = true;
        this.elements.checkTelefone.disabled = true;
      }
      if (this.elements.checkEmail) {
        this.elements.checkEmail.checked = true;
        this.elements.checkEmail.disabled = true;
      }

      if (this.elements.btnValidarIdentidade) {
        this.elements.btnValidarIdentidade.textContent = '✓ Identidade Confirmada';
        this.elements.btnValidarIdentidade.disabled = true;
        this.elements.btnValidarIdentidade.classList.add('btn-success');
      }

      this.dadosAtendimento.validacao_identidade = ticket.validacao_identidade;
    }

    // Restaurar campos do formulário
    if (ticket.tipo_demanda && this.elements.tipoDemanda) {
      this.elements.tipoDemanda.value = ticket.tipo_demanda;
      this.dadosAtendimento.tipo_demanda = ticket.tipo_demanda;
    }

    if (ticket.setor_responsavel && this.elements.setorResponsavel) {
      this.elements.setorResponsavel.value = ticket.setor_responsavel;
      this.dadosAtendimento.setor_responsavel = ticket.setor_responsavel;
    }

    if (ticket.descricao_solicitacao && this.elements.descricaoSolicitacao) {
      this.elements.descricaoSolicitacao.value = ticket.descricao_solicitacao;
      this.dadosAtendimento.descricao_solicitacao = ticket.descricao_solicitacao;
    }

    if (ticket.observacoes_internas && this.elements.observacoesInternas) {
      this.elements.observacoesInternas.value = ticket.observacoes_internas;
      this.dadosAtendimento.observacoes_internas = ticket.observacoes_internas;
    }

    console.log('✅ Campos restaurados');
  },

  renderizarInterfaceAtendimento(ticket) {
    if (this.elements.popup) this.elements.popup.style.display = 'none';
    if (this.elements.emptyState) this.elements.emptyState.classList.add('hidden');
    if (this.elements.workspace) this.elements.workspace.classList.remove('hidden');
    // dados do cliente
    this.fillClientData({
      nome: ticket.cliente.nome,
      telefone: ticket.cliente.telefone || "Não informado",
      email: ticket.cliente.email || "Não informado"
    });
    // ✅ NOVO: Atualizar informações do ticket
    this.atualizarInformacoesTicket(ticket);
  },
  atualizarInformacoesTicket(ticket) {
    // 1. Atualizar ID do ticket
    const ticketIdElement = document.getElementById('ticketId');
    if (ticketIdElement && ticket.atendimentoId) {
      ticketIdElement.textContent = ticket.atendimentoId;
    }

    // 2. Atualizar setor (no lugar onde estava "NOVO")
    const stateIndicatorElement = document.getElementById('stateIndicator');
    if (stateIndicatorElement) {
      // Mostrar setor responsável
      const setor = ticket.setor_responsavel || "suporte";
      stateIndicatorElement.textContent = setor.toUpperCase();

      // Adicionar classe CSS baseada no setor
      stateIndicatorElement.className = 'state-indicator';
      stateIndicatorElement.classList.add(`setor-${setor.toLowerCase().replace(/\s+/g, '-')}`);
    }

    // 3. Atualizar status do ticket
    const statusBadgeElement = document.getElementById('statusBadge');
    if (statusBadgeElement) {
      this.atualizarBadgeStatus(ticket.status, statusBadgeElement); // ✅ Passar elemento
    }
    // ✅ 4. Atualizar botões conforme estado
    this.atualizarBotoesPorEstado(ticket.status);
  },
  atualizarBadgeStatus(status, Element) {
    if (!Element) {
      console.error('❌ Elemento não fornecido para atualizarBadgeStatus');
      return;
    }

    const statusMap = {
      'FILA': { text: 'FILA', class: 'status-fila' },
      'NOVO': { text: 'NOVO', class: 'status-novo' },
      'IDENTIDADE_VALIDADA': { text: 'IDENTIDADE VALIDADA', class: 'status-identidade-validada' },
      'EM_ATENDIMENTO': { text: 'EM ATENDIMENTO', class: 'status-em-atendimento' },
      'ENCAMINHADO': { text: 'ENCAMINHADO', class: 'status-encaminhado' },
      'CONCLUIDO': { text: 'CONCLUIDO', class: 'status-concluido' },
      'identidade_validada': { text: 'IDENTIDADE VALIDADA', class: 'status-identidade-validada' },
      'em_atendimento': { text: 'EM ATENDIMENTO', class: 'status-em-atendimento' },
      'concluido': { text: 'CONCLUIDO', class: 'status-concluido' },
      'encaminhado': { text: 'ENCAMINHADO', class: 'status-encaminhado' }
    };

    const statusInfo = statusMap[status] || { text: status, class: 'status-desconhecido' };

    Element.textContent = statusInfo.text;
    Element.className = 'status-badge ' + statusInfo.class;

    console.log(`✅ Status badge atualizado: ${status} → ${statusInfo.text}`);
  },

  conectarChat(atendimentoId) {
    // Para listeners anteriores
    if (this.unsubscribeChat) this.unsubscribeChat();
    if (this.unsubscribeTicket) this.unsubscribeTicket();

    const db = window.FirebaseApp.db;
    const fStore = window.FirebaseApp.fStore;

    // ----------------------------------------------------------------
    // LISTENER DO DOCUMENTO (status, dados do ticket)
    // ----------------------------------------------------------------
    const ticketRef = fStore.doc(db, "atend_chat_fila", atendimentoId);

    this.unsubscribeTicket = fStore.onSnapshot(ticketRef, (docSnap) => {
      if (!docSnap.exists()) return;

      const ticket = docSnap.data();

      // Atualiza badge e botões normalmente
      this.atualizarInformacoesTicket(ticket);

      // ✅ NOVO: Detecta estados finais e libera o painel automaticamente
      const statusFinal = (ticket.status || '').toUpperCase();

      if (statusFinal === 'ENCAMINHADO' || statusFinal === 'CONCLUIDO') {
        console.log(`🔔 Status final detectado no listener: ${statusFinal}. Liberando painel.`);

        // Para os listeners primeiro para não processar mais eventos
        if (this.unsubscribeTicket) { this.unsubscribeTicket(); this.unsubscribeTicket = null; }
        if (this.unsubscribeChat) { this.unsubscribeChat(); this.unsubscribeChat = null; }

        // Limpa o localStorage e o StateManager
        localStorage.removeItem('atendimento_ativo_id');
        if (window.StateManager) {
          window.StateManager.set('atendimento', { currentTicketId: null });
        }

        // Limpa a interface (volta para emptyState)
        this.limparInterface();

        // Feedback contextual para o operador
        const mensagem = statusFinal === 'ENCAMINHADO'
          ? '📤 Atendimento encaminhado. Painel liberado.'
          : '✅ Atendimento concluído. Painel liberado.';

        if (window.ToastManager) {
          window.ToastManager.show(mensagem, 'info');
        }
      }
    });

    // ----------------------------------------------------------------
    // LISTENER DE MENSAGENS (chat em tempo real)
    // ----------------------------------------------------------------
    const q = fStore.query(
      fStore.collection(db, "atend_chat_fila", atendimentoId, "mensagem"),
      fStore.orderBy("timestamp", "asc")
    );

    if (this.elements.chatbox) this.elements.chatbox.innerHTML = '';

    this.unsubscribeChat = fStore.onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          this.renderizarMensagemNaTela(change.doc.data());
        }
      });
    });
  },



  renderizarMensagemNaTela(msg) {
    if (!this.elements.chatbox) return;

    const msgDiv = document.createElement('div');
    const classeLado = msg.autor === 'operador' ? 'atendente' : 'cliente';
    msgDiv.className = `msg ${classeLado}`;

    const hora = msg.timestamp?.toDate ?
      msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
      this.getCurrentTime();

    msgDiv.innerHTML = `
      <div class="msg-content">${Utils.escapeHtml(msg.texto)}</div>
      <div class="msg-time">${hora}</div>
    `;

    this.elements.chatbox.appendChild(msgDiv);
    this.elements.chatbox.scrollTop = this.elements.chatbox.scrollHeight;
  },

  async sendMessage() {
    const texto = this.elements.chatInput?.value.trim();
    const atendimentoId = window.AtendimentoDataStructure?.state?.atendimentoId;

    if (!texto || !atendimentoId) return;

    try {
      const db = window.FirebaseApp.db;
      const { collection, addDoc, serverTimestamp } = window.FirebaseApp.fStore;

      this.elements.chatInput.value = '';

      await addDoc(collection(db, "atend_chat_fila", atendimentoId, "mensagem"), {
        texto: texto,
        autor: "operador",
        nome: window.AuthSystem.getCurrentUser()?.name || "Atendente",
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("❌ Erro ao enviar:", error);
    }
  },

  fillClientData(cliente) {
    if (this.elements.clienteNome) this.elements.clienteNome.value = cliente.nome;
    if (this.elements.clienteTelefone) this.elements.clienteTelefone.value = cliente.telefone;
    if (this.elements.clienteEmail) this.elements.clienteEmail.value = cliente.email;
  },

  getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  },
  async vincularOperadorNoFirebase(atendimentoId) {
    try {
      const manager = window.AtendimentoDataStructure;
      const finalUID = window.FirebaseApp.auth?.currentUser?.uid;

      if (!finalUID) {
        console.error("❌ UID do operador não encontrado");
        return;
      }

      const usuarioLogado = window.AuthSystem?.getCurrentUser() || {};
      const operadorInfo = {
        atribuido_para_uid: finalUID,
        nome: usuarioLogado.name || "Operador",
        role: usuarioLogado.role || "Atendente"
      };

      manager.state.atendimentoId = atendimentoId;
      await manager.operadorAceitaAtendimento(operadorInfo);

    } catch (error) {
      console.error("❌ Falha ao vincular operador:", error);
    }
  },
  atualizarDadosLocal(campo, valor) {
    this.dadosAtendimento[campo] = valor;

    // Isso aqui remove a borda vermelha de erro assim que o usuário preenche
    const el = document.getElementById(campo === 'tipo_conta' ? 'tipoConta' : campo);
    if (el) el.classList.remove('input-error');
  },
  async refresh() {
    console.log('🔄 Atualizando WhatsAppTab...');

    try {
      const idSalvo = localStorage.getItem('atendimento_ativo_id');

      if (idSalvo) {
        await this.restaurarVisualAtendimento(idSalvo);
      }

      console.log('✅ WhatsAppTab atualizado');
    } catch (error) {
      console.error('❌ Erro ao atualizar WhatsApp:', error);
    }
  },

  cleanup() {
    console.log('🧹 Limpando WhatsAppTab...');

    try {
      if (this.unsubscribeChat) {
        this.unsubscribeChat();
        this.unsubscribeChat = null;
      }

      console.log('✅ WhatsAppTab limpo');
    } catch (error) {
      console.warn('⚠️ Erro no cleanup:', error);
    }
  },

  destroy() {
    console.log('🗑️ Destruindo WhatsAppTab...');

    if (this.unsubscribeChat) {
      this.unsubscribeChat();
      this.unsubscribeChat = null;
    }

    if (this.unsubscribeFila) {
      this.unsubscribeFila();
      this.unsubscribeFila = null;
    }

    if (window.RealtimeListenersManager) {
      window.RealtimeListenersManager.limparListener('filaClientes');
      // Limpar o callback para não disparar após destruição
      window.RealtimeListenersManager.registrarCallback('NovoClienteFila', null);
    }
    this._initialized = false;
    console.log('✅ WhatsAppTab destruído');
  }
};

window.WhatsAppTab = WhatsAppTab;
export default WhatsAppTab;