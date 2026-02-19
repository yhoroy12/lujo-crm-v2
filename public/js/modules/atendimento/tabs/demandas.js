/**
 * ==================================================================================
 * DEMANDAS.JS — Orquestrador da Aba de Demandas Externas
 * ==================================================================================
 *
 * ARQUITETURA:
 *   EstadoManager  — controla visibilidade dos estados via classList (NUNCA inline)
 *   DemandasTab    — objeto principal: init, eventos, lógica por sub-aba
 *
 * FLUXO DE INICIALIZAÇÃO:
 *   1. carregarSubAbas()    → fetch dos 4 fragmentos HTML → injeta em .demandas-container
 *   2. _injetarCSSSubAbas() → injeta <link> dos 4 CSS específicos no <head>
 *   3. cacheElements()      → guarda referências dos elementos DOM
 *   4. bindEvents()         → vincula listeners via ModuleLifecycle
 *   5. EstadoManager.inicializar() → estados iniciais de cada sub-aba
 *   6. activateSubTab('consulta')  → exibe a primeira sub-aba
 * ==================================================================================
 */

// ==================================================================================
// ESTADO MANAGER
// ==================================================================================

const EstadoManager = (function () {

  const CONFIG = {
    consulta: {
      estadoVazio: 'estadoAguardandoConsulta',
      estadoCarregando: 'estadoCarregandoConsulta',
      estadoNaoEncontrado: 'estadoNaoEncontradoConsulta',
      listaResultados: 'listaResultadosConsulta',
      contador: 'contadorResultados',
      estadoInicial: 'vazio',
      estadoErro: 'estadoErroConsulta'
    },
    recebidas: {
      estadoVazio: null,
      estadoCarregando: 'estadoCarregandoRecebidas',
      estadoNaoEncontrado: 'estadoNaoEncontradoRecebidas',
      listaResultados: 'listaDemandasRecebidas',
      contador: 'contadorRecebidas',
      estadoInicial: 'carregando',
      estadoErro: 'estadoErroRecebidas'
    },
    encaminhadas: {
      estadoVazio: 'estadoVazioEncaminhadas',
      estadoCarregando: 'estadoCarregandoEncaminhadas',
      estadoNaoEncontrado: 'estadoNaoEncontradoEncaminhadas',
      listaResultados: 'listaDemandasEncaminhadas',
      contador: 'contadorEncaminhadas',
      estadoInicial: 'vazio',
      estadoErro: 'estadoErroEncaminhadas'
    },
    minhas: {
      estadoVazio: null,
      estadoCarregando: 'estadoCarregandoMinhas',
      estadoNaoEncontrado: null,
      listaResultados: 'listaDemandasMinhas',
      contador: 'contadorMinhas',
      estadoInicial: 'carregando',
      estadoErro: 'estadoErroMinhas'
    }
  };

  function setEstado(subAba, novoEstado, dados = []) {
    if (!CONFIG[subAba]) { console.error(`❌ EstadoManager: sub-aba inválida — ${subAba}`); return false; }

    const c = CONFIG[subAba];
    console.log(`🔄 EstadoManager: ${subAba} → ${novoEstado}`, novoEstado === 'dados' ? `(${dados.length})` : '');

    _limpar(c);

    switch (novoEstado) {
      case 'vazio': if (c.estadoVazio) _ativar(c.estadoVazio); _ocultarLista(c); _contador(c, 0); break;
      case 'carregando': _ativar(c.estadoCarregando); _ocultarLista(c); _contador(c, 0); break;
      case 'nao-encontrado': if (c.estadoNaoEncontrado) _ativar(c.estadoNaoEncontrado); _ocultarLista(c); _contador(c, 0); break;
      case 'dados': _mostrarLista(c); _contador(c, dados.length); break;
      case 'estado-erro': if (c.estadoErro) _ativar(c.estadoErro); _ocultarLista(c); _contador(c, 0); break;
      default: console.error(`❌ Estado inválido: ${novoEstado}`); return false;
    }
    return true;
  }

  function _limpar(c) {
    // Pegamos todos os IDs de estado possíveis para esta sub-aba
    [c.estadoVazio, c.estadoCarregando, c.estadoNaoEncontrado, c.estadoErro].filter(Boolean).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('ativa');
        el.style.setProperty('display', 'none', 'important'); // Garante que suma
      }
    });
  }

  function _ativar(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.setProperty('display', 'flex', 'important'); // Ou 'block', dependendo do seu layout
      el.classList.add('ativa');
    }
  }

  function _ocultarLista(c) {
    const el = document.getElementById(c.listaResultados);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none'; // Reforço manual
    }
  }

  function _mostrarLista(c) {
    const el = document.getElementById(c.listaResultados);
    if (el) {
      el.classList.remove('hidden');
      el.style.display = 'block'; // Ou o display original da sua lista
    }
  }
  function _contador(c, n) {
    const el = document.getElementById(c.contador);
    if (!el) return;
    if (n === 0) { el.textContent = '0 encontrados'; el.style.color = ''; el.style.fontWeight = ''; }
    else { el.textContent = `${n} ${n === 1 ? 'demanda' : 'demandas'}`; el.style.color = 'var(--color-primary)'; el.style.fontWeight = '600'; }
  }

  function inicializar() {
    console.log('🚀 EstadoManager: inicializando...');
    Object.entries(CONFIG).forEach(([sub, c]) => setEstado(sub, c.estadoInicial));
    console.log('✅ EstadoManager: pronto');
  }

  function resetar(subAba) {
    if (!CONFIG[subAba]) return false;
    setEstado(subAba, CONFIG[subAba].estadoInicial);
    return true;
  }

  function getEstadoAtual(subAba) {
    if (!CONFIG[subAba]) return null;
    const c = CONFIG[subAba];
    if (c.estadoVazio && document.getElementById(c.estadoVazio)?.classList.contains('ativa')) return 'vazio';
    if (c.estadoCarregando && document.getElementById(c.estadoCarregando)?.classList.contains('ativa')) return 'carregando';
    if (c.estadoNaoEncontrado && document.getElementById(c.estadoNaoEncontrado)?.classList.contains('ativa')) return 'nao-encontrado';
    const lista = document.getElementById(c.listaResultados);
    if (lista && !lista.classList.contains('hidden')) return 'dados';
    return null;
  }

  function debug() {
    console.group('🔍 EstadoManager DEBUG');
    Object.keys(CONFIG).forEach(sub => console.log(`  ${sub}: ${getEstadoAtual(sub) || '?'}`));
    console.groupEnd();
  }

  return { setEstado, inicializar, resetar, getEstadoAtual, debug };
})();


// ==================================================================================
// DEMANDAS TAB
// ==================================================================================

