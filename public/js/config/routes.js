/**
 * =====================================================
 * ROUTES.JS - Mapa de Rotas e Módulos da SPA
 *
 * Convenção de CSS:
 *   cssPath  → string  — módulos com um único arquivo CSS (legado / simples)
 *   cssPaths → array   — módulos com CSS modular (múltiplos arquivos)
 *
 * O main.js suporta ambos os formatos automaticamente.
 * =====================================================
 */

window.ROUTES = {

  // ─────────────────────────────────────────────────
  // MÓDULO: ATENDIMENTO
  // CSS modular — cada aba/sub-aba tem seu próprio arquivo
  // ─────────────────────────────────────────────────
  atendimento: {
    id: 'atendimento',
    name: 'Atendimento',
    icon: 'fi fi-rr-phone-call',
    color: '#3498db',
    permission: 'atendimento.view',
    modulePath: './js/modules/atendimento/atendimento.module.js',
    templatePaths: './templates/modules/atendimento/atendimento.html',

    // ✅ CSS MODULAR — carregados em cascata pelo main.js
    cssPaths: [
      // Nível 1 — Módulo (variáveis, reset, abas, estados vazios)
      './css/atendimento/modulo-atendimento.css',

      // Nível 2 — Abas principais
      './css/atendimento/tabs/chat/aba-atendimento.css',
      './css/atendimento/tabs/emails/aba-emails.css',
      './css/atendimento/tabs/demandas/aba-demandas.css',
      './css/atendimento/tabs/historico/aba-historico.css',

      // Nível 3 — Sub-abas de Histórico
      

      // Utilitários compartilhados
      './css/utils/modais.css',
      './css/utils/utilitarios.css',
    ],

    roles: ['CEO', 'GERENTE_MASTER', 'GERENTE', 'SUPERVISOR', 'OPERADOR'],
    order: 1
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: CONTEÚDO
  // ─────────────────────────────────────────────────
  conteudo: {
    id: 'conteudo',
    name: 'Conteúdo',
    icon: 'fi fi-rr-music-alt',
    color: '#9b59b6',
    permission: 'conteudo.view',
    modulePath: './js/modules/placeholder.module.js',
    cssPath: './css/conteudo/conteudo.css',
    roles: ['CEO', 'GERENTE_MASTER', 'GERENTE'],
    order: 2
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: COPYRIGHT
  // ─────────────────────────────────────────────────
  copyright: {
    id: 'copyright',
    name: 'Copyright',
    icon: 'fi fi-rr-shield-check',
    color: '#e74c3c',
    permission: 'copyright.view',
    modulePath: './js/modules/placeholder.module.js',
    cssPath: './css/copyright/copyright.css',
    roles: ['CEO', 'GERENTE_MASTER', 'GERENTE', 'SUPERVISOR'],
    order: 3
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: FINANCEIRO
  // ─────────────────────────────────────────────────
  financeiro: {
    id: 'financeiro',
    name: 'Financeiro',
    icon: 'fi fi-rr-dollar',
    color: '#2ecc71',
    permission: 'financeiro.view',
    modulePath: './js/modules/placeholder.module.js',
    cssPath: './css/financeiro/financeiro.css',
    roles: ['CEO', 'GERENTE_MASTER', 'GERENTE'],
    order: 4
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: TÉCNICO
  // ─────────────────────────────────────────────────
  tecnico: {
    id: 'tecnico',
    name: 'Suporte Técnico',
    icon: 'fi fi-rr-users',
    color: '#f39c12',
    permission: 'tecnico.view',
    modulePath: './js/modules/placeholder.module.js',
    cssPath: './css/tecnico/tecnico.css',
    roles: ['CEO', 'GERENTE_MASTER', 'GERENTE', 'SUPERVISOR', 'OPERADOR'],
    order: 5
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: MARKETING
  // ─────────────────────────────────────────────────
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    icon: 'fi fi-rr-star',
    color: '#1abc9c',
    permission: 'marketing.view',
    modulePath: './js/modules/placeholder.module.js',
    cssPath: './css/marketing/marketing.css',
    roles: ['CEO', 'GERENTE_MASTER'],
    order: 6
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: GESTÃO / GERÊNCIA
  // CSS modular — já existem múltiplos arquivos em /gerencia
  // ─────────────────────────────────────────────────
  gestor: {
    id: 'gestor',
    name: 'Gestão',
    icon: 'fi fi-rr-user',
    color: '#34495e',
    permission: 'gestor.view',
    modulePath: './js/modules/placeholder.module.js',

    // ✅ Já existem múltiplos arquivos em /gerencia — use cssPaths
    cssPaths: [
      './css/gerencia/gerencia.css',
      './css/gerencia/gerencia-indicadores.css',
      './css/gerencia/gerencia-operadores.css',
      './css/gerencia/gerencia-controle.css',
    ],

    roles: ['CEO', 'GERENTE_MASTER', 'GERENTE'],
    order: 7
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: RELATÓRIOS
  // ─────────────────────────────────────────────────
  relatorios: {
    id: 'relatorios',
    name: 'Relatórios',
    icon: 'fi fi-rr-chart-histogram',
    color: '#16a085',
    permission: 'relatorios.view',
    modulePath: './js/modules/placeholder.module.js',
    cssPath: './css/relatorios/relatorios.css',
    roles: ['CEO', 'GERENTE_MASTER', 'GERENTE', 'SUPERVISOR'],
    order: 8
  },

  // ─────────────────────────────────────────────────
  // MÓDULO: USUÁRIOS E PERMISSÕES (ADMIN)
  // ─────────────────────────────────────────────────
  'usuarios-permissoes': {
    id: 'usuarios-permissoes',
    name: 'Administração',
    icon: 'fi fi-rr-settings',
    color: '#c0392b',
    permission: 'admin.view',
    modulePath: './js/modules/placeholder.module.js',
    cssPath: './css/adiminstrativo/admin.css',
    roles: ['CEO', 'GERENTE_MASTER', 'ADMIN'],
    order: 99
  }
};


/**
 * =====================================================
 * UTILIDADES DE ROTAS
 * =====================================================
 */

window.RoutesUtil = {

  /**
   * Retorna todas as rotas disponíveis para um usuário,
   * filtradas por role e permissão, ordenadas por `order`.
   */
  getAvailableRoutes(user) {
    if (!user) return [];

    return Object.values(window.ROUTES).filter(route => {
      if (user.role === 'ADMIN') return true;

      const hasRole = route.roles && route.roles.includes(user.role);
      const hasPerm = window.PermissionsSystem.hasPermission(route.permission);

      return hasRole || hasPerm;
    }).sort((a, b) => a.order - b.order);
  },

  /** Retorna uma rota pelo ID */
  getRoute(routeId) {
    return window.ROUTES[routeId] || null;
  },

  /** Valida se um usuário pode acessar uma rota */
  canAccess(routeId, user) {
    const route = this.getRoute(routeId);
    if (!route) return false;

    const hasPermission = window.AuthSystem.hasPermission(route.permission);
    const hasRole = route.roles.includes(user.role);

    return hasPermission && hasRole;
  },

  /** Retorna a próxima rota disponível para o usuário */
  getNextRoute(currentRouteId, user) {
    const availableRoutes = this.getAvailableRoutes(user);
    const currentIndex = availableRoutes.findIndex(r => r.id === currentRouteId);

    if (currentIndex === -1 || currentIndex === availableRoutes.length - 1) {
      return availableRoutes[0] || null;
    }
    return availableRoutes[currentIndex + 1];
  },

  /** Retorna a rota anterior disponível para o usuário */
  getPreviousRoute(currentRouteId, user) {
    const availableRoutes = this.getAvailableRoutes(user);
    const currentIndex = availableRoutes.findIndex(r => r.id === currentRouteId);

    if (currentIndex <= 0) {
      return availableRoutes[availableRoutes.length - 1] || null;
    }
    return availableRoutes[currentIndex - 1];
  },

  /** Gera HTML para sidebar baseado nas rotas disponíveis para o usuário */
  generateSidebarHTML(user) {
    const routes = this.getAvailableRoutes(user);

    return routes.map(route => `
      <a href="#" class="sidebar-link" data-module="${route.id}"
         title="${route.name}">
        <i class="fi ${route.icon}"></i>
        <span class="link-label">${route.name}</span>
      </a>
    `).join('');
  },

  /**
   * Retorna todos os caminhos CSS de uma rota.
   * Útil para pré-carregamento ou inspeção.
   *
   * @param {string} routeId
   * @returns {string[]}
   */
  getCSSPaths(routeId) {
    const route = this.getRoute(routeId);
    if (!route) return [];

    const paths = [];
    if (Array.isArray(route.cssPaths)) paths.push(...route.cssPaths);
    if (typeof route.cssPath === 'string' && route.cssPath) paths.push(route.cssPath);
    return paths;
  },

  /** Debug: imprime tabela de todas as rotas no console */
  debug() {
    console.group('🗺️ ROUTES DEBUG');
    console.table(
      Object.values(window.ROUTES).map(r => ({
        ID: r.id,
        Nome: r.name,
        Permissão: r.permission,
        Roles: r.roles.join(', '),
        CSS: Array.isArray(r.cssPaths)
          ? `${r.cssPaths.length} arquivos (cssPaths)`
          : r.cssPath || '—',
        Ordem: r.order
      }))
    );
    console.groupEnd();
  }
};


/**
 * =====================================================
 * INICIALIZAÇÃO
 * =====================================================
 */

console.log('✅ routes.js carregado');
console.log(`🗺️ ${Object.keys(window.ROUTES).length} rotas disponíveis`);

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('💡 Execute: window.RoutesUtil.debug() para ver todas as rotas');
}