/**
 * =====================================================
 * FINANCEIRO.JS — VERSÃO REFATORADA
 * =====================================================
 */

const MODULE_ID = 'financeiro';

window.initFinanceiroModule = function() {
  console.log("💰 Inicializando módulo Financeiro");
  
  // Inicializar estado
  window.StateManager.init(MODULE_ID, {
    lancamentos: [...MOCK_LANCAMENTOS],
    currentEditingId: null,
    currentApprovalId: null,
    currentPaymentId: null,
    filters: {
      tipo: '',
      status: '',
      periodo: ''
    }
  });

  initTabs();
  initModals();
  initButtons();
  atualizarDashboard();
  renderLancamentos();
};

/* ===============================
   DADOS MOCK
================================ */
const MOCK_LANCAMENTOS = [
  {
    id: 'LAN-001',
    data: '2025-01-10',
    descricao: 'Pagamento Fornecedor XYZ',
    tipo: 'despesa',
    categoria: 'fornecedores',
    valor: 5000,
    solicitante: 'Ana Silva',
    status: 'pendente',
    criadoEm: '2025-01-10 14:30'
  },
  {
    id: 'LAN-002',
    data: '2025-01-09',
    descricao: 'Venda de Serviços - Cliente ABC',
    tipo: 'receita',
    categoria: 'servicos',
    valor: 15000,
    solicitante: 'Carlos Souza',
    status: 'aprovado',
    criadoEm: '2025-01-09 10:20'
  },
  {
    id: 'LAN-003',
    data: '2025-01-08',
    descricao: 'Adiantamento Colaborador',
    tipo: 'adiantamento',
    categoria: 'salarios',
    valor: 2000,
    solicitante: 'Marina Lopes',
    status: 'pago',
    criadoEm: '2025-01-08 16:45',
    pagoEm: '2025-01-09 09:00'
  }
];

/* ===============================
   TABS
================================ */
function initTabs() {
  window.TabManager.init('.modulo-painel-financeiro', MODULE_ID, {
    onTabChange: (tabId) => {
      console.log(`Financeiro: aba ${tabId}`);
      
      // Atualizar conteúdo específico da aba
      if (tabId === 'aba-visao-geral') {
        atualizarDashboard();
      } else if (tabId === 'aba-lancamentos') {
        renderLancamentos();
      } else if (tabId === 'aba-aprovacoes') {
        renderAprovacoes();
      } else if (tabId === 'aba-pagamentos') {
        renderPagamentos();
      }
    }
  });
}

/* ===============================
   MODALS
================================ */
function initModals() {
  // Modal Lançamento
  window.ModalManager.setup('modalLancamento', MODULE_ID, {
    onClose: () => {
      window.StateManager.set(MODULE_ID, { currentEditingId: null });
    }
  });

  // Modal Aprovação
  window.ModalManager.setup('modalAprovacao', MODULE_ID, {
    onClose: () => {
      window.StateManager.set(MODULE_ID, { currentApprovalId: null });
    }
  });

  // Modal Pagamento
  window.ModalManager.setup('modalPagamento', MODULE_ID, {
    onClose: () => {
      window.StateManager.set(MODULE_ID, { currentPaymentId: null });
    }
  });

  // Form Lançamento
  const formLancamento = document.getElementById('formLancamento');
  if (formLancamento) {
    window.ModuleLifecycle.addListener(formLancamento, 'submit', (e) => {
      e.preventDefault();
      salvarLancamento();
    }, MODULE_ID);
  }

  // Form Pagamento
  const formPagamento = document.getElementById('formPagamento');
  if (formPagamento) {
    window.ModuleLifecycle.addListener(formPagamento, 'submit', (e) => {
      e.preventDefault();
      registrarPagamento();
    }, MODULE_ID);
  }
}

