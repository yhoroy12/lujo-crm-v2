/**
 * =====================================================
 * PERMISSION-FILTER.JS - Sistema de Filtragem de Permissões
 * Integrado com novo sistema de rotas e SPA
 * =====================================================
 */

const PermissionFilter = {
  // 🔒 Flag para impedir re-inicialização
  _initialized: false,
  _moduleId: 'permission-filter',

  /**
   * Inicializa o sistema de filtragem
   * Deve ser chamado após AuthSystem, PermissionsSystem e ROUTES estarem prontos
   */
  async init() {
     // 🔒 PROTEÇÃO: Impedir re-execução
    if (this._initialized) {
      console.warn('⚠️ Permission Filter já foi inicializado. Ignorando duplicata.');
      return;
    }
    console.log('🔐 Inicializando Permission Filter');

    try {
      // 1. Aguardar sistemas estarem prontos
      await this.waitForSystems();
      console.log('✅ Sistemas prontos');

      // 2. Validar autenticação
      if (!window.AuthSystem?.isAuthenticated()) {
        console.warn('⚠️ Usuário não autenticado. Redirecionando...');
        window.location.href = 'templates/login.html';
        return;
      }

      const user = window.AuthSystem.getCurrentUser();
      console.log('👤 Usuário logado:', {
        name: user.name,
        role: user.role,
        email: user.email
      });

      // 3. Gerar sidebar com rotas permitidas
      this.generateSidebar(user);

      // 4. Adicionar badges visuais
      this.addUserBadges(user);

      // 5. Monitor de mudanças de sessão
      this.watchSessionChanges();

      // 6. Setup de logout
      this.setupLogout();

      // 🔒 Marcar como inicializado
      this._initialized = true;

      console.log('✅ Permission Filter inicializado com sucesso');

    } catch (error) {
      console.error('❌ Erro ao inicializar Permission Filter:', error);
    }
  },

  /**
   * Aguarda todos os sistemas estarem prontos
   */
  waitForSystems() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 segundos

      const checkSystems = setInterval(() => {
        attempts++;

        const hasAuth = window.AuthSystem && 
                       typeof window.AuthSystem.isAuthenticated === 'function';
        
        const hasPermissions = window.PermissionsSystem && 
                              window.PermissionsSystem.ROLES;
        
        const hasRoutes = window.ROUTES && 
                         window.RoutesUtil && 
                         typeof window.RoutesUtil.getAvailableRoutes === 'function';

        if (hasAuth && hasPermissions && hasRoutes) {
          clearInterval(checkSystems);
          console.log('✅ Todos os sistemas carregados');
          resolve();
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(checkSystems);
          console.warn('⚠️ Timeout ao aguardar sistemas (5s)');
          resolve(); // Resolver mesmo com erro para não travcar
          return;
        }
      }, 100);
    });
  },

  /**
   * Gera sidebar dinamicamente baseado em rotas disponíveis
   */
  generateSidebar(user) {
    console.log('📍 Gerando sidebar para:', user.role);

    const navContainer = this.findNavContainer();
    if (!navContainer) {
      console.warn('⚠️ Container de navegação não encontrado');
      return;
    }

    // Obter rotas disponíveis
    const availableRoutes = window.RoutesUtil.getAvailableRoutes(user);

    if (availableRoutes.length === 0) {
      console.warn('⚠️ Nenhuma rota disponível para este usuário');
      navContainer.innerHTML = '<p style="padding: 20px; color: #999;">Nenhum módulo disponível</p>';
      return;
    }

    // Gerar HTML do sidebar
    const sidebarHTML = this.buildSidebarHTML(availableRoutes);
    navContainer.innerHTML = sidebarHTML;

    // Registrar listeners de clique
    this.bindSidebarEvents();

    console.log(`✅ Sidebar gerada com ${availableRoutes.length} módulos`);
  },

  /**
   * Encontra o container de navegação no DOM
   */
  findNavContainer() {
    // Procurar por seletores comuns
    const selectors = [
      '[data-role="nav-container"]',
      'nav',
      '.sidebar',
      '.sidebar-nav',
      '#sidebar',
      '.navigation'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`✅ Nav container encontrado: ${selector}`);
        return element;
      }
    }

    // Se não encontrar, criar um
    console.warn('⚠️ Nav container não encontrado. Criando um novo...');
    const nav = document.createElement('nav');
    nav.className = 'sidebar-nav';
    document.body.insertAdjacentElement('afterbegin', nav);
    return nav;
  },

  /**
   * Constrói HTML do sidebar
   */
  buildSidebarHTML(routes) {
    return routes
      .map(route => `
        <a href="#" 
           class="sidebar-link" 
           data-module="${route.id}" 
           data-permission="${route.permission}"
            title="${route.name}"
           aria-label="${route.name}">
          <i class="fi ${route.icon}"></i>
          <span class="link-label">${route.name}</span>
          <span class="link-description" style="font-size: 11px; opacity: 0.7;">
            ${route.description || ''}
          </span>
        </a>
      `)
      .join('');
  },

  /**
   * Registra listeners nos links do sidebar
   */
  bindSidebarEvents() {
  // 🧹 IMPORTANTE: Limpar listeners antigos ANTES de adicionar novos
    if (window.ModuleLifecycle) {
      window.ModuleLifecycle.cleanup(this._moduleId);
    }
    const links = document.querySelectorAll('[data-module]');
    
    links.forEach(link => {
      // ✅ Handler separado para poder ser rastreado
      const clickHandler = (e) => {
        e.preventDefault();
        
        const moduleId = link.dataset.module;
        console.log(`🔗 Clicou em módulo: ${moduleId}`);

        // Verificar permissão
        if (!window.AuthSystem.hasPermission(link.dataset.permission)) {
          this.showAccessDenied(moduleId);
          return;
        }
         if (window.SPA && typeof window.SPA.loadModule === 'function') {
          window.SPA.loadModule(moduleId);
        } else {
          console.error('❌ SPA não está disponível');
        }
      };
          // ✅ CORRIGIDO: Usar ModuleLifecycle para rastrear listeners
      if (window.ModuleLifecycle) {
        window.ModuleLifecycle.addListener(
          link,
          'click',
          clickHandler,
          this._moduleId
        );
      } else {
        // Fallback se ModuleLifecycle não estiver disponível
        link.addEventListener('click', clickHandler);
      }
      link.addEventListener('mouseenter', () => {
        link.style.transform = 'translateX(4px)';
      });

      link.addEventListener('mouseleave', () => {
        link.style.transform = 'translateX(0)';
      });
    });

    console.log(`✅ ${links.length} listeners de sidebar registrados via ModuleLifecycle`);
  },
  /* 
    document.querySelectorAll('[data-module]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        const moduleId = link.dataset.module;
        console.log(`🔗 Clicou em módulo: ${moduleId}`);

    */

  /**
   * Adiciona badges visuais baseado no role do usuário
   */
  addUserBadges(user) {
    const headerContainer = this.findHeaderContainer();
    if (!headerContainer) return;

    // Badge do role
    const roleBadge = document.createElement('div');
    roleBadge.className = 'user-role-badge';
    roleBadge.innerHTML = `
      <span class="role-name">${user.role}</span>
      <span class="role-level" title="Nível de acesso">${this.getRoleLevelDisplay(user.role)}</span>
    `;
    roleBadge.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    `;

    headerContainer.appendChild(roleBadge);

    // Badge ADMIN (se aplicável)
    if (user.role === 'ADMIN') {
      const adminBadge = document.createElement('div');
      adminBadge.className = 'admin-badge';
      adminBadge.innerHTML = '🔐 ADMIN';
      adminBadge.style.cssText = `
        padding: 4px 12px;
        background: #e74c3c;
        color: white;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        margin-left: 8px;
        box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
      `;
      headerContainer.appendChild(adminBadge);
    }

    console.log('✅ Badges adicionados');
  },

  /**
   * Encontra container do header
   */
  findHeaderContainer() {
    const selectors = [
      '[data-role="user-info"]',
      '.header-user',
      '.user-menu',
      'header .right'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return null;
  },

  /**
   * Obtém displayname do level do role
   */
  getRoleLevelDisplay(role) {
    const levels = {
      'ADMIN': '999',
      'CEO': '100',
      'GERENTE_MASTER': '80',
      'GERENTE': '60',
      'SUPERVISOR': '40',
      'OPERADOR': '20',
      'ESTAGIARIO': '0'
    };
    return levels[role] || '?';
  },

  /**
   * Monitora mudanças na sessão
   */
  watchSessionChanges() {
    let lastUserJson = sessionStorage.getItem('currentUser');

    setInterval(() => {
      const currentUserJson = sessionStorage.getItem('currentUser');

      if (currentUserJson !== lastUserJson) {
        console.log('🔄 Mudança detectada na sessão');
        lastUserJson = currentUserJson;

        if (currentUserJson) {
          // Sessão atualizada, recarregar permissões
          const user = JSON.parse(currentUserJson);
          console.log('👤 Atualizando permissões para:', user.name);
          this.generateSidebar(user);
        } else {
          // Sessão deletada, fazer logout
          console.log('🚪 Sessão finalizada. Redirecionando...');
          window.location.href = 'login.html';
        }
      }
    }, 2000);

    console.log('⏱️ Monitor de sessão iniciado (2s)');
  },

  /**
   * Setup de botão logout (se existir)
   */
  setupLogout() {
    const logoutButtons = document.querySelectorAll('[data-action="logout"]');

    if (logoutButtons.length === 0) {
      console.log('ℹ️ Nenhum botão de logout encontrado');
      return;
    }
    logoutButtons.forEach(btn => {
      const logoutHandler = (e) => {
        e.preventDefault();

        if (confirm('Deseja realmente fazer logout?')) {
          console.log('🚪 Executando logout...');
          window.AuthSystem.logout();
        }
      };

      // ✅ Usar ModuleLifecycle
      if (window.ModuleLifecycle) {
        window.ModuleLifecycle.addListener(
          btn,
          'click',
          logoutHandler,
          this._moduleId
        );
      } else {
        btn.addEventListener('click', logoutHandler);
      }
    });

    console.log(`✅ ${logoutButtons.length} botão(es) de logout configurado(s)`);
  },

    /*
    logoutButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();

        if (confirm('Deseja realmente fazer logout?')) {
          console.log('🚪 Executando logout...');
          window.AuthSystem.logout();
        }
      });
    });

    console.log(`✅ ${logoutButtons.length} botão(es) de logout configurado(s)`);
  },*/

  /**
   * Mostra mensagem de acesso negado
   */
  showAccessDenied(moduleId) {
    console.warn(`⛔ Acesso negado ao módulo: ${moduleId}`);

    if (typeof window.showToast === 'function') {
      window.showToast(
        'Você não tem permissão para acessar este módulo.',
        'warning'
      );
    } else {
      alert('⛔ Acesso negado. Você não tem permissão para este módulo.');
    }
  },

  //adicionado remover se não funcionar
  //✅ NOVO: Método para resetar (útil em hot reload)
   
  reset() {
    console.log('🔄 Resetando Permission Filter...');
    
    // Limpar listeners
    if (window.ModuleLifecycle) {
      window.ModuleLifecycle.cleanup(this._moduleId);
    }
    
    // Resetar flag
    this._initialized = false;
    
    console.log('✅ Permission Filter resetado');
  },


  /**
   * Debug: Imprime informações de permissões
   */
  debug() {
    console.group('🔐 PERMISSION FILTER DEBUG');

    const user = window.AuthSystem.getCurrentUser();
    console.log('👤 Usuário:', user);

    const routes = window.RoutesUtil.getAvailableRoutes(user);
    console.log(`📍 Rotas disponíveis (${routes.length}):`, routes.map(r => r.id));

    const allRoutes = Object.values(window.ROUTES);
    const hiddenRoutes = allRoutes.filter(r => !routes.find(ar => ar.id === r.id));
    console.log(`🔒 Rotas ocultas (${hiddenRoutes.length}):`, hiddenRoutes.map(r => r.id));
    //adicionado remover se não funcionar
    console.log('🔧 Estado interno:', {
      initialized: this._initialized,
      moduleId: this._moduleId
    });

    console.groupEnd();
  }
};

/**
 * =====================================================
 * INICIALIZAÇÃO AUTOMÁTICA
 * =====================================================
 */

// Inicializar quando DOM está pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    PermissionFilter.init();
  });
} else {
  PermissionFilter.init();
}

// Expor globalmente
window.PermissionFilter = PermissionFilter;

console.log('✅ permission-filter.js carregado');
console.log('💡 Execute: window.PermissionFilter.debug() para ver permissões');