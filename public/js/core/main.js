/**
 * =====================================================
 * MAIN.JS - Orquestrador Principal da SPA
 * Gerencia navegação, módulos e otimizações Blaze
 *
 * ✅ v3 — Suporte a cssPaths (array) e cssPath (string)
 *         Rastreamento correto de múltiplos links CSS por módulo
 *         Compatível com estrutura modular de templates
 * =====================================================
 */

const SPA = {
  currentModule: null,
  currentModuleId: null,
  isLoading: false,
  loadedModules: new Map(),

  // cssCache agora mapeia: href → Set de moduleIds que o utilizam
  // Isso permite que CSS compartilhados (global, utils) não sejam removidos
  cssCache: new Map(),

  // Rastreia quais link[id]s pertencem a cada módulo
  // Formato: Map<moduleId, Set<linkId>>
  moduleCSSLinks: new Map(),


  // ─────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // ─────────────────────────────────────────────────

  async init() {
    console.log('🚀 Inicializando SPA');

    try {
      await this.waitForAuth();
      console.log('✅ Autenticação pronta');

      this.showNewsModal();
      console.log('✅ Modal de notícias exibido');

      this.setupHotkeys();
      console.log('✅ Hotkeys configurados');

      this.setupGlobalSearch();
      console.log('✅ Busca global configurada');

      await this.waitForPermissions();
      console.log('✅ Permissões carregadas');

      await this.NotificationManagerinit();
      console.log('✅ NotificationManager configurado');

      this.filterDashboardCards();
      console.log('✅ Cards do dashboard filtrados por permissão');

      this.setupNewsButton();
      console.log('✅ Botão de notícias configurado');

      console.log('🎉 SPA pronto para uso');

    } catch (error) {
      console.error('❌ Erro ao inicializar SPA:', error);
      this.showError('Erro ao inicializar sistema. Recarregue a página.');
    }
  },


  // ─────────────────────────────────────────────────
  // AUTH / PERMISSÕES
  // ─────────────────────────────────────────────────

  async waitForAuth() {
    console.log('⏳ Aguardando validação do perfil...');
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const user = window.PermissionsSystem.getCurrentUser();
        if (user && user.role) {
          clearInterval(interval);
          resolve(user);
        }
      }, 200);
    });
  },

  waitForPermissions() {
    return new Promise((resolve) => {
      const checkPerms = setInterval(() => {
        if (window.PermissionsSystem && window.ROUTES && window.RoutesUtil) {
          clearInterval(checkPerms);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkPerms);
        resolve();
      }, 5000);
    });
  },


  // ─────────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────────

  filterDashboardCards() {
    const user = window.PermissionsSystem.getCurrentUser();
    if (!user) return;

    const cards = document.querySelectorAll('.dash-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const moduleId = card.getAttribute('data-module');
      const hasAccess = (user.role === 'ADMIN') || window.PermissionsSystem.hasModuleAccess(moduleId);

      if (hasAccess) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    console.log(`📊 Dashboard: ${visibleCount} cards visíveis de ${cards.length}`);
  },

  // ============================================================
  //INICIALIZAÇÃO SEGURA DAS NOTIFICAÇÕES
  // ============================================================
 async NotificationManagerinit() {
    console.log('⏳ A aguardar prontidão para notificações (Via FirebaseApp)...');

    // 1. Aguarda o utilizador no sessionStorage
    const waitForUser = async () => {
      let attempts = 0;
      while (attempts < 30) {
        const u = window.AuthSystem.getCurrentUser();
        if (u && u.uid && u.setor) return u;
        await new Promise(r => setTimeout(r, 200));
        attempts++;
      }
      return null;
    };

    const user = await waitForUser();

    // 2. Aguarda o window.FirebaseApp.db (Ajustado para sua estrutura!)
    const waitForDB = async () => {
      let attempts = 0;
      while (!window.FirebaseApp?.db && attempts < 50) { 
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      return !!window.FirebaseApp?.db;
    };

    const dbReady = await waitForDB();

    // 3. Inicialização
    if (user && window.NotificationManager && dbReady) {
      window.NotificationManager.listenToNotifications({
        uid: user.uid,
        role: user.setor
      });
      console.log('🔔 Notificações ativadas com sucesso.');
    } else {
      console.error('❌ Falha crítica no NotificationManagerinit:', { 
        hasUser: !!user, 
        hasManager: !!window.NotificationManager, 
        hasFirebaseAppDB: dbReady 
      });
    }
  },
  // ─────────────────────────────────────────────────
  // CARREGAMENTO DE MÓDULOS
  // ─────────────────────────────────────────────────

  async loadModule(moduleId) {
    if (this.isLoading) {
      console.warn(`⏳ Carregamento em curso, ignorando: ${moduleId}`);
      return;
    }

    if (this.currentModuleId === moduleId) {
      console.log(`ℹ️ Módulo ${moduleId} já está ativo.`);
      return;
    }

    this.isLoading = true;
    console.log(`📦 Carregando módulo: ${moduleId}`);

    // Cleanup do módulo anterior
    if (this.currentModule && typeof this.currentModule.cleanup === 'function') {
      console.log(`🧹 Executando cleanup do módulo: ${this.currentModuleId}`);
      this.currentModule.cleanup();
    }

    const route = window.RoutesUtil.getRoute(moduleId);
    if (!route) {
      console.error(`❌ Módulo não encontrado: ${moduleId}`);
      this.isLoading = false;
      return;
    }

    const user = window.PermissionsSystem.getCurrentUser();
    if (user.role !== 'ADMIN') {
      if (!window.PermissionsSystem.hasModuleAccess(moduleId)) {
        console.error(`❌ Sem permissão para acessar: ${moduleId}`);
        window.showToast?.('Acesso negado', 'error');
        this.isLoading = false;
        return;
      }
    }

    try {
      // Esconder dashboard
      const dashboard = document.getElementById('dashboard-inicial');
      if (dashboard) {
        dashboard.classList.remove('modulo-ativo');
        dashboard.classList.add('modulo-oculto');
      }

      // Mostrar loading no container
      const container = document.getElementById('modulos-container');
      if (container) {
        container.classList.remove('modulo-oculto');
        container.classList.add('modulo-ativo');
        container.innerHTML = '<div style="text-align:center;padding:40px;"><p>⏳ Carregando...</p></div>';
      }

      // ✅ Carrega todos os CSS do módulo (suporta cssPath e cssPaths)
      await this.loadModuleCSS(route);

      // Importar o módulo JS
      let moduleExport;
      if (this.loadedModules.has(moduleId)) {
        console.log(`♻️ Reutilizando módulo em cache: ${moduleId}`);
        moduleExport = this.loadedModules.get(moduleId);
      } else {
        console.log(`📥 Importando módulo: ${route.modulePath}`);
        moduleExport = await import(`../../${route.modulePath}`);
        this.loadedModules.set(moduleId, moduleExport);
      }

      // Inicializar módulo
      this.currentModule = moduleExport.default;
      this.currentModuleId = moduleId;

      if (typeof this.currentModule.init !== 'function') {
        throw new Error(`Módulo ${moduleId} não possui método init()`);
      }

      await this.currentModule.init();

      // Atualizar UI
      this.updateSidebarActive(moduleId);
      this.updateBreadcrumb(route.name);

      console.log(`✅ Módulo carregado com sucesso: ${moduleId}`);

    } catch (error) {
      console.error(`❌ Erro ao carregar módulo ${moduleId}:`, error);

      const container = document.getElementById('modulos-container');
      if (container) {
        container.innerHTML = `
          <div style="color:red;padding:40px;text-align:center;">
            <h3>❌ Erro ao carregar módulo</h3>
            <p>${error.message}</p>
            <button class="btn btn-primary" onclick="location.reload()">
              Recarregar Página
            </button>
          </div>
        `;
      }
    } finally {
      this.isLoading = false;
    }
  },


  // ─────────────────────────────────────────────────
  // GERENCIAMENTO DE CSS
  // ─────────────────────────────────────────────────

  /**
   * Resolve a lista de caminhos CSS de uma rota.
   * Aceita tanto `cssPath` (string) quanto `cssPaths` (array).
   * Nunca retorna duplicatas.
   *
   * @param {Object} route - Objeto de rota do routes.js
   * @returns {string[]} - Array de hrefs únicos
   */
  _resolveCSSPaths(route) {
    const paths = new Set();

    // Suporte a array (novo padrão modular)
    if (Array.isArray(route.cssPaths)) {
      route.cssPaths.forEach(p => paths.add(p));
    }

    // Suporte a string (padrão legado dos demais módulos)
    if (typeof route.cssPath === 'string' && route.cssPath) {
      paths.add(route.cssPath);
    }

    return Array.from(paths);
  },

  /**
   * Carrega todos os CSS de um módulo.
   * - Arquivos já carregados no DOM são reutilizados (sem flash de estilo)
   * - Remove os links exclusivos do módulo anterior
   * - Aguarda que todos os arquivos novos sejam aplicados antes de continuar
   *
   * @param {Object} route - Objeto de rota
   */
  async loadModuleCSS(route) {
    const paths = this._resolveCSSPaths(route);

    if (paths.length === 0) {
      console.warn(`⚠️ Nenhum CSS definido para: ${route.id}`);
      return;
    }

    // Remove CSS exclusivos do módulo anterior (não remove CSS compartilhados)
    this._removeExclusiveCSS(route.id);

    // Cria um Set para rastrear os links deste módulo
    if (!this.moduleCSSLinks.has(route.id)) {
      this.moduleCSSLinks.set(route.id, new Set());
    }
    const moduleLinks = this.moduleCSSLinks.get(route.id);

    // Carrega em paralelo todos os arquivos CSS do módulo
    const loadPromises = paths.map(href => this._loadSingleCSS(href, route.id, moduleLinks));
    await Promise.all(loadPromises);

    console.log(`🎨 [${route.id}] ${paths.length} arquivo(s) CSS prontos.`);
  },

  /**
   * Carrega um único arquivo CSS, criando o <link> se necessário.
   * Se já existir um <link> com o mesmo href, apenas registra o moduleId nele.
   *
   * @param {string} href - Caminho do arquivo CSS
   * @param {string} moduleId - ID do módulo que está carregando
   * @param {Set} moduleLinks - Set de linkIds do módulo
   */
  _loadSingleCSS(href, moduleId, moduleLinks) {
    // Gera ID estável a partir do href (remove caracteres inválidos)
    const linkId = 'css-' + href.replace(/[^a-zA-Z0-9]/g, '-');

    // Registra no rastreamento do módulo
    moduleLinks.add(linkId);

    // Registra no cssCache global: href → Set de moduleIds
    if (!this.cssCache.has(href)) {
      this.cssCache.set(href, new Set());
    }
    this.cssCache.get(href).add(moduleId);

    // Se o link já existe no DOM, não precisa criar novamente
    const existing = document.getElementById(linkId);
    if (existing) {
      console.log(`♻️ CSS reutilizado: ${href}`);
      return Promise.resolve();
    }

    // Cria e injeta o <link>
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-module', moduleId); // facilita debug no DevTools

      link.onload = () => {
        console.log(`📄 CSS carregado: ${href}`);
        resolve();
      };

      link.onerror = () => {
        console.error(`❌ Falha ao carregar CSS: ${href}`);
        // Resolve mesmo assim para não travar o carregamento do módulo
        resolve();
      };

      document.head.appendChild(link);
    });
  },

  /**
   * Remove do DOM apenas os links CSS que são exclusivos do módulo anterior
   * (não estão sendo usados pelo módulo que está chegando).
   *
   * CSS compartilhados (ex: global.css, utilitarios.css que aparecem em
   * múltiplos módulos) são PRESERVADOS para evitar flashes de estilo.
   *
   * @param {string} incomingModuleId - ID do módulo que está sendo carregado
   */
  _removeExclusiveCSS(incomingModuleId) {
    const previousModuleId = this.currentModuleId;
    if (!previousModuleId || previousModuleId === incomingModuleId) return;

    // CSS que o módulo entrante vai usar
    const incomingRoute = window.RoutesUtil.getRoute(incomingModuleId);
    const incomingPaths = incomingRoute ? new Set(this._resolveCSSPaths(incomingRoute)) : new Set();

    const previousLinks = this.moduleCSSLinks.get(previousModuleId);
    if (!previousLinks) return;

    previousLinks.forEach(linkId => {
      const linkEl = document.getElementById(linkId);
      if (!linkEl) return;

      const href = linkEl.href;

      // Mantém se o módulo entrante também usa este CSS
      if (incomingPaths.has(linkEl.getAttribute('href') || href)) {
        console.log(`🔗 CSS compartilhado mantido: ${href}`);
        return;
      }

      // Remove o módulo anterior do rastreamento do cssCache
      this.cssCache.get(href)?.delete(previousModuleId);

      // Remove o link do DOM
      linkEl.remove();
      console.log(`🧹 CSS removido (${previousModuleId}): ${href}`);
    });

    // Limpa o registro do módulo anterior
    this.moduleCSSLinks.delete(previousModuleId);
  },

  /**
   * ─── LEGADO ─────────────────────────────────────
   * Mantido para compatibilidade com código antigo que chame este método.
   * Internamente delega para _removeExclusiveCSS.
   * @deprecated Use _removeExclusiveCSS internamente
   */
  removeOtherModuleCSS(currentModuleId) {
    this._removeExclusiveCSS(currentModuleId);
  },


  // ─────────────────────────────────────────────────
  // UI: SIDEBAR / BREADCRUMB
  // ─────────────────────────────────────────────────

  updateSidebarActive(moduleId) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const isHome = link.id === 'btnGoHome';
      if (moduleId) {
        link.classList.toggle('active', link.getAttribute('data-module') === moduleId);
      } else {
        link.classList.toggle('active', isHome);
      }
    });
  },

  updateBreadcrumb(moduleName) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = `
        <span>Lujo Network</span>
        <span>${moduleName}</span>
      `;
    }
  },


  // ─────────────────────────────────────────────────
  // MODAL DE NOTÍCIAS
  // ─────────────────────────────────────────────────

  showNewsModal() {
    const user = window.AuthSystem.getCurrentUser();
    if (!user) return;

    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('newsModalLastShown');

    if (lastShown === today) {
      console.log('ℹ️ Modal de notícias já foi mostrado hoje');
      return;
    }

    const modalHTML = `
      <div class="modal active" id="modalNews" role="dialog" aria-labelledby="newsTitle">
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <div>
              <h2 id="newsTitle">📰 Notícias da Empresa</h2>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
                Bem-vindo(a), <strong>${user.name}</strong>!
              </p>
            </div>
            <button class="btn-close" id="btnCloseNews" aria-label="Fechar">&times;</button>
          </div>
          <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
            <article class="news-item" style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--color-border);">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
                <h3 style="margin:0;font-size:18px;color:var(--color-text);">🎯 Nova Política de Atendimento</h3>
                <span style="font-size:12px;color:#999;">25/01/2025</span>
              </div>
              <p style="line-height:1.6;color:#666;">A partir do próximo mês, haverá atualizações nos horários e procedimentos para melhor atender nossos clientes. O atendimento será estendido até às 20h nos dias úteis.</p>
              <div style="margin-top:10px;">
                <span class="status-badge" style="background:#e3f2fd;color:#1976d2;font-size:11px;">Comunicado Oficial</span>
              </div>
            </article>
            <article class="news-item" style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--color-border);">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
                <h3 style="margin:0;font-size:18px;color:var(--color-text);">🚀 Campanha de Marketing 2025</h3>
                <span style="font-size:12px;color:#999;">20/01/2025</span>
              </div>
              <p style="line-height:1.6;color:#666;">O novo ciclo de campanhas foca no público jovem e em estratégias digitais modernas. Todos os setores devem alinhar seus processos com as novas diretrizes.</p>
              <div style="margin-top:10px;">
                <span class="status-badge" style="background:#fff3cd;color:#856404;font-size:11px;">Marketing</span>
              </div>
            </article>
            <article class="news-item" style="margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
                <h3 style="margin:0;font-size:18px;color:var(--color-text);">💡 Atualização do Sistema CRM</h3>
                <span style="font-size:12px;color:#999;">15/01/2025</span>
              </div>
              <p style="line-height:1.6;color:#666;">Nova interface implementada com melhorias de performance e experiência do usuário. Explore os novos recursos disponíveis em cada módulo.</p>
              <div style="margin-top:10px;">
                <span class="status-badge" style="background:#e6f6ea;color:#1a7b3f;font-size:11px;">Tecnologia</span>
              </div>
            </article>
          </div>
          <div class="modal-footer">
            <label style="display:flex;align-items:center;gap:8px;margin-right:auto;">
              <input type="checkbox" id="dontShowAgainToday" style="width:16px;height:16px;">
              <span style="font-size:13px;color:#666;">Não mostrar novamente hoje</span>
            </label>
            <button class="btn btn-primary" id="btnCloseNews2">Entendi</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('modalNews');
    const btnClose = document.getElementById('btnCloseNews');
    const btnClose2 = document.getElementById('btnCloseNews2');
    const checkbox = document.getElementById('dontShowAgainToday');

    const closeModal = () => {
      if (checkbox?.checked) {
        localStorage.setItem('newsModalLastShown', today);
      }
      modal?.remove();
    };

    btnClose?.addEventListener('click', closeModal);
    btnClose2?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal) closeModal();
    }, { once: true });

    console.log('📰 Modal de notícias exibido');
  },

  setupNewsButton() {
    const btnNewspaper = document.getElementById('btnNewspaper');
    if (!btnNewspaper) return;

    btnNewspaper.innerHTML = '<i class="fi fi-rr-notes" style="color:white !important;"></i>';
    btnNewspaper.title = 'Notícias da Empresa';
    btnNewspaper.setAttribute('aria-label', 'Abrir notícias');

    const newBtn = btnNewspaper.cloneNode(true);
    btnNewspaper.parentNode.replaceChild(newBtn, btnNewspaper);

    newBtn.addEventListener('click', () => {
      localStorage.removeItem('newsModalLastShown');
      this.showNewsModal();
    });

    console.log('📰 Botão de notícias configurado');
  },


  // ─────────────────────────────────────────────────
  // BUSCA GLOBAL
  // ─────────────────────────────────────────────────

  setupGlobalSearch() {
    const searchModal = document.getElementById('globalSearch');
    const btnSearch = document.getElementById('btnSearch');
    const searchInput = document.getElementById('searchInput');
    const searchOverlay = document.querySelector('.search-overlay');
    const btnClose = document.querySelector('.btn-close-search');

    if (!searchModal || !btnSearch) {
      console.warn('⚠️ Elementos de busca não encontrados no DOM');
      return;
    }

    const openSearch = () => { searchModal.classList.add('active'); setTimeout(() => searchInput?.focus(), 100); };
    const closeSearch = () => { searchModal.classList.remove('active'); if (searchInput) searchInput.value = ''; };

    btnSearch.addEventListener('click', (e) => { e.preventDefault(); openSearch(); });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape' && searchModal.classList.contains('active')) closeSearch();
    });

    searchOverlay?.addEventListener('click', closeSearch);
    btnClose?.addEventListener('click', closeSearch);

    console.log('🔍 Sistema de Busca Global configurado.');
  },


  // ─────────────────────────────────────────────────
  // HOTKEYS
  // ─────────────────────────────────────────────────

  setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const routes = Object.values(window.ROUTES).sort((a, b) => a.order - b.order);
        const moduleIndex = parseInt(e.key) - 1;
        if (routes[moduleIndex]) {
          this.loadModule(routes[moduleIndex].id);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        if (confirm('Deseja sair do sistema?')) {
          window.AuthSystem.logout();
        }
      }
    });

    console.log('⌨️ Hotkeys configurados');
  },


  // ─────────────────────────────────────────────────
  // UTILITÁRIOS
  // ─────────────────────────────────────────────────

  showError(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
  },

  debug() {
    console.group('🔍 SPA DEBUG');
    console.log('Módulo atual:', this.currentModuleId);
    console.log('Módulos em cache:', Array.from(this.loadedModules.keys()));
    console.log('CSS carregados:');
    this.cssCache.forEach((modules, href) => {
      console.log(`  ${href} → usados por: [${Array.from(modules).join(', ')}]`);
    });
    console.log('CSS por módulo:');
    this.moduleCSSLinks.forEach((links, moduleId) => {
      console.log(`  ${moduleId}: [${Array.from(links).join(', ')}]`);
    });
    console.log('Usuário:', window.AuthSystem.getCurrentUser());
    console.groupEnd();
  }
};


// ─────────────────────────────────────────────────
// OTIMIZAÇÕES BLAZE
// ─────────────────────────────────────────────────

const BlazeOptimizations = {
  queryCache: new Map(),
  queryCacheExpiry: 5 * 60 * 1000,

  async executeQuery(queryKey, queryFn) {
    const now = Date.now();
    const cached = this.queryCache.get(queryKey);

    if (cached && now - cached.timestamp < this.queryCacheExpiry) {
      console.log(`♻️ Query em cache: ${queryKey}`);
      return cached.data;
    }

    console.log(`📊 Executando query: ${queryKey}`);
    const data = await queryFn();
    this.queryCache.set(queryKey, { data, timestamp: now });
    return data;
  },

  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.queryCacheExpiry) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} queries removidas do cache`);
    }
  },

  batchQueue: [],
  batchTimeout: null,

  async queueWrite(operation) {
    this.batchQueue.push(operation);

    if (this.batchQueue.length >= 10) {
      await this.executeBatch();
      return;
    }

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => { this.executeBatch(); }, 5000);
    }
  },

  async executeBatch() {
    if (this.batchQueue.length === 0) return;

    const operations = this.batchQueue.splice(0);
    clearTimeout(this.batchTimeout);
    this.batchTimeout = null;

    console.log(`📦 Executando batch de ${operations.length} operações`);

    try {
      await Promise.all(operations.map(op => op()));
      console.log(`✅ Batch concluído`);
    } catch (error) {
      console.error(`❌ Erro no batch:`, error);
      this.batchQueue.unshift(...operations);
    }
  }
};


