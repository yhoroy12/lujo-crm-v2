/**
 * REALTIME LISTENERS MANAGER
 * Gerencia todos os listeners de tempo real sincronizados
 * 
 * Soluciona:
 * - PROBLEMA 3: Listeners (real-time) incompletos
 * - PROBLEMA 6: Sincronização de estado global
 */

class RealtimeListenersManager {
  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;

    // Armazenar unsubscribe functions para limpeza depois
    this.unsubscribers = {
      filaClientes: null,
      statusAtendimento: null,
      mensagens: null,
      statusOperador: null
    };

    // Callbacks customizáveis
    this.callbacks = {
      onNovoClienteFila: null,
      onStatusMudou: null,
      onMensagemChegou: null,
      onOperadorMudouStatus: null
    };
  }

  /**
   * ========================================================
   * PARA OPERADOR: Escutar fila de clientes aguardando
   * ========================================================
   * 
   * Quando um cliente entra em "fila", operador é notificado
   * Isto dispara o POP-UP de notificação
   */
  escutarFilaClientes(callback) {
  try {
    if (!this.db || !this.fStore) {
      console.error("❌ Firebase não configurado");
      return;
    }

    if (this.unsubscribers.filaClientes) {
      this.unsubscribers.filaClientes();
    }

    const filaRef = this.fStore.collection(this.db, "atend_chat_fila");

    // ✅ Ordenado por prioridade e chegada
    const q = this.fStore.query(
      filaRef,
      this.fStore.where("status", "==", "FILA"),
      this.fStore.orderBy("prioridade_peso", "asc"),
      this.fStore.orderBy("criadoEm", "asc")
    );

    this.unsubscribers.filaClientes = this.fStore.onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const atendimentoData = change.doc.data();

          if (change.type === "added") {
            // Novo cliente entrou na fila
            console.log("🔔 NOVO CLIENTE NA FILA:", change.doc.id);
            if (this.callbacks.onNovoClienteFila) {
              this.callbacks.onNovoClienteFila({
                atendimentoId: change.doc.id,
                ...atendimentoData
              });
            }
          } else if (change.type === "removed") {
            // Um cliente saiu da fila — verificar se há próximo
            console.log("👋 Cliente saiu da fila, verificando próximo...");
            this._verificarProximoNaFila(snapshot);
          }
        });
      },
      (error) => {
        console.error("❌ Erro ao escutar fila:", error);
      }
    );

    console.log("✓ Escutando fila de clientes");
  } catch (error) {
    console.error("❌ Erro ao inicializar listener de fila:", error);
  }
}

