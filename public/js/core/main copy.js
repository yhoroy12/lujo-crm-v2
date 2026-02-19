/**
 * =====================================================
 * MAIN.JS - Orquestrador Principal da SPA (CORRIGIDO v2)
 * Gerencia navegação, módulos e otimizações Blaze
 * ✅ CORRIGIDO: Removido setupNavigation duplicado
 * =====================================================
 */

const SPA = {
  currentModule: null,
  currentModuleId: null,
  isLoading: false,
  loadedModules: new Map(),
  cssCache: new Set(),


  /**
   * Inicializa a SPA
   */
  async init() {
    console.log('🚀 Inicializando SPA');

    try {
      // 1. Aguardar autenticação
      await this.waitForAuth();
      console.log('✅ Autenticação pronta');

      // ✅ CORRIGIDO: Removido setupNavigation() - agora é gerenciado pelo permission-filter.js
      // Isso evita duplicação de listeners

      // 2. Modal de noticias
      this.showNewsModal();
      console.log('✅ Modal de notícias exibido');

      // 3. Setup hotkeys e atalhos globais
      this.setupHotkeys();
      console.log('✅ Hotkeys configurados');

      // 4. Setup busca global
      this.setupGlobalSearch();
      console.log('✅ Busca global configurada');

      // 5. Aguardar permissões
      await this.waitForPermissions();
      console.log('✅ Permissões carregadas');

      // 6. Filtrar cards do main por permissão
      this.filterDashboardCards();
      console.log('✅ Cards do dashboard filtrados por permissão');

      // 7. Setup botão noticias
      this.setupNewsButton();
      console.log('✅ Botão de notícias configurado');

      console.log('🎉 SPA pronto para uso');

    } catch (error) {
      console.error('❌ Erro ao inicializar SPA:', error);
      this.showError('Erro ao inicializar sistema. Recarregue a página.');
    }
  },


  /**
   * Aguarda autenticação estar pronta
   */
  async waitForAuth() {
    console.log('⏳ Aguardando validação do perfil...');
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const user = window.PermissionsSystem.getCurrentUser();
        if (user && user.role) {
          clearInterval(interval);
          resolve(user);
        }
      }, 200); // Checa a cada 200ms
    });
  },

  /**
   * Aguarda permissões estar prontas
   */
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

  /**
   * ⭐ NOVO: Mostra modal de notícias ao fazer login
   */
  showNewsModal() {
    const user = window.AuthSystem.getCurrentUser();
    if (!user) return;

    // Criar modal de notícias
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
            <!-- Notícia 1 -->
            <article class="news-item" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 18px; color: var(--color-text);">
                  🎯 Nova Política de Atendimento
                </h3>
                <span style="font-size: 12px; color: #999;">25/01/2025</span>
              </div>
              <p style="line-height: 1.6; color: #666;">
                A partir do próximo mês, haverá atualizações nos horários e procedimentos para melhor atender nossos clientes. 
                O atendimento será estendido até às 20h nos dias úteis.
              </p>
              <div style="margin-top: 10px;">
                <span class="status-badge" style="background: #e3f2fd; color: #1976d2; font-size: 11px;">
                  Comunicado Oficial
                </span>
              </div>
            </article>

            <!-- Notícia 2 -->
            <article class="news-item" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 18px; color: var(--color-text);">
                  🚀 Campanha de Marketing 2025
                </h3>
                <span style="font-size: 12px; color: #999;">20/01/2025</span>
              </div>
              <p style="line-height: 1.6; color: #666;">
                O novo ciclo de campanhas foca no público jovem e em estratégias digitais modernas. 
                Todos os setores devem alinhar seus processos com as novas diretrizes.
              </p>
              <div style="margin-top: 10px;">
                <span class="status-badge" style="background: #fff3cd; color: #856404; font-size: 11px;">
                  Marketing
                </span>
              </div>
            </article>

            <!-- Notícia 3 -->
            <article class="news-item" style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 18px; color: var(--color-text);">
                  💡 Atualização do Sistema CRM
                </h3>
                <span style="font-size: 12px; color: #999;">15/01/2025</span>
              </div>
              <p style="line-height: 1.6; color: #666;">
                Nova interface implementada com melhorias de performance e experiência do usuário. 
                Explore os novos recursos disponíveis em cada módulo.
              </p>
              <div style="margin-top: 10px;">
                <span class="status-badge" style="background: #e6f6ea; color: #1a7b3f; font-size: 11px;">
                  Tecnologia
                </span>
              </div>
            </article>
          </div>
          <div class="modal-footer">
            <label style="display: flex; align-items: center; gap: 8px; margin-right: auto;">
              <input type="checkbox" id="dontShowAgainToday" style="width: 16px; height: 16px;">
              <span style="font-size: 13px; color: #666;">Não mostrar novamente hoje</span>
            </label>
            <button class="btn btn-primary" id="btnCloseNews2">
              Entendi
            </button>
          </div>
        </div>
      </div>
    `;

    // Verificar se já foi mostrado hoje
    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('newsModalLastShown');

    if (lastShown === today) {
      console.log('ℹ️ Modal de notícias já foi mostrado hoje');
      return;
    }

    // Adicionar ao DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Registrar listeners
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

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal) {
        closeModal();
      }
    }, { once: true });

    console.log('📰 Modal de notícias exibido');
  },


  setupNewsButton() {
    const btnNewspaper = document.getElementById('btnNewspaper');

    if (btnNewspaper) {
      // Alterar ícone e título
      btnNewspaper.innerHTML = '<i class="fi fi-rr-notes" style="color: white !important;"></i>';
      btnNewspaper.title = 'Notícias da Empresa';
      btnNewspaper.setAttribute('aria-label', 'Abrir notícias');

      // Remover listeners antigos
      const newBtn = btnNewspaper.cloneNode(true);
      btnNewspaper.parentNode.replaceChild(newBtn, btnNewspaper);

      // Adicionar novo listener
      newBtn.addEventListener('click', () => {
        // Remover restrição de "não mostrar hoje"
        localStorage.removeItem('newsModalLastShown');
        this.showNewsModal();
      });

      console.log('📰 Botão de notícias configurado');
    }
  },

  /* ⭐ NOVO: Filtra cards do dashboard por permissão
   */
  filterDashboardCards() {
    const user = window.PermissionsSystem.getCurrentUser();
    if (!user) return;

    const cards = document.querySelectorAll('.dash-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const moduleId = card.getAttribute('data-module');
      // Se for ADMIN, sempre mostra. Caso contrário, checa a permissão.
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


  /**
   * ✅ CORRIGIDO: Removido setupNavigation()
   * Agora o permission-filter.js é responsável por gerenciar os cliques
   * nos links do sidebar. Isso evita duplicação de listeners.
   * 
   * A navegação via cards do dashboard usa a função global navegarParaModulo()
   * que está definida na linha 758.
   */


  /**
   * Carrega um módulo dinamicamente
   */

  async loadModule(moduleId) {
    // Se já estiver carregando algo, ignora o novo clique
    if (this.isLoading) {
      console.warn(`⏳ Já existe um carregamento em curso. Ignorando: ${moduleId}`);
      return;
    }

    // Se o módulo já é o atual, não recarrega (Evita duplicar listeners)
    if (this.currentModuleId === moduleId) {
      console.log(`ℹ️ Módulo ${moduleId} já está ativo.`);
      return;
    }

    this.isLoading = true; // Inicia trava
    console.log(`📦 Carregando módulo: ${moduleId}`);

    // ✅ SOLUÇÃO: Antes de carregar o novo, limpa o atual
    if (this.currentModule && typeof this.currentModule.cleanup === 'function') {
      console.log(`🧹 Executando cleanup do módulo: ${this.currentModuleId}`);
      this.currentModule.cleanup();
    }

    const route = window.RoutesUtil.getRoute(moduleId);
    if (!route) {
      console.error(`❌ Módulo não encontrado: ${moduleId}`);
      return;
    }

    const user = window.PermissionsSystem.getCurrentUser();
    if (user.role !== 'ADMIN') {
      if (!window.PermissionsSystem.hasModuleAccess(moduleId)) {
        console.error(`❌ Sem permissão para acessar: ${moduleId}`);
        window.showToast?.('Acesso negado', 'error');
        return;
      }
    }

    if (this.currentModuleId === moduleId) {
      console.log(`⚠️ Módulo ${moduleId} já está ativo`);
      return;
    }

    try {
      // Cleanup do módulo anterior
      if (this.currentModule && typeof this.currentModule.cleanup === 'function') {
        console.log(`🧹 Limpando módulo anterior: ${this.currentModuleId}`);
        this.currentModule.cleanup();
      }

      // ⭐ ESCONDER DASHBOARD
      const dashboard = document.getElementById('dashboard-inicial');
      if (dashboard) {
        dashboard.classList.remove('modulo-ativo');
        dashboard.classList.add('modulo-oculto');
      }

      // Mostrar loading
      const container = document.getElementById('modulos-container');
      if (container) {
        container.classList.remove('modulo-oculto');
        container.classList.add('modulo-ativo');
        container.innerHTML = '<div style="text-align: center; padding: 40px;"><p>⏳ Carregando...</p></div>';
      }

      // Carregar CSS do módulo
      await this.loadModuleCSS(route);

      // Carregar módulo
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

      console.log(`✅ Módulo carregado: ${moduleId}`);

    } catch (error) {
      console.error(`❌ Erro ao carregar módulo ${moduleId}:`, error);

      const container = document.getElementById('modulos-container');
      if (container) {
        container.innerHTML = `
          <div style="color: red; padding: 40px; text-align: center;">
            <h3>❌ Erro ao carregar módulo</h3>
            <p>${error.message}</p>
            <button class="btn btn-primary" onclick="location.reload()">
              Recarregar Página
            </button>
          </div>
        `;
      }
    } finally {
      this.isLoading = false; // Libera trava
    }
  },
  /**
    * Carrega CSS do módulo
    */
  async loadModuleCSS(route) {
    if (!route.cssPath) return;

    // Se o CSS já estiver no cache, não faz nada
    if (this.cssCache.has(route.cssPath)) {
      console.log(`♻️ CSS já em cache: ${route.cssPath}`);
      return;
    }

    // Identificador único para o link de estilo do módulo
    const linkId = `style-${route.id}`;

    // Remove qualquer CSS de módulo anterior para evitar conflitos (Race Conditions de estilo)
    this.removeOtherModuleCSS(route.id);

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = route.cssPath; // Ex: "css/atendimento/atendimento.css"

      link.onload = () => {
        this.cssCache.add(route.cssPath);
        console.log(`📄 CSS carregado com sucesso: ${route.cssPath}`);
        resolve();
      };

      link.onerror = () => {
        console.error(`❌ Falha ao carregar CSS: ${route.cssPath}`);
        reject(new Error(`Erro ao carregar estilo: ${route.cssPath}`));
      };

      document.head.appendChild(link);
    });
  },

  /**
   * Remove CSS de outros módulos
   */
  removeOtherModuleCSS(currentModuleId) {
    // Mantém apenas o global e utilitários
    document.querySelectorAll('link[id^="style-"]').forEach(link => {
      const moduleId = link.id.replace('style-', '');
      if (moduleId !== currentModuleId) {
        link.remove();
        this.cssCache.delete(link.href);
        console.log(`🧹 Limpeza de estilo: removido ${moduleId}`);
      }
    });
  },

  /**
   * Atualiza highlight do link ativo no sidebar
   */
  updateSidebarActive(moduleId) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const isHome = link.id === 'btnGoHome';
      if (moduleId) {
        link.classList.toggle('active', link.getAttribute('data-module') === moduleId);
      } else {
        // Se moduleId for null, apenas o home fica ativo
        link.classList.toggle('active', isHome);
      }
    });
  },

  /**
   * ⭐ NOVO: Atualiza breadcrumb
   */
  updateBreadcrumb(moduleName) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = `
        <span>Lujo Network</span>
        <span>${moduleName}</span>
      `;
    }
  },

  /**
   * ===== SISTEMA DE BUSCA GLOBAL =====
   */
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

    // Função interna para abrir
    const openSearch = () => {
      searchModal.classList.add('active');
      setTimeout(() => searchInput.focus(), 100); // Delay para o focus funcionar após o display flex
    };

    // Função interna para fechar
    const closeSearch = () => {
      searchModal.classList.remove('active');
      searchInput.value = ''; // Limpa a busca ao fechar
    };

    // 1. Gatilho por Clique no Botão do Header
    btnSearch.addEventListener('click', (e) => {
      e.preventDefault();
      openSearch();
    });

    // 2. Gatilho por Atalho (Ctrl + /)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        openSearch();
      }

      // 3. Fechar com ESC
      if (e.key === 'Escape' && searchModal.classList.contains('active')) {
        closeSearch();
      }
    });

    // 4. Fechar ao clicar no Overlay (fundo)
    if (searchOverlay) {
      searchOverlay.addEventListener('click', closeSearch);
    }

    // 5. Fechar no botão "X"
    if (btnClose) {
      btnClose.addEventListener('click', closeSearch);
    }

    console.log('🔍 Sistema de Busca Global vinculado com sucesso.');
  },

  /**
   * Configura hotkeys globais
   */
  setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const routes = Object.values(window.ROUTES)
          .sort((a, b) => a.order - b.order);

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

  /**
   * Mostra mensagem de erro
   */
  showError(message) {
    // Usar toast do sistema se disponível
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
  },

  /**
   * Debug: imprime estado atual
   */
  debug() {
    console.group('🔍 SPA DEBUG');
    console.log('Módulo atual:', this.currentModuleId);
    console.log('Módulos em cache:', Array.from(this.loadedModules.keys()));
    console.log('CSS em cache:', Array.from(this.cssCache));
    console.log('Usuário:', window.AuthSystem.getCurrentUser());
    console.groupEnd();
  }
};

/**
 * =====================================================
 * OTIMIZAÇÕES PARA BLAZE
 * =====================================================
 */

const BlazeOptimizations = {
  /**
   * Cache de queries Firestore
   * Reduz leituras desnecessárias
   */
  queryCache: new Map(),
  queryCacheExpiry: 5 * 60 * 1000, // 5 minutos

  /**
   * Executar query com cache
   */
  async executeQuery(queryKey, queryFn) {
    const now = Date.now();
    const cached = this.queryCache.get(queryKey);

    if (cached && now - cached.timestamp < this.queryCacheExpiry) {
      console.log(`♻️ Query em cache: ${queryKey}`);
      return cached.data;
    }

    console.log(`📊 Executando query: ${queryKey}`);
    const data = await queryFn();

    this.queryCache.set(queryKey, {
      data,
      timestamp: now
    });

    return data;
  },

  /**
   * Limpar cache de queries expiradas
   */
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

  /**
   * Batch operations para economizar escritas
   */
  batchQueue: [],
  batchTimeout: null,

  async queueWrite(operation) {
    this.batchQueue.push(operation);

    // Se atingiu 10 operações, executar batch
    if (this.batchQueue.length >= 10) {
      await this.executeBatch();
      return;
    }

    // Se não há timeout, criar um
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.executeBatch();
      }, 5000); // Aguardar 5 segundos por mais operações
    }
  },

  async executeBatch() {
    if (this.batchQueue.length === 0) return;

    const operations = this.batchQueue.splice(0);
    clearTimeout(this.batchTimeout);
    this.batchTimeout = null;

    console.log(`📦 Executando batch de ${operations.length} operações`);

    try {
      // Executar operações em paralelo
      await Promise.all(operations.map(op => op()));
      console.log(`✅ Batch concluído`);
    } catch (error) {
      console.error(`❌ Erro no batch:`, error);
      // Re-enfileirar operações falhadas
      this.batchQueue.unshift(...operations);
    }
  }
};

/**
 * ===== FUNÇÃO GLOBAL showToast (se não existir) =====
 */
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
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };
}

/**
 * ⭐ FUNÇÃO GLOBAL: Navegar para módulo (usada nos cards)
 */
window.navegarParaModulo = function (moduleId) {
  console.log('🔗 Navegando para módulo:', moduleId);
  SPA.loadModule(moduleId);
};

/**
 * =====================================================
 * INICIALIZAÇÃO
 * =====================================================
 */

// Inicializar SPA quando documento está pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SPA.init();

    // Limpar cache a cada 10 minutos
    setInterval(() => {
      BlazeOptimizations.cleanExpiredCache();
    }, 10 * 60 * 1000);
  });
} else {
  SPA.init();
}

// Exposer globalmente
window.SPA = SPA;
window.BlazeOptimizations = BlazeOptimizations;

console.log('✅ main.js carregado (CORRIGIDO v2) - SPA pronto para uso');
console.log('💡 Execute: window.SPA.debug() para ver estado atual');