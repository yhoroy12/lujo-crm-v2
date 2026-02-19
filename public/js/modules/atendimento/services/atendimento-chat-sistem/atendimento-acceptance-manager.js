/**
 * ATENDIMENTO ACCEPTANCE MANAGER
 * 
 * Responsável por:
 * ✅ Aceitar atendimento com transação atômica (runTransaction)
 * ✅ Prevenir race condition (dois operadores aceitando o mesmo)
 * ✅ Verificar disponibilidade do operador (max 1 ativo por canal)
 * ✅ Retornar erro controlado se não permitido
 * 
 * FLUXO SEGURO:
 * 1. Validar se operador pode aceitar (pré-flight)
 * 2. Tentar aceitar com transaction
 * 3. Se falhar, não tomar posse
 * 4. Se sucesso, monitorar em tempo real
 */

class AtendimentoAcceptanceManager {
  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;
    this.auth = window.FirebaseApp?.auth;

    // Estado local do operador
    this.operadorUid = null;
    this.atendimentoAtivoId = null;
    this.atendimentoAtivoCanal = null; // 'whatsapp' ou 'email'

    // Listeners de monitoramento
    this.unsubscribeMonitor = null;
  }

  /**
   * ========================================================
   * PRÉ-FLIGHT CHECK
   * ========================================================
   * Validações rápidas ANTES de chamar transação
   * (economiza uma falha de transação)
   */
  async validarAntesDeAceitar(atendimentoId, canal = 'whatsapp') {
    // 1. Validar autenticação
    if (!this.auth?.currentUser) {
      return {
        valido: false,
        erro: '❌ Operador não autenticado',
        codigo: 'NOT_AUTHENTICATED'
      };
    }

    this.operadorUid = this.auth.currentUser.uid;

    // 2. Validar se já tem atendimento ativo no mesmo canal
    try {
      const temAtivoMesmoCanal = await this.verificarAtendimentoAtivoNoCanal(canal);

      if (temAtivoMesmoCanal) {
        return {
          valido: false,
          erro: `❌ Você já tem um atendimento ativo em ${canal}. Finalize-o antes de aceitar outro.`,
          codigo: 'ALREADY_HAS_ACTIVE',
          atendimentoAtivo: temAtivoMesmoCanal.id,
          detalhe: temAtivoMesmoCanal
        };
      }
    } catch (error) {
      console.error('⚠️ Erro ao verificar atendimento ativo:', error);
      return {
        valido: false,
        erro: 'Erro ao validar disponibilidade. Tente novamente.',
        codigo: 'VALIDATION_ERROR',
        erro_interno: error.message
      };
    }

    // 3. Validar se documento existe e está em status "novo"
    try {
      const { getDoc, doc } = this.fStore;
      const docRef = doc(this.db, 'atend_chat_fila', atendimentoId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          valido: false,
          erro: '❌ Atendimento não encontrado',
          codigo: 'NOT_FOUND'
        };
      }

      const data = docSnap.data();

      if (data.status !== 'novo' && data.status !== 'fila') {
        return {
          valido: false,
          erro: `❌ Atendimento não está mais disponível (status: ${data.status})`,
          codigo: 'NOT_AVAILABLE',
          statusAtual: data.status
        };
      }

    } catch (error) {
      console.error('⚠️ Erro ao buscar documento:', error);
      return {
        valido: false,
        erro: 'Erro ao validar atendimento. Tente novamente.',
        codigo: 'FETCH_ERROR',
        erro_interno: error.message
      };
    }

    return { valido: true };
  }

  /**
   * ========================================================
   * ACEITAR ATENDIMENTO COM TRANSACTION
   * ========================================================
   * Fluxo atômico que garante que APENAS um operador
   * consegue tomar posse do atendimento
   */
  async aceitarAtendimento(atendimentoId, canal = 'whatsapp') {
    console.log(`🔄 Iniciando aceite de ${atendimentoId} (${canal})`);

    // 1. PRÉ-FLIGHT CHECK
    const validacao = await this.validarAntesDeAceitar(atendimentoId, canal);
    if (!validacao.valido) {
      console.error('❌ Validação falhou:', validacao.erro);
      return validacao; // Retorna objeto com erro controlado
    }

    // 2. TRANSACTION: Aceitar atomicamente
    try {
      const docRef = this.fStore.doc(this.db, 'atend_chat_fila', atendimentoId);
      // Executar transação
      const resultado = await this.fStore.runTransaction(this.db, async (transaction) => {
        // LEITURA: Buscar status atual dentro da transação
        const docSnap = await transaction.get(docRef);

        if (!docSnap.exists()) {
          throw new Error('ATENDIMENTO_DELETADO');
        }

        const data = docSnap.data();
        if (data.status !== 'FILA') {
          throw new Error(`STATUS_MUDOU_${data.status}`);
        }

        // VALIDAÇÃO: Status deve ser "novo" ou "fila"
        // Se mudou para "em_atendimento" ou outro, significa que outro operador pegou
        const validacao = window.StateMachineManager?.validarTransicao(
        'FILA',
        'NOVO',
        window.AuthSystem?.getCurrentUser()?.role || 'ATENDENTE'
        );

        if (!validacao?.valido) {
        throw new Error(`TRANSICAO_INVALIDA: ${validacao?.erro}`);
        }

        // Se já tem alguém responsável, significa que outro operador pegou
        if (data.atribuido_para_uid && data.atribuido_para_uid !== this.operadorUid) {
          throw new Error('JA_ATRIBUIDO');
        }

        // ESCRITA: Tomar posse atomicamente
        const agora = window.FirebaseApp?.fStore.Timestamp.now();

        transaction.update(docRef, {
          status: 'NOVO',
          atribuido_para_uid: this.operadorUid,
          canal: canal,
          puxado_em: agora,
          'operador.uid': this.operadorUid,
          'operador.nome': window.AuthSystem?.getCurrentUser()?.name || 'Operador',
          'operador.role': window.AuthSystem?.getCurrentUser()?.role || 'OPERADOR',
          'operador.aceitouEm': agora,
          timeline: this.fStore.arrayUnion({
            evento: 'operador_aceitou',
            timestamp: agora,
            usuario: this.operadorUid,
            descricao: `Operador aceitou atendimento via ${canal}`
          })
        });

        return {
          sucesso: true,
          atendimentoId,
          operadorUid: this.operadorUid
        };
      });

      // 3. SUCESSO: Salvar estado local e monitorar
      this.atendimentoAtivoId = atendimentoId;
      this.atendimentoAtivoCanal = canal;

      // Salvar em sessionStorage para recuperação
      sessionStorage.setItem('atendimento_ativo_whatsapp', JSON.stringify({
        atendimentoId,
        canal,
        operadorUid: this.operadorUid,
        aceitoEm: new Date().toISOString()
      }));

      // Começar a monitorar em tempo real
      this.monitorarAtendimento(atendimentoId);

      console.log(`✅ Atendimento aceito: ${atendimentoId}`);

      return {
        sucesso: true,
        atendimentoId,
        operadorUid: this.operadorUid,
        mensagem: 'Atendimento aceito com sucesso!'
      };

    } catch (error) {
      console.error('❌ Erro na transação:', error);

      // Mapear erro de transação para mensagem amigável
      let errorObj = {
        sucesso: false,
        atendimentoId,
        erro: 'Erro ao aceitar atendimento. Tente novamente.',
        codigo: 'TRANSACTION_ERROR'
      };

      if (error.message.includes('STATUS_MUDOU')) {
        errorObj.erro = '❌ Atendimento foi aceito por outro operador';
        errorObj.codigo = 'RACE_CONDITION_PERDIDA';
      } else if (error.message === 'JA_ATRIBUIDO') {
        errorObj.erro = '❌ Atendimento já está com outro operador';
        errorObj.codigo = 'JA_ATRIBUIDO';
      } else if (error.message === 'ATENDIMENTO_DELETADO') {
        errorObj.erro = '❌ Atendimento foi removido';
        errorObj.codigo = 'NOT_FOUND';
      } else if (error.message.includes('PERMISSION_DENIED')) {
        errorObj.erro = '❌ Sem permissão. Verifique suas credenciais.';
        errorObj.codigo = 'PERMISSION_DENIED';
      }

      return errorObj;
    }
  }

  /**
   * ========================================================
   * VERIFICAR DISPONIBILIDADE
   * ========================================================
   * Busca se operador já tem atendimento ativo no canal
   * Retorna: null se disponível, ou {id, status} se tem ativo
   */
  async verificarAtendimentoAtivoNoCanal(canal = 'whatsapp') {
    try {
      const { collection, query, where, getDocs, limit } = this.fStore;

      const q = query(
        collection(this.db, 'atend_chat_fila'),
        where('status', '==', 'EM_ATENDIMENTO'),
        where('atribuido_para_uid', '==', this.operadorUid),
        where('canal', '==', canal),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null; // Disponível
      }

      // Retornar dados do atendimento ativo
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };

    } catch (error) {
      console.error('⚠️ Erro ao verificar disponibilidade:', error);
      throw error;
    }
  }

  /**
   * ========================================================
   * MONITORAR ATENDIMENTO EM TEMPO REAL
   * ========================================================
   * Listener para detectar se:
   * - Atendimento foi transferido
   * - Atendimento foi finalizado
   * - Atendimento foi removido
   * 
   * Se perder a posse, desconectar e notificar UI
   */
  monitorarAtendimento(atendimentoId) {
    if (this.unsubscribeMonitor) {
      this.unsubscribeMonitor();
    }

    try {
      const { doc, onSnapshot } = this.fStore;
      const docRef = doc(this.db, 'atend_chat_fila', atendimentoId);

      this.unsubscribeMonitor = onSnapshot(
        docRef,
        (docSnap) => {
          if (!docSnap.exists()) {
            // Atendimento foi deletado
            console.warn('⚠️ Atendimento foi deletado/removido');
            this.onPerdeuPosse('DELETADO');
            return;
          }

          const data = docSnap.data();

          // 1. Verificar se perdeu a posse (outro operador pegou)
          if (
            data.atribuido_para_uid &&
            data.atribuido_para_uid !== this.operadorUid
          ) {
            console.warn('⚠️ Atendimento foi transferido para outro operador');
            this.onPerdeuPosse('TRANSFERIDO');
            return;
          }

          // 2. Verificar se foi finalizado
          if (data.status === 'concluido') {
            console.log('✅ Atendimento foi concluído');
            this.onAtendimentoConcluido();
            return;
          }

          // 3. Se voltou para "novo" ou "fila" sem ser dele, perdeu posse
          if (
            (data.status === 'novo' || data.status === 'fila') &&
            !data.atribuido_para_uid
          ) {
            console.warn('⚠️ Atendimento foi devolvido à fila');
            this.onPerdeuPosse('DEVOLVIDO');
            return;
          }

          // Status OK, nada fazer
        },
        (error) => {
          console.error('❌ Erro no monitor de atendimento:', error);
          // Não desconectar automaticamente em erro, apenas logar
        }
      );

      console.log(`👁️ Monitorando atendimento: ${atendimentoId}`);
    } catch (error) {
      console.error('❌ Erro ao inicializar monitor:', error);
    }
  }

  /**
   * ========================================================
   * CALLBACKS DE EVENTOS
   * ========================================================
   */

  onPerdeuPosse(motivo) {
    console.warn(`⚠️ Perdeu posse do atendimento (${motivo})`);

    // Limpar estado local
    this.limparEstadoLocal();

    // Disparar evento para UI atualizar
    window.dispatchEvent(new CustomEvent('atendimentoPerdido', {
      detail: {
        atendimentoId: this.atendimentoAtivoId,
        motivo,
        mensagem: this.getMensagemMotivo(motivo)
      }
    }));

    // Notificar usuário
    if (window.ToastManager) {
      window.ToastManager.show(
        `Atendimento ${motivo === 'TRANSFERIDO' ? 'transferido' : motivo === 'DEVOLVIDO' ? 'devolvido à fila' : 'removido'}.`,
        'warning'
      );
    }
  }

  onAtendimentoConcluido() {
    console.log('✅ Atendimento concluído');

    const atendimentoId = this.atendimentoAtivoId;
    this.limparEstadoLocal();

    // Disparar evento para UI
    window.dispatchEvent(new CustomEvent('atendimentoConcluido', {
      detail: { atendimentoId }
    }));

    if (window.ToastManager) {
      window.ToastManager.show('Atendimento concluído. Pronto para o próximo!', 'success');
    }
  }

  getMensagemMotivo(motivo) {
    const mensagens = {
      'TRANSFERIDO': 'Este atendimento foi transferido para outro operador.',
      'DEVOLVIDO': 'Este atendimento foi devolvido à fila.',
      'DELETADO': 'Este atendimento foi removido do sistema.'
    };
    return mensagens[motivo] || 'Perdeu posse do atendimento.';
  }

  /**
   * ========================================================
   * LIMPEZA
   * ========================================================
   */
  limparEstadoLocal() {
    this.atendimentoAtivoId = null;
    this.atendimentoAtivoCanal = null;
    sessionStorage.removeItem('atendimento_ativo_whatsapp');

    if (this.unsubscribeMonitor) {
      this.unsubscribeMonitor();
      this.unsubscribeMonitor = null;
    }
  }

  finalizar() {
    this.limparEstadoLocal();
    console.log('✅ AcceptanceManager finalizado');
  }
}

// Exportar como global
window.AtendimentoAcceptanceManager = new AtendimentoAcceptanceManager();

console.log('✅ AtendimentoAcceptanceManager carregado (v2 - com transaction)');