/* ===============================
   COPYRIGHT MODULE - SEGURO CONTRA DUPLICATAS (v2)
================================ */

// ✅ CORREÇÃO: Verificar se MODULE_ID já existe antes de declarar
const MODULE_ID = window.copyrightModuleId || 'copyright';
// Armazenar globalmente para reutilizar em carregamentos seguintes
window.copyrightModuleId = MODULE_ID;

// ✅ CORREÇÃO: Não declarar a função init globalmente,
// apenas chamar quando necessário
if (typeof window.initCopyrightModule === 'undefined') {
  window.initCopyrightModule = function() {
    console.log("📦 Inicializando módulo Copyright");

    // Inicializar estado (StateManager cuida de não reinicializar)
    window.StateManager.init(MODULE_ID, {
      demandas: [...MOCK_DEMANDAS],
      artistas: [...MOCK_ARTISTAS],
      templates: [...MOCK_TEMPLATES],
      selectedArtista: null,
      selectedTemplate: null,
      currentEditingId: null
    });

    initTabs();
    initDashboard();
  };
}

/* ===============================
   DADOS MOCK
================================ */
const MOCK_DEMANDAS = [
  {
    id: 'TKT-001',
    cliente: 'Anitta',
    tipo: 'YouTube Claim',
    descricao: '3 claims recebidos necessitam resposta imediata',
    plataforma: 'YouTube',
    status: 'urgente',
    prazo: '24h',
    area: 'Jurídico',
    criado: 'Hoje, 09:30',
    responsavel: 'Juan Copyright',
    prioridade: 'alta'
  },
  {
    id: 'TKT-002',
    cliente: 'Projota',
    tipo: 'Documentação',
    descricao: 'Financeiro aguarda documentação para liberar pagamento',
    plataforma: 'Spotify',
    status: 'pendente',
    prazo: '2 dias',
    area: 'Financeiro',
    criado: 'Ontem, 14:20',
    responsavel: 'Maria Financeiro',
    prioridade: 'media'
  },
  {
    id: 'TKT-003',
    cliente: 'Ludmilla',
    tipo: 'Verificação de Conta',
    descricao: 'Conta Spotify pendente de verificação',
    plataforma: 'Spotify',
    status: 'andamento',
    prazo: '3 dias',
    area: 'Técnico',
    criado: '2 dias atrás',
    responsavel: 'Carlos Técnico',
    prioridade: 'baixa'
  },
  {
    id: 'TKT-004',
    cliente: 'MC Kevin',
    tipo: 'Contrato',
    descricao: 'Revisão de contrato de renovação',
    plataforma: 'Todas',
    status: 'resolvido',
    prazo: 'Concluído',
    area: 'Jurídico',
    criado: '3 dias atrás',
    responsavel: 'Juan Copyright',
    prioridade: 'media'
  },
  {
    id: 'TKT-005',
    cliente: 'Jão',
    tipo: 'Takedown Request',
    descricao: 'Solicitação de remoção de conteúdo não autorizado',
    plataforma: 'YouTube',
    status: 'urgente',
    prazo: '12h',
    area: 'Jurídico',
    criado: 'Hoje, 11:00',
    responsavel: 'Juan Copyright',
    prioridade: 'alta'
  }
];

const MOCK_ARTISTAS = [
  {
    id: 'ART-001',
    nome: 'Anitta',
    contrato: 'Ativo',
    plataformas: ['YouTube', 'Spotify', 'Deezer', 'Apple Music', 'TikTok'],
    ultimoContato: 'Hoje',
    documentos: 'Completo',
    pendentes: 3,
    email: 'anitta@email.com',
    telefone: '(11) 99999-9999'
  },
  {
    id: 'ART-002',
    nome: 'Projota',
    contrato: 'Ativo',
    plataformas: ['YouTube', 'Spotify', 'Deezer'],
    ultimoContato: '2 dias',
    documentos: 'Pendente',
    pendentes: 1,
    email: 'projota@email.com',
    telefone: '(11) 98888-8888'
  },
  {
    id: 'ART-003',
    nome: 'Ludmilla',
    contrato: 'Ativo',
    plataformas: ['YouTube', 'Spotify', 'Apple Music'],
    ultimoContato: '3 dias',
    documentos: 'Completo',
    pendentes: 1,
    email: 'ludmilla@email.com',
    telefone: '(11) 97777-7777'
  },
  {
    id: 'ART-004',
    nome: 'MC Kevin',
    contrato: 'Ativo',
    plataformas: ['YouTube', 'Spotify'],
    ultimoContato: '1 semana',
    documentos: 'Completo',
    pendentes: 0,
    email: 'mckeivin@email.com',
    telefone: '(11) 96666-6666'
  }
];

