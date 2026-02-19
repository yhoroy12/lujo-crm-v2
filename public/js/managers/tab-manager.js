/**
 * =====================================================
 * TAB MANAGER
 * Gerenciador universal de abas para todos os módulos
 * =====================================================
 */

window.TabManager = (function() {

  /**
   * Inicializa sistema de abas para um container
   * @param {string} containerSelector - Seletor CSS do container pai
   * @param {string} moduleId - ID do módulo (para lifecycle)
   * @param {Object} options - Opções de configuração
   */
  function init(containerSelector, moduleId, options = {}) {
    const container = document.querySelector(containerSelector);
    
    if (!container) {
      console.error(`TabManager: container não encontrado - ${containerSelector}`);
      return;
    }

    const config = {
      tabButtonSelector: options.tabButtonSelector || '.aba-btn',
      tabContentSelector: options.tabContentSelector || '.aba-conteudo',
      activeClass: options.activeClass || 'ativa',
      onTabChange: options.onTabChange || null,
      ...options
    };

    const buttons = container.querySelectorAll(config.tabButtonSelector);
    const contents = container.querySelectorAll(config.tabContentSelector);

    if (!buttons.length || !contents.length) {
      console.warn('TabManager: botões ou conteúdos não encontrados', {
        buttons: buttons.length,
        contents: contents.length
      });
      return;
    }

    // Handler de clique
    const handleTabClick = function() {
      const targetTab = this.dataset.aba;
      
      if (!targetTab) {
        console.warn('TabManager: botão sem data-aba');
        return;
      }

      // Desativar todos
      buttons.forEach(btn => btn.classList.remove(config.activeClass));
      contents.forEach(content => content.classList.remove(config.activeClass));

      // Ativar selecionado
      this.classList.add(config.activeClass);
      
      const targetContent = container.querySelector(`.${targetTab}`);
      if (targetContent) {
        targetContent.classList.add(config.activeClass);
        
        // Callback personalizado
        if (config.onTabChange) {
          config.onTabChange(targetTab, targetContent);
        }

        console.log(`📑 Aba ativada: ${targetTab}`);
      } else {
        console.error(`TabManager: conteúdo não encontrado - .${targetTab}`);
      }
    };

    // Registrar listeners
    buttons.forEach(btn => {
      window.ModuleLifecycle.addListener(
        btn,
        'click',
        handleTabClick.bind(btn),
        moduleId
      );
    });

    console.log(`✅ TabManager inicializado para ${moduleId} (${buttons.length} abas)`);
  }

  /**
   * Ativa uma aba específica programaticamente
   * @param {string} containerSelector - Seletor do container
   * @param {string} tabId - ID da aba (valor de data-aba)
   */
  function activateTab(containerSelector, tabId) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const button = container.querySelector(`[data-aba="${tabId}"]`);
    if (button) {
      button.click();
    } else {
      console.warn(`TabManager: aba não encontrada - ${tabId}`);
    }
  }

  return {
    init,
    activateTab
  };

})();

console.log('✅ TabManager carregado');