/* ===============================
   BUTTONS
================================ */
function initButtons() {
  // Botão Novo Lançamento
  const btnNovo = document.getElementById('btnNovoLancamento');
  if (btnNovo) {
    window.ModuleLifecycle.addListener(btnNovo, 'click', () => {
      if (!window.PermissionsSystem?.hasPermission('financeiro.create')) {
        alert('Você não tem permissão para criar lançamentos.');
        return;
      }
      abrirModalNovoLancamento();
    }, MODULE_ID);
  }

  // Botões de aprovação
  const btnAprovar = document.getElementById('btnAprovar');
  const btnRejeitar = document.getElementById('btnRejeitar');
  const btnSolicitarAjuste = document.getElementById('btnSolicitarAjuste');

  if (btnAprovar) {
    window.ModuleLifecycle.addListener(btnAprovar, 'click', () => {
      aprovarLancamento();
    }, MODULE_ID);
  }

  if (btnRejeitar) {
    window.ModuleLifecycle.addListener(btnRejeitar, 'click', () => {
      rejeitarLancamento();
    }, MODULE_ID);
  }

  if (btnSolicitarAjuste) {
    window.ModuleLifecycle.addListener(btnSolicitarAjuste, 'click', () => {
      solicitarAjuste();
    }, MODULE_ID);
  }

  // Botão Ver Todos (Dashboard)
  const btnVerTodos = document.querySelector('[data-action="ir-lancamentos"]');
  if (btnVerTodos) {
    window.ModuleLifecycle.addListener(btnVerTodos, 'click', () => {
      window.TabManager.activateTab('.modulo-painel-financeiro', 'aba-lancamentos');
    }, MODULE_ID);
  }

  // Filtros
  initFiltros();
}

/* ===============================
   FILTROS
================================ */
function initFiltros() {
  const filterConfig = window.ListManager.setupFilters({
    filterElements: {
      tipo: '#filtroTipo',
      status: '#filtroStatus',
      periodo: '#filtroPeriodo'
    },
    searchElement: '#searchLancamento',
    data: window.StateManager.get(MODULE_ID).lancamentos,
    onFilter: (data, filters, searchTerm) => {
      renderLancamentosComFiltros(filters, searchTerm);
    },
    moduleId: MODULE_ID
  });

  // Botão Limpar Filtros
  const btnLimpar = document.getElementById('btnLimparFiltros');
  if (btnLimpar) {
    window.ModuleLifecycle.addListener(btnLimpar, 'click', () => {
      filterConfig.clear();
    }, MODULE_ID);
  }
}

/* ===============================
   DASHBOARD
================================ */
function atualizarDashboard() {
  const state = window.StateManager.get(MODULE_ID);
  const lancamentos = state.lancamentos;

  // Calcular métricas
  const receitas = lancamentos
    .filter(l => l.tipo === 'receita' && l.status === 'pago')
    .reduce((acc, l) => acc + l.valor, 0);

  const despesas = lancamentos
    .filter(l => l.tipo === 'despesa' && l.status === 'pago')
    .reduce((acc, l) => acc + l.valor, 0);

  const aReceber = lancamentos
    .filter(l => l.tipo === 'receita' && l.status === 'aprovado')
    .reduce((acc, l) => acc + l.valor, 0);

  const aPagar = lancamentos
    .filter(l => l.tipo === 'despesa' && l.status === 'aprovado')
    .reduce((acc, l) => acc + l.valor, 0);

  const saldoAtual = receitas - despesas;

  // Atualizar UI
  setText('saldoAtual', window.Utils.formatCurrency(saldoAtual));
  setText('aReceber', window.Utils.formatCurrency(aReceber));
  setText('aPagar', window.Utils.formatCurrency(aPagar));
  setText('despesasMes', window.Utils.formatCurrency(despesas));
  setText('resultadoMes', window.Utils.formatCurrency(saldoAtual));
  setText('totalReceitas', window.Utils.formatCurrency(receitas));
  setText('totalDespesas', window.Utils.formatCurrency(despesas));

  // Últimos lançamentos
  renderUltimosLancamentos();
}

function renderUltimosLancamentos() {
  const state = window.StateManager.get(MODULE_ID);
  const ultimos = state.lancamentos.slice(0, 5);

  window.ListManager.render({
    data: ultimos,
    container: '#ultimosLancamentos',
    template: (lanc) => `
      <tr>
        <td>${window.Utils.formatDate(lanc.data)}</td>
        <td>${window.Utils.escapeHtml(lanc.descricao)}</td>
        <td><span class="tipo-badge tipo-${lanc.tipo}">${lanc.tipo}</span></td>
        <td>${lanc.categoria}</td>
        <td>${window.Utils.formatCurrency(lanc.valor)}</td>
        <td><span class="status-badge status-${lanc.status}">${getStatusLabel(lanc.status)}</span></td>
      </tr>
    `,
    emptyMessage: 'Nenhum lançamento encontrado'
  });
}

