/**
 * ATENDIMENTO DATA STRUCTURE MANAGER - VERSÃO CORRIGIDA
 * Gerencia IDs únicos e sincroniza estrutura de dados Firestore
 * 
 * CORREÇÕES APLICADAS:
 * ✅ Adiciona uid_cliente ao documento
 * ✅ Compatível com Firestore Rules
 * ✅ Estrutura de mensagens corrigida (campo timestamp unificado)
 */

const agora = () => window.FirebaseApp.fStore.Timestamp.now();

class AtendimentoDataStructureManager {

  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;

    // Estado global sincronizado
    this.state = {
      atendimentoId: null,
      clienteInfo: null,
      operadorInfo: null,
      statusAtual: null,
      uid_cliente: null // ✅ NOVO: UID do cliente autenticado
    };
  }

  /**
   * Gerar ID único por atendimento
   */
  gerarAtendimentoId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const atendimentoId = `ATN-${timestamp}-${random}`;

    // Salva em sessionStorage para persistir durante a sessão
    sessionStorage.setItem('atendimentoId', atendimentoId);

    this.state.atendimentoId = atendimentoId;
    console.log(`✅ Atendimento ID gerado: ${atendimentoId}`);

    return atendimentoId;
  }

  /**
   * Recupera ID existente da sessão ou gera novo
   */
  obterAtendimentoId() {
    let atendimentoId = sessionStorage.getItem('atendimentoId');

    if (!atendimentoId) {
      atendimentoId = this.gerarAtendimentoId();
    }

    this.state.atendimentoId = atendimentoId;
    return atendimentoId;
  }

  /**
   * ✅ CORRIGIDO: Criar documento com estrutura correta + uid_cliente
   * 
   * Estrutura esperada no Firestore (compatível com Rules):
   * 
   * atend_chat_fila/{atendimentoId}
   * ├── status: "novo" | "em_atendimento" | "concluido"
   * ├── uid_cliente: string (UID do Firebase Auth)
   * ├── cliente: {
   * │   nome: string,
   * │   email: string,
   * │   telefone: string,
   * │   validadoEm: timestamp | null
   * │ }
   * ├── operador: {
   * │   operador_uid: string,
   * │   nome: string,
   * │   role: string,
   * │   aceitouEm: timestamp | null
   * │   status_atendimento: "identidade_validada" | "em_atendimento" | "derivado" | "concluido" | null
   * │   tipo_de_demanda:string,
   * │   area_responsavel: string,
   * │   descrição_da_solicitação: string,
   * │   obsersações: string,
   * │ }
   * ├── atribuido_para_uid: string | null (UID do operador)
   * ├── timeline: [
   * │   { evento: string, timestamp: timestamp, usuario: string }
   * │ ]
   * ├── criadoEm: timestamp
   * ├── inicioAtendimento: timestamp | null
   * ├── finalizadoEm: timestamp | null
   * ├── ultimaMensagemEm: timestamp
   * └── mensagem/ [subcollection]
   *     └── {mensagemId}
   *         ├── autor: "cliente" | "operador" | "sistema"
   *         ├── texto: string
   *         ├── timestamp: timestamp
   *         └── uid_autor: string
   */
  async criarAtendimento(clienteInfo) {
    if (!this.state.atendimentoId) {
      this.obterAtendimentoId();
    }

    try {
      // ✅ VALIDAR uid_cliente
      if (!clienteInfo.uid_cliente) {
        throw new Error("uid_cliente é obrigatório. Cliente deve estar autenticado.");
      }

      const atendimentoData = {
        // Identificação
        atendimentoId: this.state.atendimentoId,

        // ✅ UID do cliente (OBRIGATÓRIO para Firestore Rules)
        uid_cliente: clienteInfo.uid_cliente,

        // Status (compatível com State Machine)
        status: "FILA",

        // Informações do cliente
        cliente: {
          nome: clienteInfo.nome || null,
          email: clienteInfo.email || null,
          telefone: clienteInfo.telefone || null,
          validadoEm: null
        },

        // Informações do operador (será preenchido quando aceitar)
        operador: {
          uid: null,
          nome: null,
          role: null,
          aceitouEm: null
        },

        // ✅ Campo para compatibilidade com Rules de operador
        atribuido_para_uid: null,

        // ✅ Setor responsável (pode ser definido por regra de negócio)
        setor_responsavel: clienteInfo.setor || "suporte",

        // Timeline para auditoria
        timeline: [
          {
            evento: "ticket_criado",
            timestamp: agora(),
            usuario: "cliente",
            descricao: "Novo ticket criado pelo cliente"
          }
        ],

        // Timestamps importantes
        criadoEm: agora(),
        inicioAtendimento: null,
        finalizadoEm: null,
        ultimaMensagemEm: null,

        // Metadata
        canal: "web",
        tipo: "suporte"
      };

      // Salva no Firestore
      await this.fStore.setDoc(
        this.fStore.doc(this.db, "atend_chat_fila", this.state.atendimentoId),
        atendimentoData
      );

      console.log("DEBUG Firebase:", {
        authUser: FirebaseApp.auth?.currentUser,
        uid_cliente: clienteInfo.uid_cliente,
        db: !!this.db,
        fStore: !!this.fStore
      });
      // Atualiza estado global
      this.state.clienteInfo = clienteInfo;
      this.state.statusAtual = "FILA";
      this.state.uid_cliente = clienteInfo.uid_cliente;

      console.log(`✅ Atendimento criado na FILA: ${this.state.atendimentoId}`);
      console.log(`   Cliente UID: ${clienteInfo.uid_cliente}`);

      return this.state.atendimentoId;

    } catch (error) {
      console.error("❌ Erro ao criar atendimento:", error);
      throw error;
    }
  }

  /**
   * Atualizar informações do cliente
   */
  async atualizarCliente(clienteInfo) {
    if (!this.state.atendimentoId) {
      throw new Error("Nenhum atendimento ativo");
    }

    try {
      await this.fStore.updateDoc(
        this.fStore.doc(this.db, "atend_chat_fila", this.state.atendimentoId),
        {
          "cliente.nome": clienteInfo.nome,
          "cliente.email": clienteInfo.email,
          "cliente.telefone": clienteInfo.telefone
        }
      );

      this.state.clienteInfo = clienteInfo;
      console.log("✅ Cliente atualizado");
    } catch (error) {
      console.error("❌ Erro ao atualizar cliente:", error);
      throw error;
    }
  }

  /**
   * Atualizar status do atendimento
   */
  async atualizarStatus(novoStatus, usuarioId = null, descricao = null) {
    if (!this.state.atendimentoId) {
      throw new Error("Nenhum atendimento ativo");
    }

    try {
      const timelineItem = {
        evento: `status_${novoStatus}`,
        timestamp: agora(),
        usuario: usuarioId || "sistema",
        statusAnterior: this.state.statusAtual,
        statusNovo: novoStatus,
        descricao: descricao || `Status alterado para ${novoStatus}`
      };

      await this.fStore.updateDoc(
        this.fStore.doc(this.db, "atend_chat_fila", this.state.atendimentoId),
        {
          status: novoStatus,
          timeline: this.fStore.arrayUnion(timelineItem),
          ultimaMensagemEm: agora()
        }
      );

      this.state.statusAtual = novoStatus;
      console.log(`✅ Status atualizado para: ${novoStatus}`);
    } catch (error) {
      console.error("❌ Erro ao atualizar status:", error);
      throw error;
    }
  }

  /**
   * ✅ CORRIGIDO: Quando operador aceita o atendimento
   * Status vai para "NOVO" para seguir fluxo da State Machine
   *
  async operadorAceitaAtendimento(operadorInfo) {
    if (!this.state.atendimentoId) {
      throw new Error("Nenhum atendimento ativo");
    }

    try {
      // ✅ Validar UID do operador
      if (!operadorInfo.atribuido_para_uid) {
        throw new Error("UID do operador é obrigatório");
      }

      await this.fStore.updateDoc(
        this.fStore.doc(this.db, "atend_chat_fila", this.state.atendimentoId),
        {
          status: "NOVO", // ✅ CORRIGIDO: Inicia no estado NOVO para validação de identidade
          "operador.uid": operadorInfo.atribuido_para_uid,
          "operador.nome": operadorInfo.nome,
          "operador.role": operadorInfo.role,
          "operador.aceitouEm": agora(),
          atribuido_para_uid: operadorInfo.atribuido_para_uid, // ✅ Campo para Rules
          atribuido_em: agora(),
          timeline: this.fStore.arrayUnion({
            evento: "operador_aceitou",
            timestamp: agora(),
            usuario: operadorInfo.atribuido_para_uid,
            descricao: `Operador ${operadorInfo.nome} aceitou o atendimento`
          })
        }
      );

      this.state.operadorInfo = operadorInfo;
      this.state.statusAtual = "NOVO";

      console.log(`✅ Operador ${operadorInfo.nome} aceitou atendimento (status: NOVO)`);
    } catch (error) {
      console.error("❌ Erro ao operador aceitar:", error);
      throw error;
    }
  }
*/
  //nova função operadorAceitaAtendimento corrigida - se não funcionar volta a anterior comentado acima
  /* ✅ NOVO: Quando operador aceita o atendimento
  * Transição: FILA → NOVO
  */
 
  async operadorAceitaAtendimento(operadorInfo) {

  if (!this.state.atendimentoId) {
    throw new Error("Nenhum atendimento ativo");
  }

  try {
    // ✅ 1. Validar transição usando State Machine
    const validacao = window.StateMachineManager?.validarTransicao(
      "FILA",
      "NOVO",
      operadorInfo.role || "ATENDENTE"
    );

    if (!validacao?.valido) {
      throw new Error(validacao.erro);
    }

    // ✅ 2. Executar transição com State Machine
    await window.StateMachineManager?.executarTransicao(
      this.state.atendimentoId,
      "FILA",
      "NOVO",
      `Operador ${operadorInfo.nome} aceitou o atendimento`
    );


    // ✅ 3. Atualizar informações do operador
    const user = window.AuthSystem?.getCurrentUser();
    
    const timelineItem = {
      evento: "operador_aceitou",
      timestamp: agora(),
      usuario: operadorInfo.atribuido_para_uid || user.uid,
      descricao: `Operador ${operadorInfo.nome} aceitou o atendimento`
    };
    
    // ✅ 4. Atualizar documento no Firestore
    await this.fStore.updateDoc(
      this.fStore.doc(this.db, "atend_chat_fila", this.state.atendimentoId),
      {
        "operador.uid": operadorInfo.atribuido_para_uid,
        "operador.nome": operadorInfo.nome,
        "operador.role": operadorInfo.role,
        "operador.aceitouEm": agora(),
        atribuido_para_uid: operadorInfo.atribuido_para_uid,
        atribuido_em: agora(),
        timeline: this.fStore.arrayUnion(timelineItem)
        }
      );
      
    this.state.operadorInfo = operadorInfo;
    this.state.statusAtual = "NOVO";

    console.log(`✅ Operador ${operadorInfo.nome} aceitou atendimento (FILA → NOVO)`);
  } catch (error) {
    console.error("❌ Erro ao operador aceitar:", error);
    throw error;
  }
};

