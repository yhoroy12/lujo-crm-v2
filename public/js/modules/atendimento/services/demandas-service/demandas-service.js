/**
 * SERVIÇO DE DEMANDAS EXTERNAS
 * Permite que outros módulos criem demandas para o atendimento
 */

class DemandasExternasService {
  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;
  }

  async criarDemanda(dados) {
    try {
      if (!dados.titulo || !dados.descricao) {
        throw new Error('Título e descrição são obrigatórios');
      }

      const user = window.AuthSystem?.getCurrentUser();
      if (!user) throw new Error('Usuário não autenticado');

      const setor = await this.obterSetorUsuario(user.uid);

      const demandaData = {
        titulo: dados.titulo,
        descricao: dados.descricao,
        prioridade: dados.prioridade || 'media',
        tipo_solicitacao: dados.tipo_solicitacao || 'geral',
        solicitante: { uid: user.uid, nome: user.name || 'Usuário', email: user.email },
        setor_origem: setor || user.role || 'desconhecido',
        setor_destino: 'atendimento',
        destinatario_uid: dados.destinatario_uid || null,
        status: 'pendente',
        dados_relacionados: dados.dados_relacionados || null,
        created_at: this.fStore.serverTimestamp(),
        updated_at: this.fStore.serverTimestamp(),
        created_by_uid: user.uid,
        atendente_responsavel: null,
        concluido_em: null,
        concluido_por: null
      };

      const docRef = await this.fStore.addDoc(
        this.fStore.collection(this.db, 'demandas_externas'),
        demandaData
      );

      console.log('✅ Demanda criada:', docRef.id);
      this.notificarNovaDemanda(docRef.id, demandaData);
      return docRef.id;

    } catch (error) {
      console.error('❌ Erro ao criar demanda:', error);
      throw error;
    }
  }

  async atualizarStatus(demandaId, novoStatus, observacao = null) {
    try {
      const updateData = {
        status: novoStatus,
        updated_at: this.fStore.serverTimestamp()
      };

      if (observacao) updateData.observacao_status = observacao;

      await this.fStore.updateDoc(
        this.fStore.doc(this.db, 'demandas_externas', demandaId),
        updateData
      );

      console.log('✅ Status da demanda atualizado:', demandaId);
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      throw error;
    }
  }

  async consultarAndamento(filtros = {}, ultimoDoc = null) {
    try {
      const { collection, query, where, orderBy, getDocs, limit, startAfter, doc, getDoc } = this.fStore;

      const temFiltro = filtros.ticket || filtros.cliente || filtros.status || filtros.setor;

      if (!temFiltro) {
        console.warn("⚠️ Operação cancelada: Selecione ao menos um Status, Setor ou digite um E-mail/Ticket.");
        return { dados: [], ultimoVisivel: null };
      }

      if (filtros.ticket) {
        const id = filtros.ticket.trim();
        if (id.startsWith('DEM-')) {
          const docSnap = await getDoc(doc(this.db, 'geral_demandas', id));
          return { dados: docSnap.exists() ? [this.formatarDemanda(docSnap)] : [], ultimoVisivel: null };
        }
        const qProtocolo = query(collection(this.db, 'geral_demandas'), where('atendimentoId', '==', id), limit(1));
        const snap = await getDocs(qProtocolo);
        return { dados: snap.docs.map(d => this.formatarDemanda(d)), ultimoVisivel: null };
      }

      let constraints = [];
      if (filtros.cliente) constraints.push(where('cliente_email', '==', filtros.cliente.trim().toLowerCase()));
      if (filtros.status) constraints.push(where('status', '==', filtros.status.toUpperCase()));
      if (filtros.setor) constraints.push(where('setor_destino', '==', filtros.setor.toLowerCase()));

      constraints.push(orderBy('criado_em_chat', 'desc'));
      if (ultimoDoc) constraints.push(startAfter(ultimoDoc));
      constraints.push(limit(10));

      const q = query(collection(this.db, 'geral_demandas'), ...constraints);
      const snapshot = await getDocs(q);

      return {
        dados: snapshot.docs.map(d => this.formatarDemanda(d)),
        ultimoVisivel: snapshot.docs[snapshot.docs.length - 1] || null
      };

    } catch (error) {
      console.error('❌ Erro na consulta:', error);
      throw error;
    }
  }

  escutarDemandasRecebidas(setorId, callback) {
    try {
      const { collection, query, where, orderBy, onSnapshot } = this.fStore;
      const setorAlvo = String(setorId).toLowerCase();

      const q = query(
        collection(this.db, 'geral_demandas'),
        where('setor_destino', '==', setorAlvo),
        where('status', '==', 'PENDENTE'),
        orderBy('criado_em_chat', 'desc'),
        orderBy('prioridade', 'desc')
      );

      return onSnapshot(q, (snapshot) => {
        const demandas = snapshot.docs.map(doc => this.formatarDemanda(doc));
        console.log(`📡 [Realtime] ${demandas.length} demandas para ${setorAlvo}`);
        callback(demandas);
      }, (error) => {
        console.error('❌ Erro no Snapshot de recebidas:', error);
      });

    } catch (error) {
      console.error('❌ Erro ao configurar escuta de demandas:', error);
      throw error;
    }
  }

  async listarDemandasRecebidas(setorId) {
    const { collection, query, where, getDocs } = this.fStore;
    const q = query(
      collection(this.db, 'geral_demandas'),
      where('setor_destino', '==', setorId.toLowerCase()),
      where('status', '==', 'PENDENTE')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => this.formatarDemanda(doc));
  }

  async aceitarDemanda(demandaId, operador) {
    const { doc, runTransaction, serverTimestamp } = window.FirebaseApp.fStore;
    const db = window.FirebaseApp.db;
    const demandaRef = doc(db, "geral_demandas", demandaId);

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(demandaRef);
        if (!sfDoc.exists()) throw "Documento não existe!";

        const statusAtual = sfDoc.data().status;
        if (statusAtual !== "PENDENTE") throw "Esta demanda já foi aceita por outro operador.";

        transaction.update(demandaRef, {
          status: "EM_PROCESSO",
          operador_destino_uid: operador.uid,
          operador_destino_nome: operador.nome,
          "timestamps.assumida_em": serverTimestamp(),
          "timestamps.ultima_atualizacao": serverTimestamp()
        });
      });

      return { success: true };
    } catch (error) {
      console.error("Erro na transação de aceite:", error);
      return { success: false, error: typeof error === 'string' ? error : "Erro ao processar aceite." };
    }
  }

  async buscarMinhasDemandas(filtros = {}) {
    try {
      const user = window.AuthSystem?.getCurrentUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { collection, limit, query, where, orderBy, getDocs, Timestamp } = this.fStore;

      let queryConstraints = [where('operador_origem_uid', '==', user.uid)];

      if (filtros.status && filtros.status !== '') queryConstraints.push(where('status', '==', filtros.status));
      if (filtros.setor_destino && filtros.setor_destino !== '') queryConstraints.push(where('setor_destino', '==', filtros.setor_destino));

      if (filtros.periodo && filtros.periodo !== 'todos') {
        const hoje = new Date();
        let dataInicio;
        switch (filtros.periodo) {
          case 'hoje': dataInicio = new Date(hoje.setHours(0, 0, 0, 0)); break;
          case 'semana': dataInicio = new Date(hoje.setDate(hoje.getDate() - 7)); break;
          case 'mes': dataInicio = new Date(hoje.setMonth(hoje.getMonth() - 1)); break;
          default: dataInicio = null;
        }
        if (dataInicio) queryConstraints.push(where('timestamps.encaminhada_em', '>=', Timestamp.fromDate(dataInicio)));
      }

      queryConstraints.push(orderBy('timestamps.encaminhada_em', 'desc'));
      queryConstraints.push(limit(50));

      const q = query(collection(this.db, 'geral_demandas'), ...queryConstraints);
      const snapshot = await getDocs(q);
      const demandas = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        demandas.push({
          id: doc.id,
          atendimentoId: data.atendimentoId,
          demandaId: data.demandaId || doc.id,
          resumo: data.resumo || 'Sem resumo',
          status: data.status || 'PENDENTE',
          prioridade: data.prioridade || 0,
          setor_destino: data.setor_destino,
          setor_origem: data.setor_origem,
          operador_origem: { nome: data.operador_origem_nome, uid: data.operador_origem_uid },
          operador_destino: { nome: data.operador_destino_nome, uid: data.operador_destino_uid },
          canal: data.canal,
          tipo: data.tipo,
          tipo_demanda: data.tipo_demanda,
          justificativa: data.justificativa_encaminhamento,
          cliente: data.cliente,
          criado_em: data.timestamps?.encaminhada_em,
          criado_em_formatado: this.formatarData(data.timestamps?.encaminhada_em || data.criado_em_chat),
          prioridade_label: this.formatarPrioridade(data.prioridade),
          status_label: this.formatarStatus(data.status),
          tempo_decorrido: this._calcularTempoDecorrido(data.timestamps?.encaminhada_em),
          observacoes: data.observacoes || []
        });
      });

      console.log(`💰 Cobrança desta operação: ${snapshot.size} leituras.`);
      return demandas;

    } catch (error) {
      console.error('❌ Erro ao buscar demandas:', error);
      throw error;
    }
  }

  escutarMinhasDemandas(operadorUid, callback) {
    const { query, collection, where, orderBy, onSnapshot } = window.FirebaseApp.fStore;
    const db = window.FirebaseApp.db;

    const q = query(
      collection(db, "geral_demandas"),
      where("operador_destino_uid", "==", operadorUid),
      where("status", "==", "EM_PROCESSO"),
      orderBy("timestamps.ultima_atualizacao", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const demandas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(demandas);
    }, (error) => {
      console.error("Erro no listener de Minhas Demandas:", error);
    });
  }

  async concluirDemanda(demandaId, resolucao) {
    try {
      const { doc, updateDoc, arrayUnion, serverTimestamp } = window.FirebaseApp.fStore;
      const db = window.FirebaseApp.db;
      const user = window.AuthSystem?.getCurrentUser();
      const demandaRef = doc(db, "geral_demandas", demandaId);
      const agora = new Date();

      await updateDoc(demandaRef, {
        status: "CONCLUIDO",
        resolucao_final: resolucao,
        "timestamps.concluida_em": serverTimestamp(),
        "timestamps.ultima_atualizacao": serverTimestamp(),
        historico_status: arrayUnion({
          acao: "concluido",
          status: "CONCLUIDO",
          timestamp: agora.toISOString(),
          usuario: user?.name || "Operador",
          justificativa: resolucao
        })
      });

      return { success: true };
    } catch (error) {
      console.error("Erro ao concluir demanda:", error);
      return { success: false, error };
    }
  }

  async recusarDemanda(demandaId, motivo) {
    try {
      const { doc, updateDoc, arrayUnion, serverTimestamp } = window.FirebaseApp.fStore;
      const db = window.FirebaseApp.db;
      const user = window.AuthSystem?.getCurrentUser();
      const demandaRef = doc(db, "geral_demandas", demandaId);
      const agora = new Date();

      await updateDoc(demandaRef, {
        status: "RECUSADO",
        motivo_recusa: motivo,
        operador_destino_uid: null,
        operador_destino_nome: null,
        "timestamps.ultima_atualizacao": serverTimestamp(),
        historico_status: arrayUnion({
          acao: "recusado",
          status: "RECUSADO",
          timestamp: agora.toISOString(),
          usuario: user?.name || "Operador",
          justificativa: motivo
        })
      });

      return { success: true };
    } catch (error) {
      console.error("Erro ao recusar demanda:", error);
      return { success: false, error };
    }
  }

  async reenviarDemanda(demandaId, complemento) {
    try {
      const { doc, updateDoc, arrayUnion, serverTimestamp } = window.FirebaseApp.fStore;
      const db = window.FirebaseApp.db;
      const user = window.AuthSystem?.getCurrentUser();
      const demandaRef = doc(db, 'geral_demandas', demandaId);
      const agora = new Date();

      await updateDoc(demandaRef, {
        status: 'PENDENTE',
        motivo_recusa: null,
        complemento_reenvio: complemento.trim(),
        'timestamps.ultima_atualizacao': serverTimestamp(),
        historico_status: arrayUnion({
          acao: 'reenviado',
          status: 'PENDENTE',
          timestamp: agora.toISOString(),
          usuario: user?.name || 'Operador',
          justificativa: complemento.trim()
        })
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao reenviar demanda:', error);
      return { success: false, error };
    }
  }

  async aguardarGerencia(demandaId, parecer) {
    try {
      const { doc, updateDoc, arrayUnion, serverTimestamp } = window.FirebaseApp.fStore;
      const db = window.FirebaseApp.db;
      const user = window.AuthSystem?.getCurrentUser();
      const demandaRef = doc(db, "geral_demandas", demandaId);
      const agora = new Date();

      await updateDoc(demandaRef, {
        status: "AGUARDANDO_GERENCIA",
        "timestamps.ultima_atualizacao": serverTimestamp(),
        parecer_tecnico: parecer,
        historico_status: arrayUnion({
          acao: "aguardando_gerencia",
          status: "AGUARDANDO_GERENCIA",
          timestamp: agora.toISOString(),
          usuario: user?.name || "Operador",
          justificativa: parecer
        })
      });

      return { success: true };
    } catch (error) {
      console.error("Erro ao enviar para gerência:", error);
      return { success: false, error };
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  _calcularTempoDecorrido(timestamp) {
    if (!timestamp) return '-';
    const criado = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const agora = new Date();
    const diffMin = Math.floor((agora - criado) / 60000);
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ${diffMin % 60}min`;
    return `${Math.floor(diffH / 24)}d ${diffH % 24}h`;
  }

  async adicionarObservacao(demandaId, texto) {
    try {
      const { doc, updateDoc, arrayUnion, serverTimestamp } = window.FirebaseApp.fStore;
      const db = window.FirebaseApp.db;
      const user = window.AuthSystem?.getCurrentUser();
      const novaObservacao = {
        id: `obs_${Date.now()}`,
        texto,
        autor: user?.name || 'Operador',
        autor_uid: user?.uid || '',
        criado_em: new Date().toISOString()
      };
      await updateDoc(doc(db, 'geral_demandas', demandaId), {
        observacoes: arrayUnion(novaObservacao),
        'timestamps.ultima_atualizacao': serverTimestamp()
      });
      return { success: true, observacao: novaObservacao };
    } catch (error) {
      console.error('Erro ao adicionar observação:', error);
      return { success: false, error };
    }
  }

  /**
   * ==================================================================================
   * REGRA 1 — Solicitar Atualização com Contador e Escalonamento para Gerência
   * ==================================================================================
   * 
   * Comportamento:
   *  - Incrementa um contador de solicitações no documento da demanda.
   *  - Registra timestamps de cada solicitação para rastreabilidade.
   *  - Se o status não mudou E já foram feitas 3+ solicitações → dispara Regra 1.1.
   * 
   * Campos usados no documento geral_demandas:
   *  - atualizacao_solicitada: boolean
   *  - atualizacao_contador: number (quantas vezes foi solicitado)
   *  - atualizacao_ultima_em: serverTimestamp
   *  - atualizacao_status_ref: string (status no momento da 1ª solicitação, para detectar mudança)
   *  - atualizacao_solicitada_por: string (nome do solicitante)
   */
  async solicitarAtualizacao(demandaId) {
    try {
      const { doc, getDoc, updateDoc, serverTimestamp } = window.FirebaseApp.fStore;
      const db = window.FirebaseApp.db;
      const user = window.AuthSystem?.getCurrentUser();

      // Busca o estado atual da demanda para checar contador e status
      const demandaRef = doc(db, 'geral_demandas', demandaId);
      const snap = await getDoc(demandaRef);

      if (!snap.exists()) throw new Error('Demanda não encontrada.');

      const data = snap.data();
      const contadorAtual = data.atualizacao_contador || 0;
      const novoContador = contadorAtual + 1;

      // Status no momento da 1ª solicitação (para comparar e detectar se mudou)
      const statusRef = data.atualizacao_status_ref || data.status;
      const statusNaoMudou = data.status === statusRef;

      // Atualiza o documento com o novo contador
      await updateDoc(demandaRef, {
        atualizacao_solicitada: true,
        atualizacao_contador: novoContador,
        atualizacao_ultima_em: serverTimestamp(),
        atualizacao_solicitada_por: user?.name || 'Operador',
        // Só grava o status de referência na 1ª solicitação
        ...(contadorAtual === 0 ? { atualizacao_status_ref: data.status } : {}),
        'timestamps.ultima_atualizacao': serverTimestamp()
      });

      // Retorna os dados necessários para o demandas.js disparar as notificações
      return {
        success: true,
        contador: novoContador,
        statusNaoMudou,
        demandaData: data
      };

    } catch (error) {
      console.error('Erro ao solicitar atualização:', error);
      return { success: false, error };
    }
  }

  formatarData(timestamp) {
    if (!timestamp) return 'Data não disponível';
    if (timestamp.toDate) {
      const data = timestamp.toDate();
      return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR');
    }
    return timestamp;
  }

  formatarPrioridade(prioridade) {
    const prioridades = {
      'urgente': { label: 'Urgente', classe: 'prioridade-urgente' },
      'alta': { label: 'Alta', classe: 'prioridade-alta' },
      'media': { label: 'Média', classe: 'prioridade-media' },
      'baixa': { label: 'Baixa', classe: 'prioridade-baixa' }
    };
    return prioridades[prioridade] || { label: 'Média', classe: 'prioridade-media' };
  }

  formatarStatus(status) {
    const statusMap = {
      'PENDENTE': { label: 'Pendente', classe: 'status-pendente' },
      'ENCAMINHADO': { label: 'Encaminhado', classe: 'status-encaminhado' },
      'AGUARDANDO_SETOR': { label: 'Aguardando Setor', classe: 'status-aguardando' },
      'EM_ANDAMENTO': { label: 'Em Andamento', classe: 'status-andamento' },
      'CONCLUIDO': { label: 'Concluído', classe: 'status-concluido' }
    };
    return statusMap[status] || { label: status, classe: 'status-desconhecido' };
  }

  formatarDemanda(docSnap) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      criado_em_formatado: this.formatarData(data.criado_em_chat),
      status_label: this.formatarStatus(data.status)
    };
  }

  async obterSetorUsuario(uid) {
    try {
      const { doc, getDoc } = this.fStore;
      const userDoc = await getDoc(doc(this.db, 'users', uid));
      if (userDoc.exists()) return userDoc.data().setor || null;
      return null;
    } catch (error) {
      console.warn('⚠️ Erro ao buscar setor do usuário:', error);
      return null;
    }
  }

  notificarNovaDemanda(demandaId, demandaData) {
    console.log('📢 Nova demanda criada:', demandaId, demandaData);
  }

  async getDemanda(demandaId) {
    try {
      const { doc, getDoc } = this.fStore;
      const docSnap = await getDoc(doc(this.db, 'geral_demandas', demandaId));
      if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar demanda:', error);
      return null;
    }
  }
}

window.DemandasService = new DemandasExternasService();
console.log('✅ DemandasExternasService carregado');