const MOCK_TEMPLATES = [
  {
    id: 'TPL-001',
    nome: 'Solicitação de Documentação',
    conteudo: `Prezado(a) {artista},

Solicitamos o envio dos seguintes documentos para dar continuidade ao processo:

1. Documento de identificação (RG/CPF ou CNPJ)
2. Comprovante de residência
3. Contrato assinado digitalmente
4. Dados bancários atualizados

Prazo para envio: {prazo}

Atenciosamente,
Equipe Copyright - Lujo Network`
  },
  {
    id: 'TPL-002',
    nome: 'Notificação de Claim',
    conteudo: `Olá {artista},

Identificamos {quantidade} claims de direitos autorais em suas músicas na plataforma {plataforma}. 

Por favor, revise em até {prazo} horas.

Detalhes:
- Plataforma: {plataforma}
- Quantidade: {quantidade} claims
- Prazo de resposta: {prazo} horas
- Status: Pendente de análise

Equipe Copyright - Lujo Network`
  },
  {
    id: 'TPL-003',
    nome: 'Aviso de Prazo',
    conteudo: `Prezado(a) {artista},

Lembramos que o prazo para {assunto} vence em {prazo}.

Por favor, dê atenção urgente a este assunto.

Atenciosamente,
Equipe Copyright - Lujo Network`
  },
  {
    id: 'TPL-004',
    nome: 'Confirmação de Recebimento',
    conteudo: `Olá {artista},

Confirmamos o recebimento de seus {documentos}.

Agora daremos andamento ao processo. Em breve entraremos em contato com novidades.

Agradecemos sua colaboração.

Equipe Copyright - Lujo Network`
  },
  {
    id: 'TPL-005',
    nome: 'Resposta Padrão FAQ',
    conteudo: `Olá {artista},

Obrigado pelo seu contato.

Em relação à sua dúvida sobre {assunto}, informamos que {resposta}.

Se precisar de mais informações, estamos à disposição.

Atenciosamente,
Equipe Copyright - Lujo Network`
  },
  {
    id: 'TPL-006',
    nome: 'Solicitação de Assinatura',
    conteudo: `Prezado(a) {artista},

Solicitamos sua assinatura no contrato {contrato}.

Clique no link abaixo para acessar o documento:
{link_contrato}

Prazo para assinatura: {prazo}

Atenciosamente,
Equipe Copyright - Lujo Network`
  }
];

/* ===============================
   TABS
================================ */
function initTabs() {
  const container = document.querySelector('.modulo-painel-copyright') || document.querySelector('.painel-copyright');
  if (!container) {
    console.warn('Copyright: container não encontrado');
    return;
  }

  const botoes = container.querySelectorAll('.aba-btn');
  if (botoes.length === 0) {
    console.warn('Copyright: nenhum botão de aba encontrado');
    return;
  }

  botoes.forEach(btn => {
    window.ModuleLifecycle.addListener(btn, 'click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const alvo = this.dataset.aba;
      if (!alvo) return;
      
      // Atualizar botões ativos
      botoes.forEach(b => b.classList.remove('ativa'));
      this.classList.add('ativa');
      
      // Mostrar conteúdo
      mostrarAbaConteudo(alvo);
    }, MODULE_ID);
  });
  
  // Ativar primeira aba
  if (botoes.length > 0) {
    const primeiraAba = botoes[0];
    const alvoInicial = primeiraAba.dataset.aba || 'aba-dashboard';
    primeiraAba.classList.add('ativa');
    mostrarAbaConteudo(alvoInicial);
  }
}

function mostrarAbaConteudo(abaId) {
  const container = document.querySelector('.modulo-painel-copyright') || document.querySelector('.painel-copyright');
  if (!container) return;
  
  // Esconder todos os conteúdos
  container.querySelectorAll('.aba-conteudo').forEach(c => {
    c.classList.remove('ativa');
  });
  
  // Mostrar o conteúdo da aba selecionada
  const conteudoAlvo = container.querySelector(`.${abaId}`);
  if (conteudoAlvo) {
    conteudoAlvo.classList.add('ativa');
    inicializarConteudoAba(abaId);
  }
}

function inicializarConteudoAba(abaId) {
  switch(abaId) {
    case 'aba-dashboard':
      initDashboardTab();
      break;
    case 'aba-demandas':
      initDemandasTab();
      break;
    case 'aba-artistas':
      initArtistasTab();
      break;
    case 'aba-comunicacao':
      initComunicacaoTab();
      break;
    case 'aba-relatorios':
      initRelatoriosTab();
      break;
  }
}

/* ===============================
   DASHBOARD
================================ */
function initDashboard() {
  // Dashboard será inicializado quando a aba for ativada
}

function initDashboardTab() {
  atualizarMetricasDashboard();
  
  // Botão Ver Todos
  const btnVerTodos = document.querySelector('.aba-dashboard .btn-secondary');
  if (btnVerTodos) {
    window.ModuleLifecycle.addListener(btnVerTodos, 'click', () => {
      const btnDemandas = document.querySelector('[data-aba="aba-demandas"]');
      if (btnDemandas) btnDemandas.click();
    }, MODULE_ID);
  }
}