// ─────────────────────────────────────────────────
// showToast GLOBAL
// ─────────────────────────────────────────────────

if (typeof window.showToast === 'undefined') {
  window.showToast = function (message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: 'fi-rr-check-circle',
      error: 'fi-rr-cross-circle',
      warning: 'fi-rr-triangle-warning',
      info: 'fi-rr-info'
    };

    toast.innerHTML = `
      <i class="fi ${icons[type] || icons.info}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode === container) container.removeChild(toast);
      }, 300);
    }, 3000);
  };
}


// ─────────────────────────────────────────────────
// FUNÇÃO GLOBAL: navegarParaModulo (usada nos cards)
// ─────────────────────────────────────────────────

window.navegarParaModulo = function (moduleId) {
  console.log('🔗 Navegando para módulo:', moduleId);
  SPA.loadModule(moduleId);
};


// ─────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SPA.init();
    setInterval(() => { BlazeOptimizations.cleanExpiredCache(); }, 10 * 60 * 1000);
  });
} else {
  SPA.init();
}

window.SPA = SPA;
window.BlazeOptimizations = BlazeOptimizations;

console.log('✅ main.js v3 carregado — suporte a cssPath e cssPaths');
console.log('💡 Execute: window.SPA.debug() para inspecionar estado atual');