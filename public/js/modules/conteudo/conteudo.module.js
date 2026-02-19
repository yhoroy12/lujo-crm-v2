/* ===============================
   CONTEUDO MODULE - REFATORADO
================================ */

const MODULE_ID = 'conteudo';

window.initConteudoModule = function() {
  console.log("🎵 Inicializando módulo Conteúdos & Aprovações");

  // Inicializar estado
  window.StateManager.init(MODULE_ID, {
    conteudos: [...MOCK_CONTEUDOS],
    currentEditingId: null,
    currentEncaminhamentoArea: null,
    filters: {
      status: '',
      etapa: ''
    }
  });

  initTabs();
  initModals();
  initFiltros();
  renderFila();
  atualizarEstatisticas();
};

/* ===============================
   DADOS MOCK
================================ */
function getOperadorAtual() {
  const user = window.PermissionsSystem?.getCurrentUser() || 
    JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  
  return {
    nome: user?.name || user?.username || 'Operador não identificado',
    role: user?.role || 'operador'
  };
}

const MOCK_CONTEUDOS = [
  {
    id: 'CNT-001',
    artista: 'Anitta',
    featuring: 'Maluma',
    titulo: 'Downtown',
    label: 'Warner Music',
    email: 'upload@warnermusic.com',
    etapa: 1,
    status: 'aguardando',
    responsavel: '-',
    data: '2025-01-10',
    avaliacao1: null,
    avaliacao2: null,
    historico: [
      { acao: 'Upload realizado', operador: 'Sistema', data: '2025-01-10 14:30', tipo: 'sistema' }
    ]
  },
  {
    id: 'CNT-002',
    artista: 'Projota',
    featuring: '',
    titulo: 'Muleque de Vila',
    label: 'Independent',
    email: 'projota@music.com',
    etapa: 1,
    status: 'aguardando',
    responsavel: '-',
    data: '2025-01-10',
    avaliacao1: null,
    avaliacao2: null,
    historico: [
      { acao: 'Upload realizado', operador: 'Sistema', data: '2025-01-10 15:20', tipo: 'sistema' }
    ]
  },
  {
    id: 'CNT-003',
    artista: 'Ludmilla',
    featuring: '',
    titulo: 'Cheguei',
    label: 'Warner Music',
    email: 'ludmilla@warnermusic.com',
    etapa: 2,
    status: 'aprovado_1',
    responsavel: getOperadorAtual().nome,
    data: '2025-01-09',
    avaliacao1: {
      decisao: 'AP',
      observacoes: 'Conteúdo aprovado para distribuição',
      operador: getOperadorAtual().nome,
      data: '2025-01-09 16:45'
    },
    avaliacao2: null,
    historico: [
      { acao: 'Upload realizado', operador: 'Sistema', data: '2025-01-09 10:30', tipo: 'sistema' },
      { acao: 'Aprovado na Etapa 1', operador: getOperadorAtual().nome, data: '2025-01-09 16:45', tipo: 'ap', detalhes: 'Conteúdo aprovado para distribuição' }
    ]
  }
];

/* ===============================
   TABS
================================ */
function initTabs() {
  window.TabManager.init('.modulo-painel-conteudo', MODULE_ID, {
    onTabChange: (tabId) => {
      console.log(`Conteudo: aba ${tabId}`);
      
      if (tabId === 'aba-fila') {
        renderFila();
      } else if (tabId === 'aba-aprovados') {
        renderAprovados();
      } else if (tabId === 'aba-recusados') {
        renderRecusados();
      }
    }
  });
}