function atualizarMetricasDashboard() {
  const state = window.StateManager.get(MODULE_ID);
  if (!state) return;

  const demandas = state.demandas;
  
  const metricas = {
    ticketsAbertos: demandas.filter(d => d.status !== 'resolvido').length,
    claimsPendentes: demandas.filter(d => d.tipo.includes('Claim') && d.status !== 'resolvido').length,
    emailsHoje: 24,
    slaCumprido: 94
  };
  
  setText('.aba-dashboard .metrica-card:nth-child(1) .metrica-valor', metricas.ticketsAbertos);
  setText('.aba-dashboard .metrica-card:nth-child(2) .metrica-valor', metricas.claimsPendentes);
  setText('.aba-dashboard .metrica-card:nth-child(3) .metrica-valor', metricas.emailsHoje);
  setText('.aba-dashboard .metrica-card:nth-child(4) .metrica-valor', metricas.slaCumprido);
}

/* ===============================
   DEMANDAS (SIMPLIFICADO)
================================ */
function initDemandasTab() {
  renderListaDemandas();
  initFiltrosDemandas();
}

function initFiltrosDemandas() {
  const selects = document.querySelectorAll('.aba-demandas select');
  selects.forEach(select => {
    window.ModuleLifecycle.addListener(select, 'change', filtrarDemandas, MODULE_ID);
  });
}

function renderListaDemandas() {
  const state = window.StateManager.get(MODULE_ID);
  if (!state) return;

  const container = document.getElementById('listaDemandas');
  if (!container) return;
  
  const demandas = state.demandas;
  
  if (demandas.length === 0) {
    container.innerHTML = '<p class="text-center" style="padding: 30px; color: #999;">Nenhuma demanda encontrada</p>';
    return;
  }
  
  container.innerHTML = demandas.map(demanda => `
    <div class="ticket-item status-${demanda.status}" data-ticket-id="${demanda.id}">
      <div class="ticket-info">
        <div class="ticket-cliente">${window.Utils.escapeHtml(demanda.cliente)} - ${window.Utils.escapeHtml(demanda.tipo)}</div>
        <div class="ticket-desc">${window.Utils.escapeHtml(demanda.descricao)}</div>
        <div class="ticket-meta">
          <span>ID: ${demanda.id}</span> • 
          <span>Plataforma: ${window.Utils.escapeHtml(demanda.plataforma)}</span> • 
          <span>Área: ${window.Utils.escapeHtml(demanda.area)}</span> • 
          <span>Criado: ${window.Utils.escapeHtml(demanda.criado)}</span>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 5px; align-items: flex-end;">
        <span class="status-badge status-${demanda.status}">
          ${demanda.status === 'urgente' ? '🚨 Urgente' : 
            demanda.status === 'pendente' ? '📋 Pendente' :
            demanda.status === 'andamento' ? '🔄 Em Andamento' : '✅ Resolvido'}
        </span>
      </div>
    </div>
  `).join('');
}

function filtrarDemandas() {
  // Implementar filtros conforme necessário
  renderListaDemandas();
}

/* ===============================
   ARTISTAS
================================ */
function initArtistasTab() {
  renderListaArtistas();
}

function renderListaArtistas() {
  const state = window.StateManager.get(MODULE_ID);
  if (!state) return;

  const container = document.getElementById('listaArtistas');
  if (!container) return;
  
  const artistas = state.artistas;
  
  container.innerHTML = artistas.map(artista => `
    <div class="artista-item" data-artista-id="${artista.id}">
      <div class="artista-avatar">${window.Utils.escapeHtml(artista.nome.charAt(0))}</div>
      <div class="artista-info">
        <div class="artista-nome">${window.Utils.escapeHtml(artista.nome)}</div>
        <div class="artista-detalhes">
          <span>Contrato: ${window.Utils.escapeHtml(artista.contrato)}</span> • 
          <span>Plataformas: ${artista.plataformas.length}</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ===============================
   COMUNICAÇÃO
================================ */
function initComunicacaoTab() {
  const selectArtista = document.querySelector('.aba-comunicacao .select-atendente');
  if (selectArtista) {
    const state = window.StateManager.get(MODULE_ID);
    if (state) {
      selectArtista.innerHTML = `
        <option value="">Selecionar Artista</option>
        ${state.artistas.map(a => `<option value="${a.id}">${window.Utils.escapeHtml(a.nome)}</option>`).join('')}
      `;
    }
  }
}

/* ===============================
   RELATÓRIOS
================================ */
function initRelatoriosTab() {
  // Implementar relatórios
}

/* ===============================
   UTILITÁRIOS
================================ */
function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

// Manter window.copyrightModule para compatibilidade
window.copyrightModule = {
  MODULE_ID
};

console.log("✅ Módulo Copyright refatorado carregado - Seguro contra duplicatas");