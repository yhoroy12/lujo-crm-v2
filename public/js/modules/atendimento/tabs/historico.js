/**
 * ABA: HISTÓRICO (VERSÃO REFATORADA)
 *
 * ✅ Cards com estilo visual correto (classes do aba-historico.css)
 * ✅ Paginação por cursor (15 por página) — sem carregar tudo de uma vez
 * ✅ Cálculo de custo estimado do atendimento (R$/minuto)
 * ✅ Estatísticas calculadas sobre a página atual + totais acumulados
 * ✅ Botão "Carregar mais" (cursor-based, não offset)
 */

const HistoricoTab = {
  id: 'aba-historico',
  moduleId: 'atendimento',
  canalAtual: 'whatsapp',

  // Dados da página atual
  atendimentos: [],          // página atual (max 15)
  atendimentosFiltrados: [], // após filtros locais
  todosTotais: {             // acumulado para estatísticas
    total: 0,
    concluidos: 0,
    derivados: 0,
    tempoTotal: 0,
    contadorTempo: 0
  },

  // Paginação por cursor
  _paginaAtual: 1,
  _itensPorPagina: 15,
  _ultimoCursor: null,       // último documento do Firestore para cursor-based pagination
  _temMais: false,           // se há mais páginas
  _carregandoMais: false,

  _initialized: false,
  unsubscribeHistorico: null,

  // ─── CUSTO POR MINUTO (R$) ─────────────────────────────────────────
  // Ajuste conforme seu modelo de custo operacional
  CUSTO_POR_MINUTO: 1.20,

  async init() {
    if (this._initialized) {
      console.warn('⚠️ HistoricoTab já inicializado. Abortando duplicata.');
      return;
    }

    console.log('📚 Inicializando aba Histórico');

    try {
      this.cacheElements();
      this.bindEvents();
      this._resetarPaginacao();
      await this.carregarDados(false);

      this._initialized = true;
      console.log('✅ Histórico pronto');
    } catch (error) {
      console.error('❌ Erro em Histórico:', error);
      this._initialized = false;
    }
  },

  cacheElements() {
    this.elements = {
      subAbaBtns:            document.querySelectorAll('.sub-aba-btn'),
      listaContainer:        document.getElementById('listaHistorico'),
      searchInput:           document.getElementById('searchHistorico'),
      filtroPeriodo:         document.getElementById('filtroPeriodo'),
      filtroDataInicio:      document.getElementById('filtroDataInicio'),
      filtroDataFim:         document.getElementById('filtroDataFim'),
      filtroStatus:          document.getElementById('filtroStatus'),
      filtroAreaDerivada:    document.getElementById('filtroAreaDerivada'),
      filtroTipoDemanda:     document.getElementById('filtroTipoDemanda'),
      statTotalAtendimentos: document.getElementById('statTotalAtendimentos'),
      statConcluidos:        document.getElementById('statConcluidos'),
      statDerivados:         document.getElementById('statDerivados'),
      statTempoMedio:        document.getElementById('statTempoMedio'),
      modalOverlay:          document.getElementById('modalHistoricoDetalhes'),
      btnFecharModal:        document.getElementById('btnFecharModalHistorico'),
      btnFecharModal2:       document.getElementById('btnFecharModalHistorico2')
    };
  },

  bindEvents() {
    // Sub-abas
    this.elements.subAbaBtns.forEach(btn => {
      window.ModuleLifecycle.addListener(btn, 'click', () => {
        this.canalAtual = btn.dataset.canal;
        this.atualizarAbas(btn);
        this._resetarPaginacao();
        this.carregarDados(false);
      }, this.moduleId);
    });

    // Busca (local, sem ir ao Firebase)
    if (this.elements.searchInput) {
      window.ModuleLifecycle.addListener(this.elements.searchInput, 'input', () => {
        this.aplicarFiltros();
      }, this.moduleId);
    }

    // Período → recarrega do Firebase
    if (this.elements.filtroPeriodo) {
      window.ModuleLifecycle.addListener(this.elements.filtroPeriodo, 'change', () => {
        this.ajustarCamposData();
        this._resetarPaginacao();
        this.carregarDados(false);
      }, this.moduleId);
    }

    if (this.elements.filtroDataInicio) {
      window.ModuleLifecycle.addListener(this.elements.filtroDataInicio, 'change', () => {
        this._resetarPaginacao();
        this.carregarDados(false);
      }, this.moduleId);
    }

    if (this.elements.filtroDataFim) {
      window.ModuleLifecycle.addListener(this.elements.filtroDataFim, 'change', () => {
        this._resetarPaginacao();
        this.carregarDados(false);
      }, this.moduleId);
    }

    // Filtros locais (status, área, tipo)
    ['filtroStatus', 'filtroAreaDerivada', 'filtroTipoDemanda'].forEach(key => {
      if (this.elements[key]) {
        window.ModuleLifecycle.addListener(this.elements[key], 'change', () => {
          this.aplicarFiltros();
        }, this.moduleId);
      }
    });

    // Modal
    if (this.elements.btnFecharModal) {
      window.ModuleLifecycle.addListener(this.elements.btnFecharModal, 'click', () => this.fecharModal(), this.moduleId);
    }
    if (this.elements.btnFecharModal2) {
      window.ModuleLifecycle.addListener(this.elements.btnFecharModal2, 'click', () => this.fecharModal(), this.moduleId);
    }
  },

  // ─── PAGINAÇÃO ────────────────────────────────────────────────────

  _resetarPaginacao() {
    this._ultimoCursor = null;
    this._temMais = false;
    this._paginaAtual = 1;
    this.atendimentos = [];
    this.todosTotais = { total: 0, concluidos: 0, derivados: 0, tempoTotal: 0, contadorTempo: 0 };
  },

  // ─── CARGA DO FIREBASE ────────────────────────────────────────────

  /**
   * @param {boolean} acrescentar — true = "carregar mais", false = primeira carga / novo filtro
   */
  async carregarDados(acrescentar = false) {
    if (this._carregandoMais) return;
    this._carregandoMais = true;

    console.log(`📊 Carregando histórico (${this.canalAtual}) | acrescentar: ${acrescentar}`);

    try {
      const db = window.FirebaseApp.db;
      const fStore = window.FirebaseApp.fStore;
      const { collection, query, where, orderBy, getDocs, Timestamp, limit, startAfter } = fStore;

      const colecao = this.canalAtual === 'whatsapp' ? 'atend_chat_fila' : 'atend_emails_historico';
      const { dataInicio, dataFim } = this.obterPeriodoFiltro();

      // Montar constraints dinamicamente (Firestore não aceita undefined)
      const constraints = [
        where('status', 'in', ['CONCLUIDO', 'concluido', 'ENCAMINHADO', 'encaminhado', 'derivado']),
        orderBy('criadoEm', 'desc'),
        limit(this._itensPorPagina + 1) // +1 para saber se tem mais
      ];

      if (dataInicio) {
        constraints.splice(2, 0, where('criadoEm', '>=', Timestamp.fromDate(dataInicio)));
      }
      if (dataFim) {
        constraints.splice(dataInicio ? 3 : 2, 0, where('criadoEm', '<=', Timestamp.fromDate(dataFim)));
      }

      // Cursor de paginação
      if (acrescentar && this._ultimoCursor) {
        constraints.push(startAfter(this._ultimoCursor));
      }

      const q = query(collection(db, colecao), ...constraints);
      const snapshot = await getDocs(q);

      const docs = snapshot.docs;
      this._temMais = docs.length > this._itensPorPagina;
      const pagina = this._temMais ? docs.slice(0, this._itensPorPagina) : docs;

      if (pagina.length > 0) {
        this._ultimoCursor = pagina[pagina.length - 1];
      }

      const novos = pagina.map(doc => ({ id: doc.id, ...doc.data() }));

      if (acrescentar) {
        this.atendimentos = [...this.atendimentos, ...novos];
      } else {
        this.atendimentos = novos;
        // Recalcula totais acumulados só na primeira carga (snapshot sem cursor)
        this._recalcularTotais(novos);
      }

      if (acrescentar) {
        this._acumularTotais(novos);
      }

      console.log(`✅ ${novos.length} atendimentos carregados (tem mais: ${this._temMais})`);

      this.aplicarFiltros();
      this.renderizarEstatisticas();

    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
      if (this.elements.listaContainer) {
        this.elements.listaContainer.innerHTML = `
          <div class="historico-empty" style="padding:40px;text-align:center;">
            <i class="fi fi-rr-exclamation-triangle" style="font-size:48px;color:var(--color-danger);"></i>
            <h3>Erro ao Carregar Dados</h3>
            <p>${error.message}</p>
          </div>`;
      }
    } finally {
      this._carregandoMais = false;
    }
  },

  // ─── TOTAIS (ESTATÍSTICAS) ────────────────────────────────────────

  _recalcularTotais(lista) {
    this.todosTotais = { total: 0, concluidos: 0, derivados: 0, tempoTotal: 0, contadorTempo: 0 };
    this._acumularTotais(lista);
  },

  _acumularTotais(lista) {
    lista.forEach(a => {
      this.todosTotais.total++;
      const s = (a.status || '').toLowerCase();
      if (s === 'concluido') this.todosTotais.concluidos++;
      if (s === 'encaminhado' || s === 'derivado') this.todosTotais.derivados++;

      if (a.criadoEm && a.concluido_em) {
        const inicio = a.criadoEm.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm);
        const fim = a.concluido_em.toDate ? a.concluido_em.toDate() : new Date(a.concluido_em);
        const diff = fim - inicio;
        if (diff > 0) {
          this.todosTotais.tempoTotal += diff;
          this.todosTotais.contadorTempo++;
        }
      }
    });
  },

  // ─── FILTROS LOCAIS ───────────────────────────────────────────────

  aplicarFiltros() {
    let filtrados = [...this.atendimentos];

    const busca = this.elements.searchInput?.value.toLowerCase().trim();
    if (busca) {
      filtrados = filtrados.filter(a =>
        (a.cliente?.nome || '').toLowerCase().includes(busca) ||
        (a.atendimentoId || '').toLowerCase().includes(busca) ||
        (a.tipo_demanda || '').toLowerCase().includes(busca)
      );
    }

    const status = this.elements.filtroStatus?.value;
    if (status && status !== 'todos') {
      filtrados = filtrados.filter(a => (a.status || '').toLowerCase() === status.toLowerCase());
    }

    const area = this.elements.filtroAreaDerivada?.value;
    if (area && area !== 'todas') {
      filtrados = filtrados.filter(a => (a.setor_responsavel || '').toLowerCase() === area.toLowerCase());
    }

    const tipo = this.elements.filtroTipoDemanda?.value;
    if (tipo && tipo !== 'todos') {
      filtrados = filtrados.filter(a => (a.tipo_demanda || '').toLowerCase() === tipo.toLowerCase());
    }

    this.atendimentosFiltrados = filtrados;
    this.renderizarLista();
  },

  // ─── RENDERIZAÇÃO DOS CARDS ───────────────────────────────────────

  renderizarLista() {
    if (!this.elements.listaContainer) return;

    if (this.atendimentosFiltrados.length === 0) {
      this.elements.listaContainer.innerHTML = `
        <div class="historico-empty">
          <i class="fi fi-rr-search"></i>
          <h3>Nenhum Atendimento Encontrado</h3>
          <p>Tente ajustar os filtros ou o período selecionado</p>
        </div>`;
      return;
    }

    const cardsHTML = this.atendimentosFiltrados.map(atend => this._renderCard(atend)).join('');

    const btnMais = this._temMais ? `
      <div style="text-align:center;padding:20px 0;">
        <button
          class="btn btn-secondary"
          id="btnCarregarMais"
          onclick="HistoricoTab._carregarMais()"
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:8px;border:1.5px solid var(--color-border);background:white;cursor:pointer;font-weight:600;transition:0.2s;"
        >
          <i class="fi fi-rr-angle-down"></i>
          Carregar mais 15 atendimentos
        </button>
      </div>` : '';

    this.elements.listaContainer.innerHTML = cardsHTML + btnMais;
  },

  _renderCard(atend) {
    const statusClass = this._classeStatus(atend.status);
    const statusText  = this.obterTextoStatus(atend.status);
    const dataFmt     = this.formatarData(atend.criadoEm);
    const tempo       = this.calcularTempoAtendimento(atend);
    const custo       = this._calcularCusto(atend);
    const setorClass  = (atend.setor_responsavel || 'atendimento').toLowerCase().replace(/\s+/g, '-');

    return `
      <div class="historico-card" onclick="HistoricoTab.abrirDetalhes('${atend.id}')" style="cursor:pointer;">
        <!-- Cabeçalho -->
        <div class="historico-card-header">
          <div class="ticket-number">
            <i class="fi fi-rr-ticket"></i>
            ${Utils.escapeHtml(atend.atendimentoId || atend.id)}
          </div>
          <span class="ticket-status-historico ${statusClass}">
            ${Utils.escapeHtml(statusText)}
          </span>
        </div>

        <!-- Nome do cliente -->
        <div class="historico-cliente">
          <i class="fi fi-rr-user"></i>
          ${Utils.escapeHtml(atend.cliente?.nome || 'Cliente não identificado')}
        </div>

        <!-- Tipo de demanda -->
        ${atend.tipo_demanda ? `
        <div class="historico-tipo">
          <i class="fi fi-rr-tag"></i>
          ${Utils.escapeHtml(atend.tipo_demanda)}
        </div>` : ''}

        <!-- Setor responsável -->
        ${atend.setor_responsavel ? `
        <div class="historico-setor ${setorClass}">
          <i class="fi fi-rr-building"></i>
          ${Utils.escapeHtml(atend.setor_responsavel)}
        </div>` : ''}

        <!-- Datas + custo -->
        <div class="historico-datas">
          <div class="data-item">
            <span class="data-label">Data</span>
            <span class="data-value">${Utils.escapeHtml(dataFmt)}</span>
          </div>
          <div class="data-item">
            <span class="data-label">Duração</span>
            <span class="data-value">${Utils.escapeHtml(tempo)}</span>
          </div>
          ${custo ? `
          <div class="data-item">
            <span class="data-label">Custo est.</span>
            <span class="data-value" style="color:var(--color-warning);font-weight:700;">
              ${Utils.escapeHtml(custo)}
            </span>
          </div>` : ''}
          <div class="data-item">
            <span class="data-label">Atendente</span>
            <span class="data-value">${Utils.escapeHtml(atend.operador?.nome || atend.concluido_por || '—')}</span>
          </div>
        </div>
      </div>`;
  },

  // ─── CUSTO ────────────────────────────────────────────────────────

  /**
   * Calcula o custo estimado do atendimento.
   * Retorna string formatada (ex: "R$ 18,00") ou null se dados insuficientes.
   */
  _calcularCusto(atend) {
    if (!atend.criadoEm || !atend.concluido_em) return null;

    const inicio = atend.criadoEm.toDate ? atend.criadoEm.toDate() : new Date(atend.criadoEm);
    const fim    = atend.concluido_em.toDate ? atend.concluido_em.toDate() : new Date(atend.concluido_em);
    const minutos = (fim - inicio) / 1000 / 60;

    if (minutos <= 0) return null;

    const custo = minutos * this.CUSTO_POR_MINUTO;
    return `R$ ${custo.toFixed(2).replace('.', ',')}`;
  },

  // ─── CARREGAR MAIS ────────────────────────────────────────────────

  async _carregarMais() {
    const btn = document.getElementById('btnCarregarMais');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fi fi-rr-spinner" style="animation:spin 1s linear infinite;"></i> Carregando...';
    }

    await this.carregarDados(true);
  },

  // ─── ESTATÍSTICAS ─────────────────────────────────────────────────

  renderizarEstatisticas() {
    const t = this.todosTotais;
    const tempoMedio = t.contadorTempo > 0
      ? Math.round(t.tempoTotal / t.contadorTempo / 1000 / 60)
      : 0;

    // Custo total estimado
    const custoTotal = t.contadorTempo > 0
      ? (t.tempoTotal / 1000 / 60) * this.CUSTO_POR_MINUTO
      : 0;

    if (this.elements.statTotalAtendimentos) this.elements.statTotalAtendimentos.textContent = t.total;
    if (this.elements.statConcluidos)        this.elements.statConcluidos.textContent        = t.concluidos;
    if (this.elements.statDerivados)         this.elements.statDerivados.textContent         = t.derivados;
    if (this.elements.statTempoMedio)        this.elements.statTempoMedio.textContent        = `${tempoMedio}min`;

    // Custo total — injeta no 4º stat se existir, ou num stat extra
    const statCusto = document.getElementById('statCustoTotal');
    if (statCusto) {
      statCusto.textContent = `R$ ${custoTotal.toFixed(2).replace('.', ',')}`;
    }
  },

  // Alias para manter compatibilidade com chamadas existentes
  calcularEstatisticas() { this.renderizarEstatisticas(); },

  // ─── ABAS / FILTROS ───────────────────────────────────────────────

  atualizarAbas(botaoSelecionado) {
    this.elements.subAbaBtns.forEach(btn => btn.classList.remove('ativa'));
    botaoSelecionado.classList.add('ativa');
    this.ajustarOpcoesStatus();
  },

  ajustarOpcoesStatus() {
    if (!this.elements.filtroStatus) return;
    const opcoesWA = this.elements.filtroStatus.querySelectorAll('.so-whatsapp');
    const opcoesGM = this.elements.filtroStatus.querySelectorAll('.so-gmail');
    if (this.canalAtual === 'whatsapp') {
      opcoesWA.forEach(o => o.style.display = '');
      opcoesGM.forEach(o => o.style.display = 'none');
    } else {
      opcoesWA.forEach(o => o.style.display = 'none');
      opcoesGM.forEach(o => o.style.display = '');
    }
  },

  ajustarCamposData() {
    const customizado = this.elements.filtroPeriodo?.value === 'customizado';
    if (this.elements.filtroDataInicio) this.elements.filtroDataInicio.disabled = !customizado;
    if (this.elements.filtroDataFim)    this.elements.filtroDataFim.disabled    = !customizado;
  },

  obterPeriodoFiltro() {
    const periodo = this.elements.filtroPeriodo?.value || 'mes';
    const agora = new Date();
    let dataInicio = null, dataFim = null;

    switch (periodo) {
      case 'hoje':
        dataInicio = new Date(agora); dataInicio.setHours(0,0,0,0);
        dataFim    = new Date(agora); dataFim.setHours(23,59,59,999);
        break;
      case 'ontem': {
        const d = new Date(agora); d.setDate(d.getDate() - 1);
        dataInicio = new Date(d); dataInicio.setHours(0,0,0,0);
        dataFim    = new Date(d); dataFim.setHours(23,59,59,999);
        break;
      }
      case 'semana': {
        const d = new Date(agora); d.setDate(agora.getDate() - agora.getDay());
        dataInicio = new Date(d); dataInicio.setHours(0,0,0,0);
        break;
      }
      case 'mes':
        dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
        break;
      case 'customizado':
        if (this.elements.filtroDataInicio?.value) dataInicio = new Date(this.elements.filtroDataInicio.value);
        if (this.elements.filtroDataFim?.value)    { dataFim = new Date(this.elements.filtroDataFim.value); dataFim.setHours(23,59,59,999); }
        break;
      case 'total':
        break; // sem filtro
    }

    return { dataInicio, dataFim };
  },

  // ─── MODAL ───────────────────────────────────────────────────────