/* ===============================
   MODALS
================================ */
function initModals() {
  // Modal Avaliação
  window.ModalManager.setup('modalAvaliacao', MODULE_ID, {
    onClose: () => {
      window.StateManager.set(MODULE_ID, { currentEditingId: null });
      resetAvaliacaoUI();
    }
  });

  // Modal Encaminhamento
  window.ModalManager.setup('modalEncaminhamento', MODULE_ID, {
    onClose: () => {
      window.StateManager.set(MODULE_ID, { currentEncaminhamentoArea: null });
    }
  });

  // Botões do modal de avaliação
  const btnAprovar1 = document.getElementById('btnAprovar1');
  const btnRecusar1 = document.getElementById('btnRecusar1');
  const btnRascunho = document.getElementById('btnRascunho');
  const btnDistribuir = document.getElementById('btnDistribuir');
  const btnRecusar2 = document.getElementById('btnRecusar2');

  if (btnAprovar1) {
    window.ModuleLifecycle.addListener(btnAprovar1, 'click', () => avaliar1('AP'), MODULE_ID);
  }
  if (btnRecusar1) {
    window.ModuleLifecycle.addListener(btnRecusar1, 'click', () => avaliar1('RE'), MODULE_ID);
  }
  if (btnRascunho) {
    window.ModuleLifecycle.addListener(btnRascunho, 'click', () => avaliar1('RA'), MODULE_ID);
  }
  if (btnDistribuir) {
    window.ModuleLifecycle.addListener(btnDistribuir, 'click', () => avaliar2('DI'), MODULE_ID);
  }
  if (btnRecusar2) {
    window.ModuleLifecycle.addListener(btnRecusar2, 'click', () => avaliar2('RE'), MODULE_ID);
  }

  // Botões de encaminhamento
  const btnEncaminharMarketing = document.getElementById('btnEncaminharMarketing');
  const btnEncaminharAtendimento = document.getElementById('btnEncaminharAtendimento');

  if (btnEncaminharMarketing) {
    window.ModuleLifecycle.addListener(btnEncaminharMarketing, 'click', () => abrirModalEncaminhamento('Marketing'), MODULE_ID);
  }
  if (btnEncaminharAtendimento) {
    window.ModuleLifecycle.addListener(btnEncaminharAtendimento, 'click', () => abrirModalEncaminhamento('Atendimento'), MODULE_ID);
  }

  // Form Encaminhamento
  const formEncaminhamento = document.getElementById('formEncaminhamento');
  if (formEncaminhamento) {
    window.ModuleLifecycle.addListener(formEncaminhamento, 'submit', (e) => {
      e.preventDefault();
      enviarEncaminhamento();
    }, MODULE_ID);
  }
}