_verificarProximoNaFila(snapshot) {
  if (snapshot.empty) {
    console.log('Fila vazia.');
    return;
  }

  // Ordenar localmente como proteção extra contra timing da Cloud Function
  const docs = snapshot.docs.slice().sort((a, b) => {
    const pesoA = a.data().prioridade_peso ?? 99;
    const pesoB = b.data().prioridade_peso ?? 99;
    if (pesoA !== pesoB) return pesoA - pesoB;
    const tsA = a.data().criadoEm?.seconds ?? 0;
    const tsB = b.data().criadoEm?.seconds ?? 0;
    return tsA - tsB;
  });

  const proximoDoc = docs[0];
  const dados = proximoDoc.data();

  console.log(`➡️ Próximo: ${proximoDoc.id} | Classe: ${dados.classe_cliente} | Peso: ${dados.prioridade_peso}`);

  if (this.callbacks.onNovoClienteFila) {
    this.callbacks.onNovoClienteFila({
      atendimentoId: proximoDoc.id,
      ...dados
    });
  }
}

  /**
   * ========================================================
   * CLIENTE OU OPERADOR: Escutar mudanças de status
   * ========================================================
   * 
   * Ambos precisam saber quando o status muda:
   * - Cliente: para abrir chat quando aceitar
   * - Operador: para renderizar novo cliente no painel
   */
  escutarStatusAtendimento(atendimentoId, callback) {
    try {
      if (!atendimentoId) {
        console.warn("⚠️ atendimentoId não fornecido");
        return;
      }

      // Desinscrever anterior
      if (this.unsubscribers.statusAtendimento) {
        this.unsubscribers.statusAtendimento();
      }

      const docRef = this.fStore.doc(
        this.db,
        "atend_chat_fila",
        atendimentoId
      );

      // Listener real-time
      this.unsubscribers.statusAtendimento = this.fStore.onSnapshot(
        docRef,
        (doc) => {
          if (doc.exists()) {
            const dados = doc.data();
            console.log("📊 Status atualizado:", dados.status);

            // Chamar callback
            if (callback) {
              callback({
                atendimentoId: doc.id,
                status: dados.status,
                cliente: dados.cliente,
                operador: dados.operador,
                timestamp: new Date()
              });
            }

            // Também chamar callback global se registrado
            if (this.callbacks.onStatusMudou) {
              this.callbacks.onStatusMudou({
                atendimentoId: doc.id,
                ...dados
              });
            }
          }
        },
        (error) => {
          console.error("❌ Erro ao escutar status:", error);
        }
      );

      console.log(`✓ Escutando status de ${atendimentoId}`);
    } catch (error) {
      console.error("❌ Erro ao inicializar listener de status:", error);
    }
  }

  /**
   * ========================================================
   * CLIENTE OU OPERADOR: Escutar mensagens em tempo real
   * ========================================================
   * 
   * Sincroniza mensagens bidirecional:
   * - Cliente envia → Operador recebe
   * - Operador envia → Cliente recebe
   */
  escutarMensagens(atendimentoId, callback) {
    try {
      if (!atendimentoId) {
        console.warn("⚠️ atendimentoId não fornecido");
        return;
      }

      // Desinscrever anterior
      if (this.unsubscribers.mensagens) {
        this.unsubscribers.mensagens();
      }

      const mensagensRef = this.fStore.collection(
        this.db,
        "atend_chat_fila",
        atendimentoId,
        "mensagem"
      );

      // Query: ordenar por timestamp (mais antigas primeiro)
      const q = this.fStore.query(
        mensagensRef,
        this.fStore.orderBy("enviado_em", "asc")
      );

      // Listener real-time
      this.unsubscribers.mensagens = this.fStore.onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const msgData = change.doc.data();

            // Tipo "added" = nova mensagem chegou
            if (change.type === "added") {
              console.log("💬 Nova mensagem:", msgData);

              // Chamar callback
              if (callback) {
                callback({
                  id: change.doc.id,
                  ...msgData
                });
              }

              // Callback global
              if (this.callbacks.onMensagemChegou) {
                this.callbacks.onMensagemChegou({
                  id: change.doc.id,
                  ...msgData
                });
              }
            }
          });
        },
        (error) => {
          console.error("❌ Erro ao escutar mensagens:", error);
        }
      );

      console.log(`✓ Escutando mensagens de ${atendimentoId}`);
    } catch (error) {
      console.error("❌ Erro ao inicializar listener de mensagens:", error);
    }
  }

  /**
   * ========================================================
   * SISTEMA: Escutar disponibilidade de operadores
   * ========================================================
   * 
   * Verificar quais operadores estão DISPONÍVEL
   * para rotear novo cliente corretamente
   */
  escutarOperadoresDisponiveis(callback) {
    try {
      if (!this.db || !this.fStore) {
        console.error("❌ Firebase não configurado");
        return;
      }

      // Query: buscar operadores com status DISPONIVEL
      const operadoresRef = this.fStore.collection(
        this.db,
        "operadores_ativos"
      );

      const q = this.fStore.query(
        operadoresRef,
        this.fStore.where("statusAtual", "==", "DISPONIVEL"),
        this.fStore.orderBy("ultimaAtualizacao", "desc")
      );

      // Listener real-time
      this.unsubscribers.statusOperador = this.fStore.onSnapshot(
        q,
        (snapshot) => {
          const operadores = [];

          snapshot.forEach((doc) => {
            operadores.push({
              uid: doc.id,
              ...doc.data()
            });
          });

          console.log(`✓ Operadores disponíveis: ${operadores.length}`);

          if (callback) {
            callback(operadores);
          }

          if (this.callbacks.onOperadorMudouStatus) {
            this.callbacks.onOperadorMudouStatus(operadores);
          }
        },
        (error) => {
          console.error("❌ Erro ao escutar operadores:", error);
        }
      );

      console.log("✓ Escutando operadores disponíveis");
    } catch (error) {
      console.error("❌ Erro ao inicializar listener de operadores:", error);
    }
  }

  /**
   * ========================================================
   * Registrar callbacks customizáveis
   * ========================================================
   */
  registrarCallback(evento, funcao) {
    if (this.callbacks.hasOwnProperty(`on${evento}`)) {
      this.callbacks[`on${evento}`] = funcao;
      console.log(`✓ Callback registrado: on${evento}`);
    } else {
      console.warn(`⚠️ Evento desconhecido: ${evento}`);
    }
  }

  /**
   * ========================================================
   * Limpar todos os listeners
   * ========================================================
   */
  limparTodosListeners() {
    Object.keys(this.unsubscribers).forEach((key) => {
      if (this.unsubscribers[key]) {
        this.unsubscribers[key]();
        this.unsubscribers[key] = null;
      }
    });

    // Limpar callbacks
    this.callbacks = {
      onNovoClienteFila: null,
      onStatusMudou: null,
      onMensagemChegou: null,
      onOperadorMudouStatus: null
    };

    console.log("✓ Todos os listeners desativados");
  }

  /**
   * Limpar listener específico
   */
  limparListener(tipoListener) {
    if (this.unsubscribers[tipoListener]) {
      this.unsubscribers[tipoListener]();
      this.unsubscribers[tipoListener] = null;
      console.log(`✓ Listener ${tipoListener} desativado`);
    }
  }
}

// Exportar como global
window.RealtimeListenersManager = new RealtimeListenersManager();

console.log("✅ RealtimeListenersManager carregado");