async abrirDetalhes(atendimentoId) {
  const atendimento = this.atendimentos.find(a => a.id === atendimentoId);
  
  if (!atendimento) { 
    console.error('Atendimento não encontrado:', atendimentoId); 
    return; 
  }

  // Use getElementById DIRETAMENTE para garantir que a referência existe na hora
  const modalOverlay = document.getElementById('modalHistoricoDetalhes');
  const modalTitulo = document.getElementById('modalTituloCliente');
  const modalTicket = document.getElementById('modalTicketNumber');

  if (modalTitulo) modalTitulo.textContent = atendimento.cliente?.nome || 'Cliente';
  if (modalTicket) modalTicket.textContent = `Ticket #${atendimento.atendimentoId || atendimento.id}`;

  // Preenchimento das seções (Funções que você já tem)
  this.preencherInfoPrincipais(atendimento);
  this.preencherValidacaoIdentidade(atendimento);
  this.preencherDescricao(atendimento);
  this.preencherObservacoes(atendimento);
  this.preencherSetor(atendimento);
  this.preencherTimeline(atendimento);

  // ABRIR O MODAL: Adicione a classe 'active' que está no seu CSS
  if (modalOverlay) {
    modalOverlay.classList.add('active');
  } else {
    console.error('Elemento #modalHistoricoDetalhes não encontrado no DOM');
  }
},

  preencherInfoPrincipais(atendimento) {
    const container = document.getElementById('modalInfoPrincipais');
    if (!container) return;

    const statusText      = this.obterTextoStatus(atendimento.status);
    const dataFormatada   = this.formatarData(atendimento.criadoEm);
    const tempoAtendimento = this.calcularTempoAtendimento(atendimento);
    const custo           = this._calcularCusto(atendimento) || 'N/A';

    container.innerHTML = `
      <div class="info-item-modal">
        <span class="info-label-modal">Status:</span>
        <span class="info-value-modal">${Utils.escapeHtml(statusText)}</span>
      </div>
      <div class="info-item-modal">
        <span class="info-label-modal">Data:</span>
        <span class="info-value-modal">${Utils.escapeHtml(dataFormatada)}</span>
      </div>
      <div class="info-item-modal">
        <span class="info-label-modal">Duração:</span>
        <span class="info-value-modal">${Utils.escapeHtml(tempoAtendimento)}</span>
      </div>
      <div class="info-item-modal">
        <span class="info-label-modal">Custo est.:</span>
        <span class="info-value-modal" style="font-weight:700;color:var(--color-warning);">${Utils.escapeHtml(custo)}</span>
      </div>
      <div class="info-item-modal">
        <span class="info-label-modal">Telefone:</span>
        <span class="info-value-modal">${Utils.escapeHtml(atendimento.cliente?.telefone || 'Não informado')}</span>
      </div>
      <div class="info-item-modal">
        <span class="info-label-modal">E-mail:</span>
        <span class="info-value-modal">${Utils.escapeHtml(atendimento.cliente?.email || 'Não informado')}</span>
      </div>
      <div class="info-item-modal">
        <span class="info-label-modal">Atendido por:</span>
        <span class="info-value-modal">${Utils.escapeHtml(atendimento.operador?.nome || atendimento.concluido_por || 'Sistema')}</span>
      </div>
    `;
  },

  preencherValidacaoIdentidade(atendimento) {
    const container = document.getElementById('modalValidacaoIdentidade');
    if (!container) return;

    const validado = atendimento.validacao_identidade?.concluida;
    const icone = validado ? 'fi-rr-check-circle' : 'fi-rr-cross-circle';
    const cor   = validado ? 'color:var(--color-success)' : 'color:var(--color-danger)';
    const texto = validado
      ? `Identidade confirmada por ${atendimento.validacao_identidade.validado_por}`
      : 'Identidade não validada neste atendimento';

    container.className = `validacao-identidade ${validado ? '' : 'nao-validada'}`;
    container.innerHTML = `
      <i class="fi ${icone} validacao-icon ${validado ? 'validada' : 'nao-validada'}" style="${cor}"></i>
      <div class="validacao-text">
        <strong>Status de Validação</strong>
        <p>${Utils.escapeHtml(texto)}</p>
      </div>`;
  },

  preencherDescricao(atendimento) {
    const container = document.getElementById('modalDescricao');
    if (!container) return;
    container.innerHTML = `<p>${Utils.escapeHtml(atendimento.descricao_solicitacao || 'Nenhuma descrição registrada.')}</p>`;
  },

  preencherObservacoes(atendimento) {
    const section   = document.getElementById('modalObservacoesSection');
    const container = document.getElementById('modalObservacoes');
    if (!section || !container) return;
    if (atendimento.observacoes_internas) {
      section.style.display = 'block';
      container.innerHTML = `<p>${Utils.escapeHtml(atendimento.observacoes_internas)}</p>`;
    } else {
      section.style.display = 'none';
    }
  },

  preencherSetor(atendimento) {
    const section   = document.getElementById('modalSetorSection');
    const container = document.getElementById('modalSetorResponsavel');
    if (!section || !container) return;
    if (atendimento.setor_responsavel) {
      section.style.display = 'block';
      container.innerHTML = `<span class="historico-setor ${atendimento.setor_responsavel.toLowerCase()}">${Utils.escapeHtml(atendimento.setor_responsavel)}</span>`;
    } else {
      section.style.display = 'none';
    }
  },

  preencherTimeline(atendimento) {
    const container = document.getElementById('modalTimeline');
    if (!container) return;

    const timeline = atendimento.timeline || [];

    if (timeline.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-light);">Nenhum evento registrado</p>';
      return;
    }

    container.innerHTML = timeline.map(evento => {
      const data = evento.timestamp?.toDate ? evento.timestamp.toDate() : new Date();
      return `
        <div class="timeline-item-modal">
          <div class="timeline-dot-modal"></div>
          <div class="timeline-content-modal">
            <span class="timeline-time-modal">${Utils.escapeHtml(data.toLocaleString('pt-BR'))}</span>
            <span class="timeline-text-modal">${Utils.escapeHtml(evento.descricao || evento.evento || '')}</span>
          </div>
        </div>`;
    }).join('');
  },

  fecharModal() {
  const modalOverlay = document.getElementById('modalHistoricoDetalhes');
  if (modalOverlay) modalOverlay.classList.remove('active');
},

  // ─── UTILITÁRIOS ──────────────────────────────────────────────────

  _classeStatus(status) {
    const mapa = {
      'concluido':   'concluido',
      'derivado':    'derivado',
      'encaminhado': 'derivado',
      'devolvido':   'reaberto',
      'reaberto':    'reaberto'
    };
    return mapa[(status || '').toLowerCase()] || '';
  },

  obterClasseStatus(status) { return this._classeStatus(status); },

  obterTextoStatus(status) {
    const mapa = {
      'concluido':   'Concluído',
      'derivado':    'Derivado',
      'encaminhado': 'Encaminhado',
      'devolvido':   'Devolvido',
      'reaberto':    'Reaberto'
    };
    return mapa[(status || '').toLowerCase()] || status;
  },

  formatarData(timestamp) {
    if (!timestamp) return 'Data não disponível';
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return data.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  },

  calcularTempoAtendimento(atendimento) {
    if (!atendimento.criadoEm || !atendimento.concluido_em) return 'N/A';
    const inicio  = atendimento.criadoEm.toDate ? atendimento.criadoEm.toDate() : new Date(atendimento.criadoEm);
    const fim     = atendimento.concluido_em.toDate ? atendimento.concluido_em.toDate() : new Date(atendimento.concluido_em);
    const minutos = Math.round((fim - inicio) / 1000 / 60);
    if (minutos < 60) return `${minutos}min`;
    return `${Math.floor(minutos/60)}h ${minutos%60}min`;
  },

  // ─── LIFECYCLE ────────────────────────────────────────────────────

  async refresh() {
    console.log('🔄 Atualizando histórico...');
    try {
      this._resetarPaginacao();
      await this.carregarDados(false);
      console.log('✅ Histórico atualizado');
    } catch (error) {
      console.error('❌ Erro ao atualizar Histórico:', error);
    }
  },

  cleanup() {
    console.log('🧹 Limpando HistoricoTab...');
    try {
      this.fecharModal();
      if (this.unsubscribeHistorico) {
        this.unsubscribeHistorico();
        this.unsubscribeHistorico = null;
      }
      console.log('✅ HistoricoTab limpo');
    } catch (error) {
      console.warn('⚠️ Erro no cleanup de Histórico:', error);
    }
  },

  destroy() {
    console.log('🗑️ Destruindo HistoricoTab...');
    this.cleanup();
    this.atendimentos = [];
    this.atendimentosFiltrados = [];
    this._initialized = false;
    console.log('✅ HistoricoTab destruído');
  }
};

/* tecnica de scroll lateral com o mouse, pretendo deixar que o operador possa escolher como usar (futuro)
const listaHistorico = document.querySelector('.historico-lista');

if (listaHistorico) {
    listaHistorico.addEventListener('wheel', (event) => {
        // Se o usuário rodar a rodinha do mouse (deltaY)...
        if (event.deltaY !== 0) {
            event.preventDefault(); // Impede a página de rolar para baixo
            
            // Faz o container rolar para o lado
            listaHistorico.scrollBy({
                left: event.deltaY * 1.5, // Multiplique por 1.5 para um scroll mais rápido
                behavior: 'auto' // 'smooth' deixa fluido, mas 'auto' é mais responsivo
            });
        }
    });
}
*/
// Expor globalmente
window.HistoricoTab = HistoricoTab;
export default HistoricoTab;