/* ===============================
   LANÇAMENTOS
================================ */
function renderLancamentos() {
  renderLancamentosComFiltros({}, '');
}

function renderLancamentosComFiltros(filters, searchTerm) {
  const state = window.StateManager.get(MODULE_ID);

  window.ListManager.render({
    data: state.lancamentos,
    container: '#tabelaLancamentos',
    template: (lanc) => `
      <tr>
        <td><strong>${lanc.id}</strong></td>
        <td>${window.Utils.formatDate(lanc.data)}</td>
        <td>${window.Utils.escapeHtml(lanc.descricao)}</td>
        <td><span class="tipo-badge tipo-${lanc.tipo}">${lanc.tipo}</span></td>
        <td>${lanc.categoria}</td>
        <td><strong>${window.Utils.formatCurrency(lanc.valor)}</strong></td>
        <td>${window.Utils.escapeHtml(lanc.solicitante)}</td>
        <td><span class="status-badge status-${lanc.status}">${getStatusLabel(lanc.status)}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-secondary btn-editar" data-id="${lanc.id}">
            Editar
          </button>
        </td>
      </tr>
    `,
    filters: {
      tipo: (item) => !filters.tipo || item.tipo === filters.tipo,
      status: (item) => !filters.status || item.status === filters.status
    },
    searchFields: ['descricao', 'solicitante', 'id'],
    searchTerm,
    emptyMessage: 'Nenhum lançamento encontrado',
    onRender: () => {
      // Atualizar contador
      const state = window.StateManager.get(MODULE_ID);
      setText('totalLancamentos', `${state.lancamentos.length} registros`);

      // Adicionar listeners
      document.querySelectorAll('.btn-editar').forEach(btn => {
        window.ModuleLifecycle.addListener(btn, 'click', function() {
          editarLancamento(this.dataset.id);
        }, MODULE_ID);
      });
    }
  });
}

/* ===============================
   APROVAÇÕES
================================ */
function renderAprovacoes() {
  const state = window.StateManager.get(MODULE_ID);
  const pendentes = state.lancamentos.filter(l => l.status === 'pendente');

  // Atualizar estatísticas
  const valorTotal = pendentes.reduce((acc, l) => acc + l.valor, 0);
  setText('statPendentes', pendentes.length);
  setText('statValorPendente', window.Utils.formatCurrency(valorTotal));

  window.ListManager.render({
    data: pendentes,
    container: '#tabelaAprovacoes',
    template: (lanc) => `
      <tr>
        <td><strong>${lanc.id}</strong></td>
        <td>${window.Utils.formatDate(lanc.data)}</td>
        <td>${window.Utils.escapeHtml(lanc.solicitante)}</td>
        <td>${window.Utils.escapeHtml(lanc.descricao)}</td>
        <td><span class="tipo-badge tipo-${lanc.tipo}">${lanc.tipo}</span></td>
        <td><strong>${window.Utils.formatCurrency(lanc.valor)}</strong></td>
        <td>${window.Utils.formatDate(lanc.criadoEm, true)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary btn-analisar" data-id="${lanc.id}">
            Analisar
          </button>
        </td>
      </tr>
    `,
    emptyMessage: 'Nenhum lançamento pendente de aprovação',
    onRender: () => {
      document.querySelectorAll('.btn-analisar').forEach(btn => {
        window.ModuleLifecycle.addListener(btn, 'click', function() {
          abrirModalAprovacao(this.dataset.id);
        }, MODULE_ID);
      });
    }
  });
}

