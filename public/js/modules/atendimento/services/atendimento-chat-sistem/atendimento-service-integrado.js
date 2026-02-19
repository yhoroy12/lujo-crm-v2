/**
 * ATENDIMENTO SERVICE INTEGRADO
 * Integra todos os managers em um único fluxo funcional
 * 
 * Conecta:
 * - AtendimentoDataStructure (IDs, estrutura, estado)
 * - RealtimeListenersManager (listeners real-time)
 * - StateMachineManager (validação de estados)
 * - NovoClienteNotificacaoManager (pop-up e notificações)
 * 
 * Soluciona todos os 6 problemas em uma única interface
 */

class AtendimentoServiceIntegrado {
  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;
    this.auth = window.FirebaseApp?.auth;

    // Referências aos managers
    this.dataStructure = window.AtendimentoDataStructure;
    this.listeners = window.RealtimeListenersManager;
    this.stateMachine = window.StateMachineManager;
    this.notificacao = window.NovoClienteNotificacaoManager;

    // Estado
    this.atendimentoAtivo = null;
  }

  /**
   * ========================================================
   * FLUXO CLIENTE: Iniciar atendimento
   * ========================================================
   */
  async clienteIniciarAtendimento(dadosCliente) {
    try {
      console.log("👤 Cliente iniciando atendimento...");

      // 1. Gerar ID único
      const atendimentoId = this.dataStructure.gerarAtendimentoId();

      // 2. Criar documento no Firestore com estrutura correta
      await this.dataStructure.criarAtendimento(dadosCliente);

      // 3. Escutar mudanças de status (para saber quando operador aceitar)
      this.listeners.escutarStatusAtendimento(
        atendimentoId,
        (dados) => this.onStatusMudou(dados)
      );

      // 4. Validar identidade (opcional, depende do seu fluxo)
      // await this.dataStructure.validarIdentidadeCliente();

      console.log("✓ Cliente pronto. Aguardando operador...");
      return atendimentoId;
    } catch (error) {
      console.error("❌ Erro ao iniciar atendimento:", error);
      throw error;
    }
  }

  /**
   * ========================================================
   * FLUXO OPERADOR: Inicializar (deve ser chamado ao carregar página)
   * ========================================================
   */
  async operadorInicializar() {
    try {
      console.log("👨‍💼 Operador inicializando...");

      // Verificar autenticação
      if (!this.auth?.currentUser) {
        throw new Error("Operador não autenticado");
      }

      console.log(`✓ Operador autenticado: ${this.auth.currentUser.email}`);

      // 1. Escutar fila de clientes
      this.listeners.escutarFilaClientes((novoCliente) => {
        this.onNovoClienteFila(novoCliente);
      });

      // 2. Escutar operadores disponíveis (para rotear)
      this.listeners.escutarOperadoresDisponiveis((operadores) => {
        console.log(`Operadores disponíveis: ${operadores.length}`);
      });

      console.log("✓ Operador pronto para receber clientes");
    } catch (error) {
      console.error("❌ Erro ao inicializar operador:", error);
      throw error;
    }
  }

  /**
   * ========================================================
   * CALLBACK: Novo cliente na fila
   * ========================================================
   * 
   * Chamado quando escutarFilaClientes detecta novo documento
   * com status="fila"
   */
  async onNovoClienteFila(dadosCliente) {
    console.log("🔔 NOVO CLIENTE NA FILA:", dadosCliente);

    // Mostrar pop-up com opção de aceitar/rejeitar
    this.notificacao.mostrarNotificacao(
      dadosCliente,
      // Callback: Aceitar
      async (cliente) => {
        await this.operadorAceitarAtendimento(cliente);
      },
      // Callback: Rejeitar
      async (cliente) => {
        await this.operadorRejeitarAtendimento(cliente);
      }
    );
  }

  /**
   * ========================================================
   * FLUXO OPERADOR: Aceitar atendimento
   * ========================================================
   */
  async operadorAceitarAtendimento(dadosCliente) {
    try {
      const atendimentoId = dadosCliente.atendimentoId;
      console.log(`✓ Operador aceitando atendimento: ${atendimentoId}`);

      // 1. Validar transição de estado (FILA → NOVO)
      const userRole = localStorage.getItem('userRole') || "ATENDENTE";
      const validacao = this.stateMachine.validarTransicao(
        "FILA",
        "NOVO",
        userRole
      );

      if (!validacao.valido) {
        this.notificacao.mostrarToast(validacao.erro, 'error');
        return;
      }

      // 2. Executar transição com auditoria
      await this.stateMachine.executarTransicao(
        atendimentoId,
        "NOVO",
        "EM_ATENDIMENTO",
        `Atendimento aceito por ${this.auth?.currentUser?.displayName || 'Operador'}`
      );

      // 3. Atualizar informações do operador
      const operadorInfo = {
        uid: this.auth.currentUser.uid,
        nome: this.auth.currentUser.displayName || "Operador",
        role: userRole
      };

      await this.dataStructure.operadorAceitaAtendimento(operadorInfo);

      // 4. Escutar mensagens do cliente
      this.listeners.escutarMensagens(
        atendimentoId,
        (msg) => this.onMensagemChegou(msg)
      );

      // 5. Atualizar atendimento ativo
      this.atendimentoAtivo = atendimentoId;

      // 6. Feedback visual
      this.notificacao.mostrarToast("Atendimento aceito! Chat aberto.", 'success');

      // 7. Disparar evento customizado (para sua UI abrir chat)
      window.dispatchEvent(new CustomEvent('atendimentoAceito', {
        detail: { atendimentoId, cliente: dadosCliente }
      }));

      console.log("✓ Atendimento aceito com sucesso");
    } catch (error) {
      console.error("❌ Erro ao aceitar atendimento:", error);
      this.notificacao.mostrarToast("Erro ao aceitar atendimento", 'error');
    }
  }

  /**
   * ========================================================
   * FLUXO OPERADOR: Rejeitar atendimento
   * ========================================================
   */
  async operadorRejeitarAtendimento(dadosCliente) {
    try {
      const atendimentoId = dadosCliente.atendimentoId;
      console.log(`❌ Operador rejeitando atendimento: ${atendimentoId}`);

      // Apenas mudar status para rejeitado
      // (Não implementar transição formal, apenas marcar para próximo)
      await this.fStore.updateDoc(
        this.fStore.doc(this.db, "atend_chat_fila", atendimentoId),
        {
          rejeitadoPor: {
            uid: this.auth.currentUser.uid,
            nome: this.auth.currentUser.displayName
          },
          rejeitadoEm: this.fStore.serverTimestamp()
        }
      );

      this.notificacao.mostrarToast(
        "Atendimento rejeitado. Será oferecido a outro operador.",
        'info'
      );

      console.log("✓ Atendimento rejeitado");
    } catch (error) {
      console.error("❌ Erro ao rejeitar atendimento:", error);
    }
  }

  /**
   * ========================================================
   * CALLBACK: Status mudou
   * ========================================================
   * 
   * Chamado quando status do atendimento muda
   * Cliente usa para saber quando foi aceito
   * Operador usa para ver mudanças
   */
  async onStatusMudou(dados) {
    console.log("📊 Status mudou para:", dados.status);

    switch (dados.status) {
      case "em_atendimento":
        console.log("✓ Chat iniciado com sucesso");
        // Cliente abre chat automaticamente
        window.dispatchEvent(new CustomEvent('chatAberto', {
          detail: { atendimentoId: dados.atendimentoId }
        }));
        break;

      case "concluido":
        console.log("✓ Atendimento concluído");
        // Limpar listeners
        this.listeners.limparListener('statusAtendimento');
        this.listeners.limparListener('mensagens');
        // Evento para fechar chat
        window.dispatchEvent(new CustomEvent('atendimentoConcluido', {
          detail: { atendimentoId: dados.atendimentoId }
        }));
        break;
    }
  }

  /**
   * ========================================================
   * CALLBACK: Nova mensagem chegou
   * ========================================================
   */
  async onMensagemChegou(msg) {
    console.log("💬 Nova mensagem:", msg);
    // Renderizar na UI do chat
    window.dispatchEvent(new CustomEvent('novaMensagem', {
      detail: msg
    }));
  }

  /**
   * ========================================================
   * ENVIAR MENSAGEM (Cliente ou Operador)
   * ========================================================
   */
  async enviarMensagem(texto, autor) {
    if (!this.atendimentoAtivo) {
      console.warn("⚠️ Nenhum atendimento ativo");
      return;
    }

    try {
      await this.fStore.addDoc(
        this.fStore.collection(
          this.db,
          "atend_chat_fila",
          this.atendimentoAtivo,
          "mensagem"
        ),
        {
          autor: autor, // "cliente" ou "operador"
          texto: texto,
          timestamp: this.fStore.serverTimestamp(), // ✅ CORRIGIDO: campo unificado 'timestamp'
          uid_autor: this.auth?.currentUser?.uid || null
        }
      );

      console.log(`✓ Mensagem enviada (${autor})`);
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error);
      throw error;
    }
  }

  /**
   * ========================================================
   * FINALIZAR ATENDIMENTO
   * ========================================================
   */
  async finalizarAtendimento(justificativa = null) {
    if (!this.atendimentoAtivo) {
      console.warn("⚠️ Nenhum atendimento ativo");
      return;
    }

    try {
      // 1. Validar transição
      const userRole = localStorage.getItem('userRole') || "ATENDENTE";
      const validacao = this.stateMachine.validarTransicao(
        "EM_ATENDIMENTO",
        "CONCLUIDO",
        userRole
      );

      if (!validacao.valido) {
        throw new Error(validacao.erro);
      }

      // 2. Executar com auditoria
      await this.stateMachine.executarTransicao(
        this.atendimentoAtivo,
        "EM_ATENDIMENTO",
        "CONCLUIDO",
        justificativa
      );

      // 3. Atualizar data/hora de conclusão
      await this.dataStructure.finalizarAtendimento(justificativa);

      // 4. Limpar
      this.atendimentoAtivo = null;
      this.listeners.limparTodosListeners();

      console.log("✓ Atendimento finalizado");
    } catch (error) {
      console.error("❌ Erro ao finalizar:", error);
      throw error;
    }
  }

  /**
   * ========================================================
   * OBTER ESTADO ATUAL
   * ========================================================
   */
  obterEstadoAtual() {
    return {
      atendimentoAtivo: this.atendimentoAtivo,
      estadoGlobal: this.dataStructure.obterEstadoGlobal(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * ========================================================
   * LIMPEZA COMPLETA
   * ========================================================
   */
  limpar() {
    this.listeners.limparTodosListeners();
    this.dataStructure.limparSessao();
    this.atendimentoAtivo = null;
    console.log("✓ Limpeza completa realizada");
  }
}

// Exportar como global
window.AtendimentoServiceIntegrado = new AtendimentoServiceIntegrado();

console.log("✅ AtendimentoServiceIntegrado carregado");