/**
   * Validar identidade do cliente
   */
  async validarIdentidadeCliente() {
  if (!this.state.atendimentoId) {
    throw new Error("Nenhum atendimento ativo");
  }

  try {
    await this.fStore.updateDoc(
      this.fStore.doc(this.db, "atend_chat_fila", this.state.atendimentoId),
      {
        status: "identidade_validada",
        "cliente.validadoEm": agora(),
        timeline: this.fStore.arrayUnion({
          evento: "identidade_validada",
          timestamp: agora(),
          usuario: "cliente",
          descricao: "Identidade do cliente validada"
        })
      }
    );

    this.state.statusAtual = "identidade_validada";
    console.log("✅ Identidade validada");
  } catch (error) {
    console.error("❌ Erro ao validar identidade:", error);
    throw error;
  }
}

  /**
   * Finalizar atendimento
   */
  async finalizarAtendimento(justificativa = null) {
  if (!this.state.atendimentoId) {
    throw new Error("Nenhum atendimento ativo");
  }

  try {
    await this.fStore.updateDoc(
      this.fStore.doc(this.db, "atend_chat_fila", this.state.atendimentoId),
      {
        status: "concluido",
        finalizadoEm: agora(),
        timeline: this.fStore.arrayUnion({
          evento: "atendimento_finalizado",
          timestamp: agora(),
          usuario: this.state.operadorInfo?.uid || "cliente",
          descricao: justificativa || "Atendimento finalizado"
        })
      }
    );

    this.state.statusAtual = "concluido";
    console.log("✅ Atendimento finalizado");
  } catch (error) {
    console.error("❌ Erro ao finalizar atendimento:", error);
    throw error;
  }
}