/* ===============================
   PAGAMENTOS
================================ */
function renderPagamentos() {
  const state = window.StateManager.get(MODULE_ID);
  const aprovados = state.lancamentos.filter(l => 
    l.status === 'aprovado' || l.status === 'pago'
  );

  // Estatísticas
  const aguardando = aprovados
    .filter(l => l.status === 'aprovado')
    .reduce((acc, l) => acc + l.valor, 0);
  
  const pagos = aprovados
    .filter(l => l.status === 'pago')
    .reduce((acc, l) => acc + l.valor, 0);

  setText('statAguardandoPagamento', window.Utils.formatCurrency(aguardando));
  setText('statPagosEsteMes', window.Utils.formatCurrency(pagos));
  setText('statTotalTransacoes', aprovados.length);

  window.ListManager.render({
    data: aprovados,
    container: '#tabelaPagamentos',
    template: (lanc) => `
      <tr>
        <td><strong>${lanc.id}</strong></td>
        <td>${window.Utils.formatDate(lanc.data)}</td>
        <td>${window.Utils.escapeHtml(lanc.descricao)}</td>
        <td>${lanc.solicitante || '-'}</td>
        <td><strong>${window.Utils.formatCurrency(lanc.valor)}</strong></td>
        <td><span class="status-badge status-${lanc.status}">${getStatusLabel(lanc.status)}</span></td>
        <td>${lanc.pagoEm ? window.Utils.formatDate(lanc.pagoEm, true) : '-'}</td>
        <td class="text-center">
          ${lanc.status === 'aprovado' ? `
            <button class="btn btn-sm btn-success btn-pagar" data-id="${lanc.id}">
              Registrar Pagamento
            </button>
          ` : '-'}
        </td>
      </tr>
    `,
    emptyMessage: 'Nenhum pagamento encontrado',
    onRender: () => {
      document.querySelectorAll('.btn-pagar').forEach(btn => {
        window.ModuleLifecycle.addListener(btn, 'click', function() {
          abrirModalPagamento(this.dataset.id);
        }, MODULE_ID);
      });
    }
  });
}

/* ===============================
   MODAL LANÇAMENTO
================================ */
function abrirModalNovoLancamento() {
  window.StateManager.set(MODULE_ID, { currentEditingId: null });
  
  document.getElementById('modalLancamentoTitulo').textContent = 'Novo Lançamento';
  document.getElementById('formLancamento').reset();
  
  // Data padrão = hoje
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('lancamentoData').value = hoje;
  
  window.ModalManager.open('modalLancamento');
}

function editarLancamento(id) {
  const state = window.StateManager.get(MODULE_ID);
  const lanc = state.lancamentos.find(l => l.id === id);
  
  if (!lanc) return;

  window.StateManager.set(MODULE_ID, { currentEditingId: id });

  document.getElementById('modalLancamentoTitulo').textContent = 'Editar Lançamento';
  document.getElementById('lancamentoTipo').value = lanc.tipo;
  document.getElementById('lancamentoData').value = lanc.data;
  document.getElementById('lancamentoDescricao').value = lanc.descricao;
  document.getElementById('lancamentoCategoria').value = lanc.categoria;
  document.getElementById('lancamentoValor').value = lanc.valor;
  document.getElementById('lancamentoBeneficiario').value = lanc.beneficiario || '';
  document.getElementById('lancamentoFormaPagamento').value = lanc.formaPagamento || '';
  document.getElementById('lancamentoObservacoes').value = lanc.observacoes || '';

  window.ModalManager.open('modalLancamento');
}

function salvarLancamento() {
  const state = window.StateManager.get(MODULE_ID);
  
  const lancData = {
    tipo: document.getElementById('lancamentoTipo').value,
    data: document.getElementById('lancamentoData').value,
    descricao: document.getElementById('lancamentoDescricao').value,
    categoria: document.getElementById('lancamentoCategoria').value,
    valor: parseFloat(document.getElementById('lancamentoValor').value),
    beneficiario: document.getElementById('lancamentoBeneficiario').value,
    formaPagamento: document.getElementById('lancamentoFormaPagamento').value,
    observacoes: document.getElementById('lancamentoObservacoes').value
  };

  let newLancamentos;

  if (state.currentEditingId) {
    // Editar
    newLancamentos = state.lancamentos.map(l =>
      l.id === state.currentEditingId ? { ...l, ...lancData } : l
    );
  } else {
    // Criar
    const user = window.PermissionsSystem?.getCurrentUser();
    const novoLanc = {
      id: `LAN-${Date.now().toString().slice(-6)}`,
      ...lancData,
      solicitante: user?.name || 'Sistema',
      status: 'pendente',
      criadoEm: new Date().toISOString()
    };
    newLancamentos = [novoLanc, ...state.lancamentos];
  }

  window.StateManager.set(MODULE_ID, { 
    lancamentos: newLancamentos,
    currentEditingId: null
  });

  window.ModalManager.close('modalLancamento');
  renderLancamentos();
  atualizarDashboard();
  
  alert('Lançamento salvo com sucesso!');
}