const DemandasTab = {

  id: 'aba-demandas', moduleId: 'demandas',
  elements: {}, _initialized: false, _eventsBound: false, _activeSubTab: 'consulta',
  _ultimoDocConsulta: null,
  _cacheConsulta: [], _cacheRecebidas: [], _cacheEncaminhadas: [], _cacheMinhas: [],
  _unsubscribeRecebidas: null, _unsubscribeMinhas: null,
  _isSearching: false,

  // ------------------------------------------------------------------
  // INIT
  // ------------------------------------------------------------------

  async init() {
    if (this._initialized) { console.warn('⚠️ DemandasTab já inicializado.'); return; }
    console.log('📋 Inicializando DemandasTab...');
    try {
      await this.carregarSubAbas();
      this.cacheElements();
      this.bindEvents();
      EstadoManager.inicializar();
      this.activateSubTab('consulta');
      this._initialized = true;
      console.log('✅ DemandasTab pronto');
    } catch (err) {
      console.error('❌ DemandasTab.init():', err);
      this._initialized = false;
    }
  },

  // ------------------------------------------------------------------
  // CARREGAR HTML DAS SUB-ABAS
  // ------------------------------------------------------------------

  async carregarSubAbas() {
    const container = document.querySelector('.demandas-container');
    if (!container) throw new Error('.demandas-container não encontrado');

    const BASE = '/templates/modules/atendimento/tabs/aba-demandas/abas-demandas';

    for (const sub of ['consulta', 'recebidas', 'minhas', 'encaminhadas']) {
      const resp = await fetch(`${BASE}/subaba-${sub}.html`);
      if (!resp.ok) throw new Error(`Falha HTTP ${resp.status} em subaba-${sub}.html`);
      container.insertAdjacentHTML('beforeend', await resp.text());
      console.log(`  ✅ subaba-${sub}.html`);
    }

    //this._injetarCSSSubAbas(BASE);
    console.log('✅ Sub-abas carregadas');
  },
  // ------------------------------------------------------------------
  // CACHE DE ELEMENTOS
  // ------------------------------------------------------------------

  cacheElements() {
    this.elements = {
      subAbasContainer: document.querySelector('.sub-abas-demandas'),
      subAbaButtons: document.querySelectorAll('.sub-aba-btn'),
      conteudoConsulta: document.querySelector('.demandas-consulta'),
      conteudoRecebidas: document.querySelector('.demandas-recebidas'),
      conteudoEncaminhadas: document.querySelector('.demandas-encaminhadas'),
      conteudoMinhas: document.querySelector('.demandas-minhas'),
      // consulta
      formBuscaDemanda: document.getElementById('formBuscaDemanda'),
      btnExecutarBusca: document.getElementById('btnExecutarBusca'),
      btnLimparBusca: document.getElementById('btnLimparBusca'),
      buscaTicket: document.getElementById('buscaTicket'),
      buscaCliente: document.getElementById('buscaCliente'),
      buscaSetor: document.getElementById('buscaSetor'),
      buscaStatus: document.getElementById('buscaStatus'),
      buscaPeriodo: document.getElementById('buscaPeriodo'),
      detalhesConteudoConsulta: document.getElementById('detalhesConteudoConsulta'),
      detalhesVazioConsulta: document.getElementById('detalhesVazioConsulta'),
      btnFecharDetalhesConsulta: document.getElementById('btnFecharDetalhesConsulta'),
      // recebidas
      filtroStatusRecebidas: document.getElementById('filtroStatusRecebidas'),
      filtroOrigemRecebidas: document.getElementById('filtroOrigemRecebidas'),
      filtroPrioridadeRecebidas: document.getElementById('filtroPrioridadeRecebidas'),
      filtroPeriodoRecebidas: document.getElementById('filtroPeriodoRecebidas'),
      btnAplicarFiltrosRecebidas: document.getElementById('btnAplicarFiltrosRecebidas'),
      btnLimparFiltrosRecebidas: document.getElementById('btnLimparFiltrosRecebidas'),
      detalhesConteudoRecebidas: document.getElementById('detalhesConteudoRecebidas'),
      detalhesVazioRecebidas: document.getElementById('detalhesVazioRecebidas'),
      btnFecharDetalhesRecebidas: document.getElementById('btnFecharDetalhesRecebidas'),
      btnAceitarDemanda: document.getElementById('btnAceitarDemanda'),
      // encaminhadas
      filtroStatusEncaminhadas: document.getElementById('filtroStatusEncaminhadas'),
      filtroSetorEncaminhadas: document.getElementById('filtroSetorEncaminhadas'),
      filtroPeriodoEncaminhadas: document.getElementById('filtroPeriodoEncaminhadas'),
      btnAplicarFiltrosEncaminhadas: document.getElementById('btnAplicarFiltrosEncaminhadas'),
      btnLimparFiltrosEncaminhadas: document.getElementById('btnLimparFiltrosEncaminhadas'),
      detalhesConteudoEncaminhadas: document.getElementById('detalhesConteudoEncaminhadas'),
      detalhesVazioEncaminhadas: document.getElementById('detalhesVazioEncaminhadas'),
      btnFecharDetalhesEncaminhadas: document.getElementById('btnFecharDetalhesEncaminhadas'),
      btnReenviarDemanda: document.getElementById('btnReenviarDemanda'),
      inputComplementoReenvio: document.getElementById('inputComplementoReenvio'),
      // minhas
      listaDemandasMinhas: document.getElementById('listaDemandasMinhas'),
      inputResolucao: document.getElementById('inputResolucao'),
      btnConcluirTrabalho: document.getElementById('btnConcluirTrabalho'),
      btnDevolverDemanda: document.getElementById('btnDevolverDemanda'),
      btnPedirAprovacao: document.getElementById('btnPedirAprovação'),
      detalhesConteudoMinhas: document.getElementById('detalhesConteudoMinhas'),
      detalhesVazioMinhas: document.getElementById('detalhesVazioMinhas'),
      // consulta — ação
      btnSolicitarAtualizacaoConsulta: document.getElementById('btnSolicitarAtualizacaoConsulta'),
      // recebidas — observação
      btnAdicionarObservacao: document.getElementById('btnAdicionarObservacao'),
    };
    console.log(`✅ ${Object.keys(this.elements).length} elementos cacheados`);
  },

  // ------------------------------------------------------------------
  // EVENTOS
  // ------------------------------------------------------------------

  bindEvents() {
    if (this._eventsBound) { console.log('⚠️ Eventos já vinculados.'); return; }
    const ML = window.ModuleLifecycle;
    const id = this.moduleId;

    // Navegação sub-abas (delegação)
    if (this.elements.subAbasContainer) {
      ML.addListener(this.elements.subAbasContainer, 'click', (e) => {
        const btn = e.target.closest('.sub-aba-btn');
        if (btn?.dataset.subaba) { e.preventDefault(); e.stopPropagation(); this.activateSubTab(btn.dataset.subaba); }
      }, id);
    }

    // Consulta
    ML.addListener(this.elements.btnExecutarBusca, 'click', async (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      btn.disabled = true; // desliga botão para evitar cliques múltiplos
      btn.innerHTML = '<i class="spinner-icon"></i> Buscando...';
      await this.aplicarFiltrosConsulta();
      btn.disabled = false; // liga botão após busca
      btn.innerHTML = 'Buscar';
    }, id);

    ML.addListener(this.elements.btnLimparBusca, 'click', (e) => { e.preventDefault(); this.limparBuscaConsulta(); }, id);
    ML.addListener(this.elements.btnFecharDetalhesConsulta, 'click', () => this.fecharDetalhes('consulta'), id);

    // Recebidas
    ML.addListener(this.elements.btnAplicarFiltrosRecebidas, 'click', async (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      btn.disabled = true; // desliga botão para evitar cliques múltiplos
      btn.innerHTML = '<i class="spinner-icon"></i> Buscando...';
      await this.aplicarFiltrosRecebidas();
      btn.disabled = false; // liga botão após busca
      btn.innerHTML = 'Aplicar Filtros';
    }, id);

    ML.addListener(this.elements.btnLimparFiltrosRecebidas, 'click', (e) => { e.preventDefault(); this.limparFiltrosRecebidas(); }, id);
    ML.addListener(this.elements.btnFecharDetalhesRecebidas, 'click', () => this.fecharDetalhes('recebidas'), id);

    // Encaminhadas
    ML.addListener(this.elements.btnAplicarFiltrosEncaminhadas, 'click', async (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      btn.disabled = true; // desliga botão para evitar cliques múltiplos
      btn.innerHTML = '<i class="spinner-icon"></i> Buscando...';
      await this.aplicarFiltrosEncaminhadas();
      btn.disabled = false; // liga botão após busca
      btn.innerHTML = 'Aplicar Filtros';
    }, id);
    ML.addListener(this.elements.btnLimparFiltrosEncaminhadas, 'click', (e) => { e.preventDefault(); this.limparFiltrosEncaminhadas(); }, id);
    ML.addListener(this.elements.btnFecharDetalhesEncaminhadas, 'click', () => this.fecharDetalhes('encaminhadas'), id);

    // Encaminhadas — reenviar demanda recusada
    if (this.elements.btnReenviarDemanda) {
      ML.addListener(this.elements.btnReenviarDemanda, 'click', () => {
        const did = this.elements.detalhesConteudoEncaminhadas?.dataset.id;
        if (did) this.handleReenviarDemanda(did);
      }, id);
    }

    // Minhas
    if (this.elements.btnConcluirTrabalho) {
      ML.addListener(this.elements.btnConcluirTrabalho, 'click', () => {
        const did = this.elements.detalhesConteudoMinhas?.dataset.id;
        if (did) this.handleConcluirDemanda(did);
      }, id);
    }
    if (this.elements.btnDevolverDemanda) {
      ML.addListener(this.elements.btnDevolverDemanda, 'click', () => {
        const did = this.elements.detalhesConteudoMinhas?.dataset.id;
        if (did) this.handleRecusarDemanda(did);
      }, id);
    }
    if (this.elements.btnPedirAprovacao) {
      ML.addListener(this.elements.btnPedirAprovacao, 'click', () => {
        const did = this.elements.detalhesConteudoMinhas?.dataset.id;
        if (did) this.handlePedirAprovacao(did);
      }, id);
    }

    // Consulta — Solicitar Atualização
    if (this.elements.btnSolicitarAtualizacaoConsulta) {
      ML.addListener(this.elements.btnSolicitarAtualizacaoConsulta, 'click', () => {
        const did = this.elements.detalhesConteudoConsulta?.dataset.id;
        if (did) this.handleSolicitarAtualizacao(did);
      }, id);
    }

    // Recebidas — Adicionar Observação
    if (this.elements.btnAdicionarObservacao) {
      ML.addListener(this.elements.btnAdicionarObservacao, 'click', () => {
        const did = this.elements.detalhesConteudoRecebidas?.dataset.id;
        if (did) this.handleAdicionarObservacao(did);
      }, id);
    }

    this._eventsBound = true;
    console.log('✅ Eventos vinculados');
  },

  // ------------------------------------------------------------------
  // GERENCIAMENTO DE SUB-ABAS
  // ------------------------------------------------------------------

  activateSubTab(subTabId) {
    if (!['consulta', 'recebidas', 'encaminhadas', 'minhas'].includes(subTabId)) {
      console.error(`❌ Sub-aba inválida: ${subTabId}`); return;
    }
    console.log(`📑 Ativando: ${subTabId}`);
    this._activeSubTab = subTabId;

    this.elements.subAbaButtons?.forEach(btn =>
      btn.classList.toggle('ativa', btn.dataset.subaba === subTabId)
    );

    const mapa = {
      consulta: this.elements.conteudoConsulta, recebidas: this.elements.conteudoRecebidas,
      encaminhadas: this.elements.conteudoEncaminhadas, minhas: this.elements.conteudoMinhas
    };
    Object.entries(mapa).forEach(([k, el]) => el?.classList.toggle('ativa', k === subTabId));

    if (subTabId !== 'recebidas' && this._unsubscribeRecebidas) {
      this._unsubscribeRecebidas(); this._unsubscribeRecebidas = null;
    }

    ['consulta', 'recebidas', 'encaminhadas'].forEach(s => this.fecharDetalhes(s));

    switch (subTabId) {
      case 'consulta': EstadoManager.resetar('consulta'); break;
      case 'recebidas': this.carregarDemandasRecebidas(); break;
      case 'encaminhadas': this.aplicarFiltrosEncaminhadas(); break;
      case 'minhas': this.carregarMinhasDemandas(); break;
    }
    console.log(`✅ Sub-aba ${subTabId} ativa`);
  },

  // ------------------------------------------------------------------
  // CONSULTA
  // ------------------------------------------------------------------

  async aplicarFiltrosConsulta(continuar = false) {
    if (this._isSearching) { console.warn('⚠️ Consulta já em andamento.'); return; }
    if (!continuar) {
      this._ultimoDocConsulta = null;
      this._cacheConsulta = [];
      EstadoManager.setEstado('consulta', 'carregando');
    }
    this._isSearching = true;

    const filtros = {
      ticket: this.elements.buscaTicket?.value?.trim(),
      cliente: this.elements.buscaCliente?.value?.trim(),
      setor: this.elements.buscaSetor?.value,
      status: this.elements.buscaStatus?.value,
      periodo: this.elements.buscaPeriodo?.value
    };

    try {
      const res = await window.DemandasService.consultarAndamento(filtros, this._ultimoDocConsulta);
      const lista = res.dados ?? res;
      this._ultimoDocConsulta = res.ultimoVisivel ?? null;

      if (lista.length === 0 && !continuar) { EstadoManager.setEstado('consulta', 'nao-encontrado'); return; }

      this._cacheConsulta = continuar ? [...this._cacheConsulta, ...lista] : lista;
      this._renderizarListaConsulta(lista, continuar);
      this._gerenciarBotaoPaginacao(this._ultimoDocConsulta !== null);
    } catch (err) {
      console.error('❌ Consulta:', err);
      EstadoManager.setEstado('consulta', 'erro');
    }
    finally { this._isSearching = false; }

  },

  limparBuscaConsulta() {
    this.elements.formBuscaDemanda?.reset();
    this._cacheConsulta = []; this._ultimoDocConsulta = null;
    EstadoManager.resetar('consulta'); this.fecharDetalhes('consulta');
  },

  _gerenciarBotaoPaginacao(mostrar) {
    const container = document.getElementById('listaResultadosConsulta');
    let btn = document.getElementById('btnCarregarMaisConsulta');
    if (!mostrar) { btn?.remove(); return; }
    if (!btn && container) {
      btn = document.createElement('button');
      btn.id = 'btnCarregarMaisConsulta';
      btn.className = 'btn btn-secondary btn-carregar-mais';
      btn.innerHTML = '<i class="fi fi-rr-angle-small-down"></i> Carregar mais 10';
      btn.onclick = () => this.aplicarFiltrosConsulta(true);
      container.after(btn);
    }
  },

  _renderizarListaConsulta(demandas, adicionar = false) {
    const lista = document.getElementById('listaResultadosConsulta');
    if (!lista) return;

    if (!adicionar) {
      lista.innerHTML = '';
      EstadoManager.setEstado('consulta', 'dados', demandas);
    }

    const html = demandas.map(d => `
      <div class="demanda-card" onclick="DemandasTab.selecionarDemanda('consulta','${d.id}')">
        <div class="demanda-card-header">
          <span class="demanda-card-titulo">${Utils.escapeHtml(d.resumo || 'Sem título')}</span>
          <span class="demanda-card-badge ${Utils.escapeHtml(d.status_label?.classe || 'status-pendente')}">
            ${Utils.escapeHtml(d.status_label?.label || d.status || 'Pendente')}
          </span>
        </div>
        
        <div class="demanda-card-info">
          <span><i class="fi fi-rr-calendar"></i> ${Utils.escapeHtml(d.criado_em_formatado || '-')}</span>
          <span><i class="fi fi-rr-envelope"></i> ${Utils.escapeHtml(d.cliente_email || 'E-mail não informado')}</span>
        </div>

        <div class="demanda-card-footer">
          <span class="demanda-id-tag">#${Utils.escapeHtml(d.demandaId || d.id.substring(0, 8))}</span>
          <i class="fi fi-rr-angle-small-right"></i>
        </div>
      </div>`).join('');

    if (adicionar) lista.insertAdjacentHTML('beforeend', html);
    else lista.innerHTML = html;
  },

  // ------------------------------------------------------------------
  // RECEBIDAS
  // ------------------------------------------------------------------

  async carregarDemandasRecebidas() {
    // Mata qualquer listener anterior antes de iniciar um novo (importante para filtros)
    if (this._unsubscribeRecebidas) {
      this._unsubscribeRecebidas();
      this._unsubscribeRecebidas = null;
    }

    const setor = window.AtendimentoModule?.id || 'atendimento';

    // Captura filtros da tela
    const filtros = {
      status: this.elements.filtroStatusRecebidas?.value,
      origem: this.elements.filtroOrigemRecebidas?.value,
      prioridade: this.elements.filtroPrioridadeRecebidas?.value,
      periodo: this.elements.filtroPeriodoRecebidas?.value
    };

    EstadoManager.setEstado('recebidas', 'carregando');

    // Passe os filtros para o seu Service (verifique se o Service aceita filtros no escutar)
    this._unsubscribeRecebidas = window.DemandasService.escutarDemandasRecebidas(setor, (demandas) => {
      this._cacheRecebidas = demandas;
      if (demandas.length === 0) {
        EstadoManager.setEstado('recebidas', 'nao-encontrado');
      } else {
        this._renderizarListaRecebidas(demandas);
        EstadoManager.setEstado('recebidas', 'dados', demandas);
      }
    }, filtros);
  },

  aplicarFiltrosRecebidas() {
    if (this._unsubscribeRecebidas) { this._unsubscribeRecebidas(); this._unsubscribeRecebidas = null; }
    this.carregarDemandasRecebidas();
  },

  limparFiltrosRecebidas() {
    ['filtroStatusRecebidas', 'filtroOrigemRecebidas', 'filtroPrioridadeRecebidas'].forEach(k => {
      if (this.elements[k]) this.elements[k].value = '';
    });
    if (this.elements.filtroPeriodoRecebidas) this.elements.filtroPeriodoRecebidas.value = 'hoje';
    if (this._unsubscribeRecebidas) { this._unsubscribeRecebidas(); this._unsubscribeRecebidas = null; }
    this.carregarDemandasRecebidas();
  },

  _renderizarListaRecebidas(demandas) {
    const lista = document.getElementById('listaDemandasRecebidas');
    if (!lista) return;

    const getPrio = (s) => {
      if (s >= 150) return { label: 'URGENTE', classe: 'urgente' };
      if (s >= 100) return { label: 'ALTA', classe: 'alta' };
      if (s >= 50) return { label: 'MÉDIA', classe: 'media' };
      return { label: 'BAIXA', classe: 'baixa' };
    };

    lista.innerHTML = demandas.map(d => {
      const p = getPrio(d.prioridade || 0);

      return `
        <div class="demanda-card ${p.classe}" onclick="DemandasTab.selecionarDemanda('recebidas','${d.id}')">
          <div class="demanda-card-header">
            <span class="demanda-card-titulo">${Utils.escapeHtml(d.resumo || 'Nova Demanda')}</span>
            <span class="demanda-card-badge">${Utils.escapeHtml(p.label)}</span>
          </div>

          <div class="demanda-card-info">
            <span><i class="fi fi-rr-building"></i> ${Utils.escapeHtml(d.setor_origem || '-')}</span>
            <span><i class="fi fi-rr-calendar"></i> ${Utils.escapeHtml(d.criado_em_formatado || 'Hoje')}</span>
          </div>

          <div class="demanda-card-footer">
            <span class="demanda-id-tag">#${Utils.escapeHtml(d.id.substring(0, 8))}</span>
            <button class="btn-mini btn-aceitar" 
                    onclick="event.stopPropagation();DemandasTab.handleAceitarDemanda('${d.id}')">
              Aceitar
            </button>
          </div>
        </div>`;
    }).join('');
  },

  async handleAceitarDemanda(id) {
    const user = window.FirebaseApp?.auth?.currentUser;
    if (!user) { alert('❌ Usuário não autenticado.'); return; }
    if ((this._cacheMinhas?.length || 0) >= 15) { alert('⚠️ Limite de 15 demandas atingido.'); return; }
    if (!confirm('Deseja assumir esta demanda?')) return;
    try {
      const result = await window.DemandasService.aceitarDemanda(id, { uid: user.uid, nome: user.displayName || user.email.split('@')[0] });
      if (result.success) this.activateSubTab('minhas');
      else alert('Erro ao aceitar: ' + result.error);
    } catch (err) { console.error('❌', err); alert('Erro interno.'); }
  },

  // ------------------------------------------------------------------
  // ENCAMINHADAS
  // ------------------------------------------------------------------

  async aplicarFiltrosEncaminhadas() {
    const filtros = {
      status: this.elements.filtroStatusEncaminhadas?.value || '',
      setor_destino: this.elements.filtroSetorEncaminhadas?.value || '',
      periodo: this.elements.filtroPeriodoEncaminhadas?.value || ''
    };
    EstadoManager.setEstado('encaminhadas', 'carregando');
    try {
      const demandas = await window.DemandasService.buscarMinhasDemandas(filtros);
      this._cacheEncaminhadas = demandas;
      if (demandas.length === 0) EstadoManager.setEstado('encaminhadas', 'nao-encontrado');
      else { this._renderizarListaEncaminhadas(demandas); EstadoManager.setEstado('encaminhadas', 'dados', demandas); }
    } catch (err) { console.error('❌ Encaminhadas:', err); EstadoManager.setEstado('encaminhadas', 'nao-encontrado'); }
  },

  limparFiltrosEncaminhadas() {
    if (this.elements.filtroStatusEncaminhadas) this.elements.filtroStatusEncaminhadas.value = '';
    if (this.elements.filtroSetorEncaminhadas) this.elements.filtroSetorEncaminhadas.value = '';
    if (this.elements.filtroPeriodoEncaminhadas) this.elements.filtroPeriodoEncaminhadas.value = 'todos';
    this.aplicarFiltrosEncaminhadas();
  },

  _renderizarListaEncaminhadas(demandas) {
    const lista = document.getElementById('listaDemandasEncaminhadas');
    if (!lista) return;

    const getPrioClass = (s) => {
      if (s >= 150) return 'urgente';
      if (s >= 100) return 'alta';
      if (s >= 50) return 'media';
      return 'baixa';
    };

    lista.innerHTML = demandas.map(d => {
      const prioClass = getPrioClass(d.prioridade || 0);
      return `
      <div class="demanda-card ${prioClass}" onclick="DemandasTab.selecionarDemanda('encaminhadas','${d.id}')">
        <div class="demanda-card-header">
          <span class="demanda-card-titulo">${Utils.escapeHtml(d.resumo || 'Sem título')}</span>
          <span class="demanda-card-badge status-${Utils.escapeHtml((d.status || 'pendente').toLowerCase())}">${Utils.escapeHtml(d.status || 'PENDENTE')}</span>
        </div>

        <div class="demanda-card-info">
          <span><i class="fi fi-rr-arrow-right"></i> Para: ${Utils.escapeHtml(d.setor_destino || '-')}</span>
          <span><i class="fi fi-rr-calendar"></i> ${Utils.escapeHtml(d.criado_em_formatado || '-')}</span>
        </div>

        <div class="demanda-card-footer">
          <span class="demanda-id-tag">#${Utils.escapeHtml(d.demandaId || d.id.substring(0, 8))}</span>
          <i class="fi fi-rr-angle-small-right"></i>
        </div>
      </div>`;
    }).join('');
  },

  // ------------------------------------------------------------------
  // MINHAS DEMANDAS
  // ------------------------------------------------------------------

  async carregarMinhasDemandas() {
    if (this._unsubscribeMinhas) return;
    const user = window.FirebaseApp?.auth?.currentUser;
    if (!user) { console.error('❌ Usuário não autenticado.'); return; }
    EstadoManager.setEstado('minhas', 'carregando');
    this._unsubscribeMinhas = window.DemandasService.escutarMinhasDemandas(user.uid, (demandas) => {
      this._cacheMinhas = demandas;
      if (demandas.length === 0) {
        EstadoManager.setEstado('minhas', 'nao-encontrado');
        this.elements.detalhesVazioMinhas?.classList.remove('hidden');
        this.elements.detalhesConteudoMinhas?.classList.add('hidden');
      } else {
        this._renderizarListaMinhas(demandas);
        EstadoManager.setEstado('minhas', 'dados', demandas);
      }
    });
  },

  _renderizarListaMinhas(demandas) {
    const lista = this.elements.listaDemandasMinhas;
    if (!lista) return;

    // Função auxiliar para pegar a classe de prioridade
    const getPrioClass = (s) => {
      if (s >= 150) return 'urgente';
      if (s >= 100) return 'alta';
      if (s >= 50) return 'media';
      return 'baixa';
    };

    lista.innerHTML = demandas.map(d => {
      const prioClass = getPrioClass(d.prioridade || 0);
      return `
      <div class="demanda-card ${prioClass}" onclick="DemandasTab.selecionarDemanda('minhas','${d.id}')">
        <div class="demanda-card-header">
          <span class="demanda-card-titulo">${Utils.escapeHtml(d.resumo || 'Sem título')}</span>
          <span class="demanda-card-badge status-andamento">${Utils.escapeHtml(d.status?.toUpperCase() || 'PENDENTE')}</span>
        </div>

        <div class="demanda-card-info">
          <span><i class="fi fi-rr-user"></i> ${Utils.escapeHtml(d.cliente?.nome || 'Cliente')}</span>
          <span><i class="fi fi-rr-clock"></i> ${Utils.escapeHtml(d.criado_em_formatado || 'Hoje')}</span>
        </div>

        <div class="demanda-card-footer">
          <span class="demanda-id-tag">#${Utils.escapeHtml(d.demandaId || d.id.substring(0, 8))}</span>
          <i class="fi fi-rr-angle-small-right"></i>
        </div>
      </div>`;
    }).join('');
  },

  _preencherDetalhesMinhas(demanda) {
    const container = this.elements.detalhesConteudoMinhas;
    if (!container) return;
    const isVip = demanda.cliente?.vip === true;
    container.classList.toggle('vip-detail-border', isVip);
    container.dataset.id = demanda.id;

    const _s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '-'; };
    _s('detalhesHorarioMinhas', demanda.timestamps?.criada_em?.toDate?.()?.toLocaleString());
    _s('detalhesStatusMinhas', demanda.status);
    _s('detalhesIdMinhas', `#${demanda.demandaId || demanda.id}`);
    _s('detalhesOrigemMinhas', demanda.setor_origem?.toUpperCase());
    _s('detalhesNomeClienteMinhas', demanda.cliente?.nome);

    const dadosEl = document.getElementById('detalhesDadosClienteMinhas');
    if (dadosEl) dadosEl.innerHTML = `
      <p><strong>Nome:</strong> ${Utils.escapeHtml(demanda.cliente?.nome || '-')}</p>
      <p><strong>Email:</strong> ${Utils.escapeHtml(demanda.cliente?.email || '-')}</p>
      <p><strong>Telefone:</strong> ${Utils.escapeHtml(demanda.cliente?.telefone || '-')}</p>
    `;
    const descEl = document.getElementById('detalhesDescricaoMinhas');
    if (descEl) descEl.innerHTML = `<p>${Utils.escapeHtml(demanda.justificativa_encaminhamento || 'Sem descrição.')}</p>`;

    container.classList.remove('hidden');
    this.elements.detalhesVazioMinhas?.classList.add('hidden');
  },

  async handleConcluirDemanda(id) {
    const resolucao = this.elements.inputResolucao?.value?.trim();
    if (!resolucao || resolucao.length < 10) { alert('⚠️ Descreva a resolução (mínimo 10 caracteres).'); return; }
    if (!confirm('Confirmar conclusão desta demanda?')) return;

    const btn = this.elements.btnConcluirTrabalho;
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const res = await window.DemandasService.concluirDemanda(id, resolucao);
      if (res.success) {
        if (window.ToastManager) window.ToastManager.show('✅ Demanda concluída!', 'success');
        else alert('✅ Demanda concluída com sucesso!');
        this.fecharDetalhes('minhas');
        if (this.elements.inputResolucao) this.elements.inputResolucao.value = '';
      } else {
        alert('❌ Erro ao concluir: ' + (res.error?.message || res.error));
      }
    } catch (e) { alert('❌ Erro interno: ' + e.message); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-check"></i> Concluir'; }
  },

  async handleRecusarDemanda(id) {
    const resolucao = this.elements.inputResolucao?.value?.trim();
    if (!resolucao || resolucao.length < 10) { alert('⚠️ Informe o motivo da devolução no campo de parecer (mínimo 10 caracteres).'); return; }
    if (!confirm('Devolver esta demanda? O parecer registrado será salvo como motivo da recusa.')) return;

    const btn = this.elements.btnDevolverDemanda;
    btn.disabled = true; btn.textContent = 'Devolvendo...';
    try {
      const res = await window.DemandasService.recusarDemanda(id, resolucao);
      if (res.success) {
        if (window.ToastManager) window.ToastManager.show('↩️ Demanda devolvida!', 'success');
        else alert('↩️ Demanda devolvida com sucesso!');
        this.fecharDetalhes('minhas');
        if (this.elements.inputResolucao) this.elements.inputResolucao.value = '';
      } else {
        alert('❌ Erro ao devolver: ' + (res.error?.message || res.error));
      }
    } catch (e) { alert('❌ Erro interno: ' + e.message); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-undo"></i> Devolver'; }
  },

  async handlePedirAprovacao(id) {
    const resolucao = this.elements.inputResolucao?.value?.trim();
    if (!resolucao || resolucao.length < 10) { alert('⚠️ Informe o parecer técnico antes de pedir aprovação (mínimo 10 caracteres).'); return; }
    if (!confirm('Enviar para aprovação da gerência?')) return;

    const btn = this.elements.btnPedirAprovacao;
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const res = await window.DemandasService.aguardarGerencia(id, resolucao);
      if (res.success) {
        if (window.ToastManager) window.ToastManager.show('📤 Enviado para gerência!', 'success');
        else alert('📤 Demanda enviada para aprovação da gerência!');
        this.fecharDetalhes('minhas');
        if (this.elements.inputResolucao) this.elements.inputResolucao.value = '';
      } else {
        alert('❌ Erro: ' + (res.error?.message || res.error));
      }
    } catch (e) { alert('❌ Erro interno: ' + e.message); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Pedir Aprovação'; }
  },

 // ==================================================================================
// PATCH — demandas.js
// Substitua APENAS a função handleSolicitarAtualizacao pelo bloco abaixo.
// Localização original: linha ~811
// ==================================================================================

  /**
   * REGRA 1 — Solicitar Atualização
   *
   * Ao clicar em "Solicitar Atualização" na aba Consulta:
   *  1. Incrementa o contador de solicitações no Firestore via DemandasService.
   *  2. Notifica o operador responsável com link direto para a aba "Minhas Demandas".
   *
   * REGRA 1.1 — Escalonamento para Gerência
   *  Se o contador atingir 3+ E o status da demanda não tiver mudado desde a 1ª
   *  solicitação, uma 2ª notificação é disparada ao gerente do setor de destino.
   */
  async handleSolicitarAtualizacao(id) {
    if (!id) { alert('Nenhuma demanda selecionada.'); return; }
    if (!confirm('Enviar pedido de atualização para o operador responsável?')) return;

    const btn = this.elements.btnSolicitarAtualizacaoConsulta;
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      // 1. Registra a solicitação e recebe contador + flag de status
      const res = await window.DemandasService.solicitarAtualizacao(id);

      if (!res.success) {
        alert('❌ Erro ao registrar solicitação: ' + (res.error?.message || res.error));
        return;
      }

      const { contador, statusNaoMudou, demandaData: d } = res;

      // 2. Monta o link direto para a aba "Minhas Demandas" do módulo de atendimento.
      //    Ajuste o hash/rota conforme a navegação do seu sistema.
      const linkDemanda = `#atendimento/demandas/minhas?id=${id}`;

      // ----------------------------------------------------------------
      // REGRA 1 — Notificação ao operador responsável
      // ----------------------------------------------------------------
      const operadorUid = d.operador_destino_uid || d.operador_origem_uid || null;
      const setorDestino = d.setor_destino || null;

      await window.NotificationManager.send({
        targetId: operadorUid,       // Notifica o operador diretamente pelo UID
        targetRole: setorDestino,    // Ou o setor inteiro se não há operador atribuído
        title: '🔄 Atualização Solicitada',
        message: `Solicitaram urgência na demanda: ${d.resumo || id}`,
        type: 'warning',
        link: linkDemanda            // Link para aba minhas demandas
      });

      // ----------------------------------------------------------------
      // REGRA 1.1 — Escalonamento para gerência (3ª solicitação sem mudança de status)
      // ----------------------------------------------------------------
      if (contador >= 3 && statusNaoMudou) {
        console.warn(`⚠️ [Regra 1.1] Demanda ${id} com ${contador} solicitações sem progresso. Notificando gerência.`);

        await window.NotificationManager.send({
          targetRole: 'GERENTE',    // Ou o papel de gerente do seu sistema
          title: '🚨 Demanda sem Andamento',
          message: `Operador ${d.operador_destino_nome || 'não atribuído'} não deu seguimento ao pedido "${d.resumo || id}" após ${contador} solicitações.`,
          type: 'error',
          link: `#atendimento/demandas/consulta?id=${id}`
        });
      }

      // Feedback visual ao usuário
      const msg = contador >= 3 && statusNaoMudou
        ? `✅ Pedido enviado! Esta é a ${contador}ª solicitação sem resposta — a gerência foi notificada automaticamente.`
        : `✅ Pedido de atualização enviado! O operador foi notificado. (Solicitação nº ${contador})`;

      if (window.ToastManager) window.ToastManager.show(msg, contador >= 3 && statusNaoMudou ? 'error' : 'success');
      else alert(msg);

    } catch (e) {
      console.error('Falha na operação:', e);
      alert('❌ Erro interno: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fi fi-rr-refresh"></i> Solicitar Atualização';
    }
  },

  async handleReenviarDemanda(id) {
    const complemento = this.elements.inputComplementoReenvio?.value?.trim();
    if (!complemento || complemento.length < 10) {
      alert('⚠️ Descreva o que foi ajustado ou as informações adicionadas (mínimo 10 caracteres).');
      this.elements.inputComplementoReenvio?.focus();
      return;
    }
    if (!confirm('Reenviar esta demanda para análise? O status voltará para Pendente.')) return;

    const btn = this.elements.btnReenviarDemanda;
    btn.disabled = true;
    btn.innerHTML = '<i class="fi fi-rr-spinner"></i> Reenviando...';
    try {
      const res = await window.DemandasService.reenviarDemanda(id, complemento);
      if (res.success) {
        if (window.ToastManager) window.ToastManager.show('🔄 Demanda reenviada para análise!', 'success');
        else alert('🔄 Demanda reenviada com sucesso! O status voltou para Pendente.');

        // Atualizar cache local e re-renderizar sem nova requisição ao Firestore
        const idx = this._cacheEncaminhadas.findIndex(d => d.id === id);
        if (idx !== -1) {
          this._cacheEncaminhadas[idx].status = 'PENDENTE';
          this._cacheEncaminhadas[idx].motivo_recusa = null;
          this._renderizarListaEncaminhadas(this._cacheEncaminhadas);
        }
        this.fecharDetalhes('encaminhadas');
      } else {
        alert('❌ Erro ao reenviar: ' + (res.error?.message || res.error));
        btn.disabled = false;
        btn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Reenviar para Análise';
      }
    } catch (e) {
      alert('❌ Erro interno: ' + e.message);
      btn.disabled = false;
      btn.innerHTML = '<i class="fi fi-rr-paper-plane"></i> Reenviar para Análise';
    }
  },

  // Estado do modal de observações (em memória)
  _observacoesDemandaAtual: { id: null, lista: [] },

  async handleAdicionarObservacao(id) {
    // Buscar observações existentes do cache
    const demanda = this._cacheRecebidas.find(d => d.id === id);
    this._observacoesDemandaAtual = { id, lista: demanda?.observacoes || [] };
    this._abrirModalObservacoes(id);
  },

  _abrirModalObservacoes(demandaId) {
    // Criar modal se não existir
    let modal = document.getElementById('modalObservacoes');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalObservacoes';
      modal.className = 'modal-popup';
      document.body.appendChild(modal);
    }

    const lista = this._observacoesDemandaAtual.lista;
    const listaHtml = lista.length === 0
      ? '<p class="obs-vazia">Nenhuma observação registrada ainda.</p>'
      : lista.map(obs => `
          <div class="obs-item">
            <div class="obs-meta">
              <strong>${Utils.escapeHtml(obs.autor || 'Operador')}</strong>
              <span>${Utils.escapeHtml(new Date(obs.criado_em).toLocaleString('pt-BR'))}</span>
            </div>
            <p class="obs-texto">${Utils.escapeHtml(obs.texto)}</p>
          </div>`).join('');

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fi fi-rr-comment"></i> Observações da Demanda</h3>
          <button class="modal-close" onclick="document.getElementById('modalObservacoes').classList.remove('active')">✕</button>
        </div>
        <div class="modal-body">
          <div class="obs-historico">${listaHtml}</div>
          <div class="form-group" style="margin-top:16px">
            <label for="inputNovaObservacao"><i class="fi fi-rr-add"></i> Nova Observação</label>
            <textarea id="inputNovaObservacao" class="form-textarea" placeholder="Digite sua observação..." rows="4"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modalObservacoes').classList.remove('active')">
            Fechar
          </button>
          <button class="btn btn-primary" id="btnSalvarObservacao">
            <i class="fi fi-rr-check"></i> Salvar Observação
          </button>
        </div>
      </div>`;

    modal.classList.add('active');

    // Evento do botão salvar
    document.getElementById('btnSalvarObservacao').onclick = () => this._salvarObservacao(demandaId);
  },

  async _salvarObservacao(demandaId) {
    const input = document.getElementById('inputNovaObservacao');
    const texto = input?.value?.trim();
    if (!texto || texto.length < 3) { alert('⚠️ Observação muito curta (mínimo 3 caracteres).'); return; }

    const btn = document.getElementById('btnSalvarObservacao');
    btn.disabled = true; btn.textContent = 'Salvando...';

    try {
      const res = await window.DemandasService.adicionarObservacao(demandaId, texto);
      if (res.success) {
        // Atualizar lista em memória e re-renderizar o modal
        this._observacoesDemandaAtual.lista.push(res.observacao);
        // Atualizar cache local também
        const idx = this._cacheRecebidas.findIndex(d => d.id === demandaId);
        if (idx !== -1) this._cacheRecebidas[idx].observacoes = [...this._observacoesDemandaAtual.lista];
        this._abrirModalObservacoes(demandaId); // re-abre com nova lista
        if (window.ToastManager) window.ToastManager.show('✅ Observação salva!', 'success');
      } else {
        alert('❌ Erro ao salvar observação.');
        btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-check"></i> Salvar Observação';
      }
    } catch (e) { alert('❌ Erro interno: ' + e.message); btn.disabled = false; }
  },

  // ------------------------------------------------------------------
  // DETALHES
  // ------------------------------------------------------------------

  selecionarDemanda(subAba, demandaId) {
    console.log(`📄 Selecionando: ${demandaId} (${subAba})`);
    if (subAba === 'minhas') {
      const d = this._cacheMinhas.find(d => d.id === demandaId);
      if (d) this._preencherDetalhesMinhas(d);
      return;
    }
    const cache = { consulta: this._cacheConsulta, recebidas: this._cacheRecebidas, encaminhadas: this._cacheEncaminhadas };
    const d = cache[subAba]?.find(d => d.id === demandaId);
    if (!d) { console.error(`❌ Demanda ${demandaId} não encontrada no cache de ${subAba}`); return; }
    this._preencherDetalhes(subAba, d);
    this.mostrarDetalhes(subAba);
  },

  _preencherDetalhes(subAba, d) {
    const suf = subAba.charAt(0).toUpperCase() + subAba.slice(1);
    const _s = (campo, val) => { const el = document.getElementById(`detalhes${campo}${suf}`); if (el) el.textContent = val || '-'; };

    // Salvar o ID no container para os botões de ação
    const container = document.getElementById(`detalhesConteudo${suf}`);
    if (container) container.dataset.id = d.id;

    _s('Titulo', d.resumo);
    _s('Status', d.status);
    _s('Ticket', d.demandaId || d.id);
    _s('Cliente', d.cliente?.nome || d.cliente?.email || 'Não identificado');

    const data = d.timestamps?.criada_em?.toDate?.()?.toLocaleString() || d.criado_em_formatado || '-';
    if (subAba === 'consulta') _s('DataCriacao', data);
    if (subAba === 'recebidas') _s('DataRecebido', data);
    if (subAba === 'encaminhadas') _s('DataEncaminhado', data);

    const dadosEl = document.getElementById(`detalhesDadosCliente${suf}`);
    if (dadosEl) {
      const c = d.cliente || {};
      dadosEl.innerHTML = c.email || c.nome || c.telefone
        ? `<p><strong>Email:</strong> ${Utils.escapeHtml(c.email || '-')}</p><p><strong>Nome:</strong> ${Utils.escapeHtml(c.nome || '-')}</p><p><strong>Telefone:</strong> ${Utils.escapeHtml(c.telefone || '-')}</p>`
        : `<p style="color:var(--color-text-light)">Sem dados de contato.</p>`;
    }

    const descEl = document.getElementById(`detalhesDescricao${suf}`);
    if (descEl) descEl.innerHTML = `<p>${Utils.escapeHtml(d.justificativa_encaminhamento || d.resumo || 'Sem detalhes.')}</p>`;

    const tlEl = document.getElementById(`detalhesTimeline${suf}`);
    if (tlEl) this._renderizarTimeline(tlEl, d.historico_status || []);

    if (subAba === 'recebidas') { _s('Origem', d.setor_origem?.toUpperCase()); _s('Prioridade', `${d.prioridade || 0} pts`); }
    if (subAba === 'encaminhadas') {
      _s('TempoDecorrido', d.tempo_decorrido);

      // Seção de recusa: só aparece se o status for RECUSADO
      const secaoRecusa = document.getElementById('secaoRecusaEncaminhadas');
      const parecerRecusa = document.getElementById('parecerRecusaEncaminhadas');
      const inputComplem = document.getElementById('inputComplementoReenvio');
      const estaRecusado = (d.status || '').toUpperCase() === 'RECUSADO';

      if (secaoRecusa) secaoRecusa.classList.toggle('hidden', !estaRecusado);

      if (estaRecusado && parecerRecusa) {
        // Tenta campo direto primeiro, depois busca no histórico
        const motivo = d.motivo_recusa
          || (d.historico_status || []).filter(h => h.acao === 'recusado').pop()?.justificativa
          || 'Motivo não informado.';
        parecerRecusa.innerHTML = `<p>${Utils.escapeHtml(motivo)}</p>`;
      }

      // Limpa o campo ao trocar de demanda
      if (inputComplem) inputComplem.value = '';
    }
  },

  _renderizarTimeline(container, historico) {
    if (!historico.length) { container.innerHTML = '<p style="font-size:0.85rem;color:#64748b;">Sem histórico.</p>'; return; }
    container.innerHTML = historico.map(item => `
      <div class="timeline-item">
        <span class="timeline-data">${item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}</span>
        <div class="timeline-conteudo"><strong>${Utils.escapeHtml(item.usuario || '-')}</strong> · ${Utils.escapeHtml(item.setor_destino || '-')}</div>
      </div>`).join('');
  },

  mostrarDetalhes(subAba) {
    const map = {
      consulta: { c: this.elements.detalhesConteudoConsulta, v: this.elements.detalhesVazioConsulta },
      recebidas: { c: this.elements.detalhesConteudoRecebidas, v: this.elements.detalhesVazioRecebidas },
      encaminhadas: { c: this.elements.detalhesConteudoEncaminhadas, v: this.elements.detalhesVazioEncaminhadas },
    };
    const d = map[subAba]; if (!d) return;
    d.v?.classList.add('hidden'); d.c?.classList.remove('hidden');
    if (window.innerWidth < 1024) d.c?.scrollIntoView({ behavior: 'smooth' });
  },

  fecharDetalhes(subAba) {
    const map = {
      consulta: { c: this.elements.detalhesConteudoConsulta, v: this.elements.detalhesVazioConsulta },
      recebidas: { c: this.elements.detalhesConteudoRecebidas, v: this.elements.detalhesVazioRecebidas },
      encaminhadas: { c: this.elements.detalhesConteudoEncaminhadas, v: this.elements.detalhesVazioEncaminhadas },
      minhas: { c: this.elements.detalhesConteudoMinhas, v: this.elements.detalhesVazioMinhas },
    };
    const d = map[subAba]; if (!d) return;
    d.c?.classList.add('hidden'); d.v?.classList.remove('hidden');
  },

  // ------------------------------------------------------------------
  // CICLO DE VIDA
  // ------------------------------------------------------------------

  async refresh() {
    if (!this._initialized) window.ModuleLifecycle.init(this.moduleId, () => this.init());
    else this.activateSubTab(this._activeSubTab);
  },

  cleanup() {
    console.log('🧹 Limpando DemandasTab...');
    this._unsubscribeRecebidas?.(); this._unsubscribeRecebidas = null;
    this._unsubscribeMinhas?.(); this._unsubscribeMinhas = null;
    window.ModuleLifecycle?.cleanup?.(this.moduleId);
    this._initialized = false; this._eventsBound = false; this.elements = {};
    this._cacheConsulta = this._cacheRecebidas = this._cacheEncaminhadas = this._cacheMinhas = [];
    console.log('✅ DemandasTab limpo');
  },

  debug() {
    console.group('🔍 DemandasTab DEBUG');
    console.log({
      initialized: this._initialized, eventsBound: this._eventsBound, activeSubTab: this._activeSubTab,
      caches: { consulta: this._cacheConsulta.length, recebidas: this._cacheRecebidas.length, encaminhadas: this._cacheEncaminhadas.length, minhas: this._cacheMinhas.length }
    });
    EstadoManager.debug();
    console.groupEnd();
  }
};

// ==================================================================================
// EXPORTAR
// ==================================================================================

window.DemandasTab = DemandasTab;
export default DemandasTab;

console.log('✅ demandas.js carregado');