/**
 * Obter estado global sincronizado
 */
obterEstadoGlobal() {
  return {
    atendimentoId: this.state.atendimentoId,
    statusAtual: this.state.statusAtual,
    cliente: this.state.clienteInfo,
    operador: this.state.operadorInfo,
    uid_cliente: this.state.uid_cliente,
    timestamp: new Date().toISOString()
  };
}

/**
 * Sincronizar estado global em tempo real
 */
sincronizarEstado(callback) {
  if (!this.state.atendimentoId) {
    console.warn("⚠️ Nenhum atendimento para sincronizar");
    return null;
  }

  const docRef = this.fStore.doc(
    this.db,
    "atend_chat_fila",
    this.state.atendimentoId
  );

  return this.fStore.onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      const dados = doc.data();

      // Atualizar estado local
      this.state.statusAtual = dados.status;
      this.state.clienteInfo = dados.cliente;
      this.state.operadorInfo = dados.operador;
      this.state.uid_cliente = dados.uid_cliente;

      // Chamar callback com dados atualizados
      if (callback) {
        callback({
          atendimentoId: this.state.atendimentoId,
          ...dados
        });
      }
    }
  });
}

/**
 * Limpar dados da sessão
 */
limparSessao() {
  sessionStorage.removeItem('atendimentoId');
  this.state = {
    atendimentoId: null,
    clienteInfo: null,
    operadorInfo: null,
    statusAtual: null,
    uid_cliente: null
  };
  console.log("✅ Sessão limpa");
}
}

// Exportar como global
window.AtendimentoDataStructure = new AtendimentoDataStructureManager();

console.log("✅ AtendimentoDataStructureManager CORRIGIDO carregado");