/* ===============================
   MODAL APROVAÇÃO
================================ */
function abrirModalAprovacao(id) {
  const state = window.StateManager.get(MODULE_ID);
  const lanc = state.lancamentos.find(l => l.id === id);
  
  if (!lanc) return;

  window.StateManager.set(MODULE_ID, { currentApprovalId: id });

  const detalhes = document.getElementById('detalhesAprovacao');
  if (detalhes) {
    detalhes.innerHTML = `
      <div class="detalhe-linha">
        <span class="detalhe-label">ID:</span>
        <span class="detalhe-valor">${lanc.id}</span>
      </div>
      <div class="detalhe-linha">
        <span class="detalhe-label">Data:</span>
        <span class="detalhe-valor">${window.Utils.formatDate(lanc.data)}</span>
      </div>
      <div class="detalhe-linha">
        <span class="detalhe-label">Descrição:</span>
        <span class="detalhe-valor">${window.Utils.escapeHtml(lanc.descricao)}</span>
      </div>
      <div class="detalhe-linha">
        <span class="detalhe-label">Tipo:</span>
        <span class="detalhe-valor"><span class="tipo-badge tipo-${lanc.tipo}">${lanc.tipo}</span></span>
      </div>
      <div class="detalhe-linha">
        <span class="detalhe-label">Valor:</span>
        <span class="detalhe-valor"><strong>${window.Utils.formatCurrency(lanc.valor)}</strong></span>
      </div>
      <div class="detalhe-linha">
        <span class="detalhe-label">Solicitante:</span>
        <span class="detalhe-valor">${window.Utils.escapeHtml(lanc.solicitante)}</span>
      </div>
    `;
  }

  window.ModalManager.open('modalAprovacao');
}

function aprovarLancamento() {
  if (!confirm('Aprovar este lançamento?')) return;

  const state = window.StateManager.get(MODULE_ID);
  const newLancamentos = state.lancamentos.map(l =>
    l.id === state.currentApprovalId ? { ...l, status: 'aprovado' } : l
  );

  window.StateManager.set(MODULE_ID, { 
    lancamentos: newLancamentos,
    currentApprovalId: null
  });

  window.ModalManager.close('modalAprovacao');
  renderAprovacoes();
  
  alert('Lançamento aprovado!');
}

function rejeitarLancamento() {
  if (!confirm('Rejeitar este lançamento?')) return;

  const state = window.StateManager.get(MODULE_ID);
  const newLancamentos = state.lancamentos.map(l =>
    l.id === state.currentApprovalId ? { ...l, status: 'rejeitado' } : l
  );

  window.StateManager.set(MODULE_ID, { 
    lancamentos: newLancamentos,
    currentApprovalId: null
  });

  window.ModalManager.close('modalAprovacao');
  renderAprovacoes();
  
  alert('Lançamento rejeitado!');
}

function solicitarAjuste() {
  alert('Solicitação de ajuste enviada!');
  window.ModalManager.close('modalAprovacao');
}

/* ===============================
   MODAL PAGAMENTO
================================ */
function abrirModalPagamento(id) {
  const state = window.StateManager.get(MODULE_ID);
  const lanc = state.lancamentos.find(l => l.id === id);
  
  if (!lanc) return;

  window.StateManager.set(MODULE_ID, { currentPaymentId: id });

  const info = document.getElementById('infoLancamentoPagamento');
  if (info) {
    info.innerHTML = `
      <strong>${lanc.descricao}</strong>
      <p>Valor: ${window.Utils.formatCurrency(lanc.valor)}</p>
      <p>Solicitante: ${window.Utils.escapeHtml(lanc.solicitante)}</p>
    `;
  }

  // Data padrão = hoje
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('pagamentoData').value = hoje;

  window.ModalManager.open('modalPagamento');
}

function registrarPagamento() {
  const state = window.StateManager.get(MODULE_ID);
  
  const newLancamentos = state.lancamentos.map(l =>
    l.id === state.currentPaymentId 
      ? { ...l, status: 'pago', pagoEm: new Date().toISOString() }
      : l
  );

  window.StateManager.set(MODULE_ID, { 
    lancamentos: newLancamentos,
    currentPaymentId: null
  });

  window.ModalManager.close('modalPagamento');
  renderPagamentos();
  atualizarDashboard();
  
  alert('Pagamento registrado com sucesso!');
}

/* ===============================
   UTILS
================================ */
function getStatusLabel(status) {
  const labels = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    pago: 'Pago',
    ajuste: 'Ajuste Solicitado'
  };
  return labels[status] || status;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

console.log("✅ Financeiro module refatorado carregado");