/* ===============================
   FILTROS
================================ */
function initFiltros() {
  const filterConfig = window.ListManager.setupFilters({
    filterElements: {
      status: '#filtroStatus',
      etapa: '#filtroEtapa'
    },
    searchElement: '#searchConteudo',
    data: window.StateManager.get(MODULE_ID).conteudos,
    onFilter: (data, filters, searchTerm) => {
      renderFilaComFiltros(filters, searchTerm);
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
   RENDER FUNCTIONS
================================ */
function renderFila() {
  renderFilaComFiltros({}, '');
}

function renderFilaComFiltros(filters, searchTerm) {
  const state = window.StateManager.get(MODULE_ID);

  window.ListManager.render({
    data: state.conteudos,
    container: '#tabelaConteudos',
    template: (c) => `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td>${window.Utils.escapeHtml(c.artista)}${c.featuring ? ' ft. ' + window.Utils.escapeHtml(c.featuring) : ''}</td>
        <td>${window.Utils.escapeHtml(c.titulo)}</td>
        <td>Etapa ${c.etapa}</td>
        <td><span class="status-badge status-${c.status}">${getStatusLabel(c.status)}</span></td>
        <td>${window.Utils.escapeHtml(c.responsavel)}</td>
        <td>${window.Utils.formatDate(c.data)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary btn-avaliar" data-id="${c.id}">
            Avaliar Conteúdo
          </button>
        </td>
      </tr>
    `,
    filters: {
      status: (item) => !filters.status || item.status === filters.status,
      etapa: (item) => !filters.etapa || item.etapa === parseInt(filters.etapa)
    },
    searchFields: ['artista', 'titulo', 'id'],
    searchTerm,
    emptyMessage: 'Nenhum conteúdo encontrado',
    onRender: () => {
      // Adicionar listeners aos botões
      document.querySelectorAll('.btn-avaliar').forEach(btn => {
        window.ModuleLifecycle.addListener(btn, 'click', function() {
          avaliarConteudo(this.dataset.id);
        }, MODULE_ID);
      });
      
      atualizarEstatisticas();
    }
  });
}

function renderAprovados() {
  const state = window.StateManager.get(MODULE_ID);
  const aprovados = state.conteudos.filter(c => c.status === 'distribuido');

  window.ListManager.render({
    data: aprovados,
    container: '#tabelaAprovados',
    template: (c) => `
      <tr>
        <td>${c.id}</td>
        <td>${window.Utils.escapeHtml(c.artista)}${c.featuring ? ' ft. ' + window.Utils.escapeHtml(c.featuring) : ''}</td>
        <td>${window.Utils.escapeHtml(c.titulo)}</td>
        <td>${c.avaliacao2?.upc || '-'}</td>
        <td>${c.avaliacao2?.data || '-'}</td>
        <td>${window.Utils.escapeHtml(c.avaliacao2?.operador || '-')}</td>
      </tr>
    `,
    emptyMessage: 'Nenhum conteúdo distribuído ainda'
  });
}

function renderRecusados() {
  const state = window.StateManager.get(MODULE_ID);
  const recusados = state.conteudos.filter(c => c.status === 'recusado');

  window.ListManager.render({
    data: recusados,
    container: '#tabelaRecusados',
    template: (c) => {
      const motivo = c.avaliacao1?.decisao === 'RE' ? c.avaliacao1.observacoes : c.avaliacao2?.observacoes || '-';
      const data = c.avaliacao1?.decisao === 'RE' ? c.avaliacao1.data : c.avaliacao2?.data || '-';
      const operador = c.avaliacao1?.decisao === 'RE' ? c.avaliacao1.operador : c.avaliacao2?.operador || '-';
      
      return `
        <tr>
          <td>${c.id}</td>
          <td>${window.Utils.escapeHtml(c.artista)}${c.featuring ? ' ft. ' + window.Utils.escapeHtml(c.featuring) : ''}</td>
          <td>${window.Utils.escapeHtml(c.titulo)}</td>
          <td>${window.Utils.escapeHtml(motivo)}</td>
          <td>${data}</td>
          <td>${window.Utils.escapeHtml(operador)}</td>
        </tr>
      `;
    },
    emptyMessage: 'Nenhum conteúdo recusado'
  });
}

/* ===============================
   ESTATÍSTICAS
================================ */
function atualizarEstatisticas() {
  const state = window.StateManager.get(MODULE_ID);
  const conteudos = state.conteudos;

  setText('totalFila', conteudos.length);
  setText('totalAguardando', conteudos.filter(c => c.status === 'aguardando').length);
  setText('totalAnalise', conteudos.filter(c => c.status === 'aprovado_1').length);
  setText('totalDistribuidos', conteudos.filter(c => c.status === 'distribuido').length);
}

/* ===============================
   AVALIAÇÃO
================================ */
function avaliarConteudo(id) {
  resetAvaliacaoUI();
  
  const state = window.StateManager.get(MODULE_ID);
  const conteudo = state.conteudos.find(c => c.id === id);
  if (!conteudo) return;

  window.StateManager.set(MODULE_ID, { currentEditingId: id });

  document.getElementById('conteudoId').value = conteudo.id;
  document.getElementById('conteudoData').value = window.Utils.formatDate(conteudo.data);
  document.getElementById('conteudoArtista').value = conteudo.artista;
  document.getElementById('conteudoFeat').value = conteudo.featuring;
  document.getElementById('conteudoTitulo').value = conteudo.titulo;
  document.getElementById('conteudoLabel').value = conteudo.label;
  document.getElementById('conteudoEmail').value = conteudo.email;

  const editavel = !conteudo.avaliacao1;
  document.getElementById('conteudoArtista').readOnly = !editavel;
  document.getElementById('conteudoFeat').readOnly = !editavel;
  document.getElementById('conteudoTitulo').readOnly = !editavel;
  document.getElementById('conteudoLabel').readOnly = !editavel;
  document.getElementById('conteudoEmail').readOnly = !editavel;

  if (conteudo.avaliacao1) {
    document.getElementById('avaliacao1Pendente').classList.add('hidden');
    document.getElementById('avaliacao1Concluida').classList.remove('hidden');

    document.getElementById('decisao1').innerHTML = `<span class="action-badge ${conteudo.avaliacao1.decisao.toLowerCase()}">${conteudo.avaliacao1.decisao}</span>`;
    document.getElementById('operador1').textContent = conteudo.avaliacao1.operador;
    document.getElementById('dataAvaliacao1').textContent = conteudo.avaliacao1.data;
    document.getElementById('obsTexto1').textContent = conteudo.avaliacao1.observacoes;

    if (conteudo.avaliacao1.decisao === 'AP') {
      document.getElementById('blocoAvaliacao2').classList.remove('hidden');

      if (conteudo.avaliacao2) {
        document.getElementById('avaliacao2Pendente').classList.add('hidden');
        document.getElementById('avaliacao2Concluida').classList.remove('hidden');

        document.getElementById('decisao2').innerHTML = `<span class="action-badge ${conteudo.avaliacao2.decisao.toLowerCase()}">${conteudo.avaliacao2.decisao}</span>`;
        document.getElementById('upcFinal').textContent = conteudo.avaliacao2.upc || '-';
        document.getElementById('operador2').textContent = conteudo.avaliacao2.operador;
        document.getElementById('dataAvaliacao2').textContent = conteudo.avaliacao2.data;
      } else {
        document.getElementById('avaliacao2Pendente').classList.remove('hidden');
        document.getElementById('avaliacao2Concluida').classList.add('hidden');
      }
    } else {
      document.getElementById('blocoAvaliacao2').classList.add('hidden');
    }
  } else {
    document.getElementById('avaliacao1Pendente').classList.remove('hidden');
    document.getElementById('avaliacao1Concluida').classList.add('hidden');
    document.getElementById('blocoAvaliacao2').classList.add('hidden');
  }

  renderTimeline(conteudo);
  window.ModalManager.open('modalAvaliacao');
}

function avaliar1(decisao) {
  const state = window.StateManager.get(MODULE_ID);
  const conteudo = state.conteudos.find(c => c.id === state.currentEditingId);
  
  if (!conteudo) return;

  const obs = document.getElementById('obs1').value;

  if (!obs && decisao !== 'AP') {
    alert('Por favor, adicione observações antes de ' + (decisao === 'RE' ? 'recusar' : 'retornar para rascunho'));
    return;
  }

  const confirmMsg = decisao === 'AP' ? 'Aprovar este conteúdo?' :
                     decisao === 'RE' ? 'Recusar este conteúdo?' :
                     'Retornar para rascunho?';

  if (!confirm(confirmMsg)) return;

  // Atualizar dados do conteúdo
  conteudo.artista = document.getElementById('conteudoArtista').value;
  conteudo.featuring = document.getElementById('conteudoFeat').value;
  conteudo.titulo = document.getElementById('conteudoTitulo').value;
  conteudo.label = document.getElementById('conteudoLabel').value;
  conteudo.email = document.getElementById('conteudoEmail').value;

  conteudo.avaliacao1 = {
    decisao: decisao,
    observacoes: obs || 'Aprovado',
    operador: getOperadorAtual().nome,
    data: new Date().toLocaleString('pt-BR')
  };

  if (decisao === 'AP') {
    conteudo.status = 'aprovado_1';
    conteudo.etapa = 2;
    conteudo.responsavel = getOperadorAtual().nome;
    conteudo.historico.push({
      acao: 'Aprovado na Etapa 1',
      operador: getOperadorAtual().nome,
      data: new Date().toLocaleString('pt-BR'),
      tipo: 'ap',
      detalhes: obs || 'Aprovado'
    });
  } else if (decisao === 'RE') {
    conteudo.status = 'recusado';
    conteudo.historico.push({
      acao: 'Recusado na Etapa 1',
      operador: getOperadorAtual().nome,
      data: new Date().toLocaleString('pt-BR'),
      tipo: 're',
      detalhes: obs
    });
  } else {
    conteudo.historico.push({
      acao: 'Retornado para Rascunho',
      operador: getOperadorAtual().nome,
      data: new Date().toLocaleString('pt-BR'),
      tipo: 'ra',
      detalhes: obs
    });
  }

  // Atualizar estado
  const newConteudos = state.conteudos.map(c => c.id === conteudo.id ? conteudo : c);
  window.StateManager.set(MODULE_ID, { 
    conteudos: newConteudos,
    currentEditingId: null
  });

  document.getElementById('obs1').value = '';
  window.ModalManager.close('modalAvaliacao');
  renderFila();
  alert('Avaliação registrada com sucesso!');
}

function avaliar2(decisao) {
  const state = window.StateManager.get(MODULE_ID);
  const conteudo = state.conteudos.find(c => c.id === state.currentEditingId);
  
  if (!conteudo) return;

  const upc = document.getElementById('upcCode').value;
  const obs = document.getElementById('obs2').value;

  if (decisao === 'DI' && !upc) {
    alert('UPC é obrigatório para distribuir o conteúdo');
    return;
  }

  const confirmMsg = decisao === 'DI' ? 'Distribuir este conteúdo?' : 'Recusar este conteúdo?';

  if (!confirm(confirmMsg)) return;

  conteudo.avaliacao2 = {
    decisao: decisao,
    upc: upc,
    observacoes: obs || (decisao === 'DI' ? 'Distribuído' : 'Recusado'),
    operador: getOperadorAtual().nome,
    data: new Date().toLocaleString('pt-BR')
  };

  if (decisao === 'DI') {
    conteudo.status = 'distribuido';
    conteudo.historico.push({
      acao: 'Distribuído',
      operador: getOperadorAtual().nome,
      data: new Date().toLocaleString('pt-BR'),
      tipo: 'di',
      detalhes: `UPC: ${upc}`
    });
  } else {
    conteudo.status = 'recusado';
    conteudo.historico.push({
      acao: 'Recusado na Etapa 2',
      operador: getOperadorAtual().nome,
      data: new Date().toLocaleString('pt-BR'),
      tipo: 're',
      detalhes: obs || 'Recusado'
    });
  }

  // Atualizar estado
  const newConteudos = state.conteudos.map(c => c.id === conteudo.id ? conteudo : c);
  window.StateManager.set(MODULE_ID, { 
    conteudos: newConteudos,
    currentEditingId: null
  });

  document.getElementById('upcCode').value = '';
  document.getElementById('obs2').value = '';
  window.ModalManager.close('modalAvaliacao');
  renderFila();
  alert('Avaliação registrada com sucesso!');
}

/* ===============================
   TIMELINE
================================ */
function renderTimeline(conteudo) {
  const container = document.getElementById('timelineConteudo');
  if (!container) return;

  container.innerHTML = conteudo.historico.map(h => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-action">
            ${window.Utils.escapeHtml(h.acao)}
            ${h.tipo !== 'sistema' ? `<span class="action-badge ${h.tipo}">${h.tipo.toUpperCase()}</span>` : ''}
          </span>
          <span class="timeline-date">${h.data}</span>
        </div>
        <div class="timeline-details">
          <strong>Operador:</strong> ${window.Utils.escapeHtml(h.operador)}
          ${h.detalhes ? `<br><strong>Detalhes:</strong> ${window.Utils.escapeHtml(h.detalhes)}` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* ===============================
   ENCAMINHAMENTO
================================ */
function abrirModalEncaminhamento(area) {
  window.StateManager.set(MODULE_ID, { currentEncaminhamentoArea: area });
  
  document.getElementById('encaminhamentoTitulo').textContent = `Encaminhar para ${area}`;
  document.getElementById('mensagemEncaminhamento').value = '';
  window.ModalManager.open('modalEncaminhamento');
}

function enviarEncaminhamento() {
  const mensagem = document.getElementById('mensagemEncaminhamento').value;

  if (!mensagem.trim()) {
    alert('Digite uma mensagem antes de enviar');
    return;
  }

  const state = window.StateManager.get(MODULE_ID);
  const conteudo = state.conteudos.find(c => c.id === state.currentEditingId);

  if (!conteudo) return;

  conteudo.historico.push({
    acao: `Encaminhado para ${state.currentEncaminhamentoArea}`,
    operador: 'Sistema',
    data: new Date().toLocaleString('pt-BR'),
    tipo: 'enc',
    detalhes: mensagem
  });

  // Atualizar estado
  const newConteudos = state.conteudos.map(c => c.id === conteudo.id ? conteudo : c);
  window.StateManager.set(MODULE_ID, { 
    conteudos: newConteudos,
    currentEncaminhamentoArea: null
  });

  renderTimeline(conteudo);
  window.ModalManager.close('modalEncaminhamento');
  alert(`Conteúdo encaminhado para ${state.currentEncaminhamentoArea} com sucesso!`);
}

/* ===============================
   UTILS
================================ */
function getStatusLabel(status) {
  const labels = {
    'aguardando': 'Aguardando',
    'aprovado_1': 'Aprovado - Etapa 1',
    'distribuido': 'Distribuído',
    'recusado': 'Recusado'
  };
  return labels[status] || status;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function resetAvaliacaoUI() {
  // Esconde blocos condicionais
  const etapa2 = document.querySelector('.avaliacao-etapa-2');
  if (etapa2) etapa2.style.display = 'none';

  // Limpa campos de texto
  document.querySelectorAll(
    'textarea, input[type="text"], input[type="number"]'
  ).forEach(input => {
    if (!input.readOnly) input.value = '';
  });

  // Remove status visuais ativos
  document.querySelectorAll('.status-badge').forEach(badge => {
    badge.className = 'status-badge';
    badge.textContent = '';
  });

  // Limpa histórico visual
  const timeline = document.querySelector('.timeline');
  if (timeline) timeline.innerHTML = '';

  // Remove estados ativos de botões
  document.querySelectorAll('.btn-acao').forEach(btn => {
    btn.classList.remove('ativa');
  });
}

console.log("✅ Módulo Conteúdos & Aprovações refatorado carregado");
