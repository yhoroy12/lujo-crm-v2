/**
 * STATE MACHINE MANAGER - Integração com Ticket State Machine (VERSÃO CORRIGIDA)
 * Gerencia transições de estado validadas e auditadas
 * 
 * ✅ CORREÇÕES APLICADAS:
 * - Função normalizarEstado() para compatibilidade
 * - Validação robusta de transições
 * - Logs detalhados para debug
 * - Tratamento de erros melhorado
 */

class StateMachineManager {
  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;
    this.currentUser = window.FirebaseApp?.auth?.currentUser;
  }

  /**
   * ✅ NOVO: Normalizar estados para compatibilidade
   * Converte estados em minúsculo/misto para o padrão maiúsculo da State Machine
   */
  normalizarEstado(status) {
    if (!status) return 'FILA';
    
    // Mapa de conversão
    const mapa = {
      'novo': 'NOVO',
      'fila': 'FILA',
      'identidade_validada': 'IDENTIDADE_VALIDADA',
      'em_atendimento': 'EM_ATENDIMENTO',
      'encaminhado': 'ENCAMINHADO',
      'aguardando_setor': 'AGUARDANDO_SETOR',
      'aguardando_cliente': 'AGUARDANDO_CLIENTE',
      'concluido': 'CONCLUIDO',
      'acao_administrativa_aplicada': 'ACAO_ADMINISTRATIVA_APLICADA'
    };
    
    // Se já está em maiúsculo e é válido, retorna direto
    if (status === status.toUpperCase() && window.TicketStateMachine?.isValidState(status)) {
      return status;
    }
    
    // Converte para minúsculo e busca no mapa
    const statusLower = status.toLowerCase();
    const estadoNormalizado = mapa[statusLower] || status.toUpperCase();
    
    console.log(`🔄 Normalização: "${status}" → "${estadoNormalizado}"`);
    return estadoNormalizado;
  }

  /**
   * Mapear estados do cliente para State Machine (mantido para compatibilidade)
   */
  mapearEstadoCliente(statusCliente) {
    return this.normalizarEstado(statusCliente);
  }

  /**
   * Validar transição de estado ANTES de fazer a mudança
   * Usa a função do ticketstatemachine.js
   */
  validarTransicao(estadoAtual, estadoNovo, userRole, justificativa = null) {
    if (!window.TicketStateMachine) {
      console.warn("⚠️ TicketStateMachine não carregado");
      return { valido: false, erro: "State Machine não disponível" };
    }

    // ✅ Normalizar ambos os estados antes de validar
    const estadoAtualNormalizado = this.normalizarEstado(estadoAtual);
    const estadoNovoNormalizado = this.normalizarEstado(estadoNovo);

    console.group('🔍 DEBUG: Validação de Transição');
    console.log('Estado Original:', estadoAtual);
    console.log('Estado Normalizado:', estadoAtualNormalizado);
    console.log('Estado Alvo:', estadoNovoNormalizado);
    console.log('User Role:', userRole);
    console.groupEnd();

    // Validar se a transição é permitida
    const validacao = window.TicketStateMachine.validateTransition(
      estadoAtualNormalizado,
      estadoNovoNormalizado,
      userRole,
      justificativa
    );

    if (!validacao.valid) {
      console.error("❌ Transição não permitida:", validacao.error);
      return { valido: false, erro: validacao.error };
    }

    console.log(`✅ Transição validada: ${estadoAtualNormalizado} → ${estadoNovoNormalizado}`);
    return { valido: true };
  }

  /**
   * Obter transições disponíveis para o usuário atual
   * Mostra apenas botões que são válidos para o estado atual
   */
  obterTransicoesDisponiveis(estadoAtual, userRole) {
    if (!window.TicketStateMachine) {
      return [];
    }

    // ✅ Normalizar estado antes de buscar transições
    const estadoNormalizado = this.normalizarEstado(estadoAtual);

    const transicoes = window.TicketStateMachine.getAvailableTransitions(
      estadoNormalizado,
      userRole
    );

    console.log(`Transições disponíveis de ${estadoNormalizado}:`, transicoes);
    return transicoes;
  }

  /**
   * Criar log de transição (auditoria)
   * Salva em subcoleção "state_logs" para rastreabilidade
   */
  async criarLogTransicao(atendimentoId, estadoAnterior, estadoNovo, justificativa = null) {
    if (!this.currentUser) {
      // Tentar obter usuário atual novamente
      this.currentUser = window.FirebaseApp?.auth?.currentUser;
      
      if (!this.currentUser) {
        console.warn("⚠️ Usuário não autenticado - log não será criado");
        return;
      }
    }

    try {
      // ✅ Normalizar estados para o log
      const estadoAnteriorNormalizado = this.normalizarEstado(estadoAnterior);
      const estadoNovoNormalizado = this.normalizarEstado(estadoNovo);

      const logData = window.TicketStateMachine.createStateLog(
        atendimentoId,
        estadoAnteriorNormalizado,
        estadoNovoNormalizado,
        {
          username: this.currentUser.email,
          name: this.currentUser.displayName || "Usuário",
          uid: this.currentUser.uid,
          role: this.obterRoleUsuario()
        },
        justificativa
      );

      // Salvar em subcoleção
      await this.fStore.addDoc(
        this.fStore.collection(
          this.db,
          "atend_chat_fila",
          atendimentoId,
          "state_logs"
        ),
        logData
      );

      console.log("✅ Log de transição criado:", logData);
      return logData;
    } catch (error) {
      console.error("❌ Erro ao criar log:", error);
      throw error;
    }
  }

  /**
   * Executar transição de estado (com validação e auditoria)
   */
  async executarTransicao(atendimentoId, estadoAnterior, estadoNovo, justificativa = null) {
    console.group('🚀 EXECUTANDO TRANSIÇÃO');
    console.log('Atendimento ID:', atendimentoId);
    console.log('Estado Anterior:', estadoAnterior);
    console.log('Estado Novo:', estadoNovo);
    console.log('Justificativa:', justificativa);

    try {
      // ✅ 1. Normalizar estados
      const estadoAnteriorNormalizado = this.normalizarEstado(estadoAnterior);
      const estadoNovoNormalizado = this.normalizarEstado(estadoNovo);

      // 2. Validar permissão
      const userRole = this.obterRoleUsuario();
      const validacao = this.validarTransicao(
        estadoAnteriorNormalizado,
        estadoNovoNormalizado,
        userRole,
        justificativa
      );

      if (!validacao.valido) {
        throw new Error(validacao.erro);
      }

      // 3. Criar log (auditoria)
      await this.criarLogTransicao(
        atendimentoId,
        estadoAnteriorNormalizado,
        estadoNovoNormalizado,
        justificativa
      );

      // 4. Atualizar status no Firestore
      const agoraTimestamp = this.fStore.Timestamp.now();
      const timelineItem = {
        evento: `status_${estadoNovoNormalizado}`,
        timestamp: agoraTimestamp,
        usuario: this.currentUser?.uid || 'sistema',
        estadoAnterior: estadoAnteriorNormalizado,
        stadoNovo: estadoNovoNormalizado,
        descricao: justificativa || `Transição para ${estadoNovoNormalizado}`
    };
    
   // Atualizar documento com novo estado e timeline 
    await this.fStore.updateDoc(
      this.fStore.doc(this.db, "atend_chat_fila", atendimentoId),
      {
        status: estadoNovoNormalizado,
        ultimaTransicaoEm: agoraTimestamp,
        timeline: this.fStore.arrayUnion(timelineItem)
      }
    );

      console.log(`✅ Transição executada: ${estadoAnteriorNormalizado} → ${estadoNovoNormalizado}`);
      console.groupEnd();

      return {
        sucesso: true,
        estadoAnterior: estadoAnteriorNormalizado,
        estadoNovo: estadoNovoNormalizado
      };

    } catch (error) {
      console.error('❌ Erro ao executar transição:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * Verificar se estado é final (não pode mais transicionar)
   */
  ehEstadoFinal(estado) {
    if (!window.TicketStateMachine) {
      return false;
    }
    const estadoNormalizado = this.normalizarEstado(estado);
    return window.TicketStateMachine.isFinalState(estadoNormalizado);
  }

  /**
   * Obter role/permissão do usuário atual
   * Busca do sessionStorage (AuthSystem)
   */
  obterRoleUsuario() {
    const user = window.AuthSystem?.getCurrentUser();
    
    if (!user || !user.role) {
      console.warn("⚠️ Usuário não autenticado ou sem role");
      return "ATENDENTE"; // Padrão
    }
    
    return user.role;
  }

  /**
   * Validar se pode fazer ação específica
   * Retorna true/false
   */
  podeExecutarAcao(estadoAtual, acao, userRole) {
    const estadoNormalizado = this.normalizarEstado(estadoAtual);
    const transicoes = this.obterTransicoesDisponiveis(estadoNormalizado, userRole);
    
    // Mapear ações para estados
    const acaoParaEstado = {
      "iniciar_atendimento": "EM_ATENDIMENTO",
      "validar_identidade": "IDENTIDADE_VALIDADA",
      "concluir": "CONCLUIDO",
      "encaminhar": "ENCAMINHADO",
      "aguardar_cliente": "AGUARDANDO_CLIENTE"
    };

    const estadoDestino = acaoParaEstado[acao];
    return estadoDestino && transicoes.includes(estadoDestino);
  }

  /**
   * ✅ NOVO: Verificar consistência de estado
   * Útil para debug e validação
   */
  async verificarEstado(atendimentoId) {
    try {
      const { doc, getDoc } = this.fStore;
      const docSnap = await getDoc(doc(this.db, 'atend_chat_fila', atendimentoId));
      
      if (!docSnap.exists()) {
        return { valido: false, erro: 'Atendimento não encontrado' };
      }

      const data = docSnap.data();
      const statusAtual = data.status;
      const statusNormalizado = this.normalizarEstado(statusAtual);
      const ehValido = window.TicketStateMachine?.isValidState(statusNormalizado);

      console.group('🔍 VERIFICAÇÃO DE ESTADO');
      console.log('Status no Firebase:', statusAtual);
      console.log('Status Normalizado:', statusNormalizado);
      console.log('É Estado Válido?', ehValido);
      console.log('É Estado Final?', this.ehEstadoFinal(statusNormalizado));
      console.groupEnd();

      return {
        valido: ehValido,
        statusOriginal: statusAtual,
        statusNormalizado: statusNormalizado,
        ehFinal: this.ehEstadoFinal(statusNormalizado),
        dados: data
      };
    } catch (error) {
      console.error('❌ Erro ao verificar estado:', error);
      return { valido: false, erro: error.message };
    }
  }
}

// Exportar como global
window.StateMachineManager = new StateMachineManager();

console.log("✅ StateMachineManager carregado (v2 - com normalização de estados)");