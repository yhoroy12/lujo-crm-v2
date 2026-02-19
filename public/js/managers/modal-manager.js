/**
 * =====================================================
 * MODAL MANAGER
 * Gerenciador universal de modais
 * =====================================================
 */

window.ModalManager = (function() {

  const activeModals = new Set();

  /**
   * Abre um modal
   * @param {string} modalId - ID do modal (ex: 'modalLancamento')
   * @param {Object} options - Opções de configuração
   */
  function open(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    
    if (!modal) {
      console.error(`ModalManager: modal não encontrado - ${modalId}`);
      return;
    }

    modal.classList.add('active');
    activeModals.add(modalId);

    // Focar primeiro input se solicitado
    if (options.focusFirst !== false) {
      const firstInput = modal.querySelector('input:not([readonly]), textarea, select');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }

    // Callback de abertura
    if (options.onOpen) {
      options.onOpen(modal);
    }

    console.log(`📂 Modal aberto: ${modalId}`);
  }

  /**
   * Fecha um modal
   * @param {string} modalId - ID do modal
   * @param {Object} options - Opções
   */
  function close(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    
    if (!modal) {
      console.error(`ModalManager: modal não encontrado - ${modalId}`);
      return;
    }

    modal.classList.remove('active');
    activeModals.delete(modalId);

    // Limpar formulários se solicitado
    if (options.clearForms !== false) {
      const forms = modal.querySelectorAll('form');
      forms.forEach(form => form.reset());
    }

    // Callback de fechamento
    if (options.onClose) {
      options.onClose(modal);
    }

    console.log(`📁 Modal fechado: ${modalId}`);
  }

  /**
   * Configura modal com botões de fechar padrão
   * @param {string} modalId - ID do modal
   * @param {string} moduleId - ID do módulo (para lifecycle)
   * @param {Object} options - Opções
   */
  function setup(modalId, moduleId, options = {}) {
    const modal = document.getElementById(modalId);
    
    if (!modal) {
      console.error(`ModalManager: modal não encontrado - ${modalId}`);
      return;
    }

    const config = {
      closeButtons: ['.close-btn', '[data-action="close"]'],
      closeOnOverlay: options.closeOnOverlay !== false,
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
      ...options
    };

    // Botões de fechar
    config.closeButtons.forEach(selector => {
      const buttons = modal.querySelectorAll(selector);
      buttons.forEach(btn => {
        window.ModuleLifecycle.addListener(
          btn,
          'click',
          () => close(modalId, { onClose: config.onClose }),
          moduleId
        );
      });
    });

    // Fechar ao clicar no overlay
    if (config.closeOnOverlay) {
      window.ModuleLifecycle.addListener(
        modal,
        'click',
        (e) => {
          if (e.target === modal) {
            close(modalId, { onClose: config.onClose });
          }
        },
        moduleId
      );
    }

    // Fechar com ESC
    window.ModuleLifecycle.addListener(
      document,
      'keydown',
      (e) => {
        if (e.key === 'Escape' && activeModals.has(modalId)) {
          close(modalId, { onClose: config.onClose });
        }
      },
      moduleId
    );

    console.log(`✅ Modal configurado: ${modalId}`);
  }

  /**
   * Fecha todos os modais abertos
   */
  function closeAll() {
    activeModals.forEach(modalId => close(modalId));
  }

  /**
   * Verifica se um modal está aberto
   */
  function isOpen(modalId) {
    return activeModals.has(modalId);
  }

  return {
    open,
    close,
    setup,
    closeAll,
    isOpen
  };

})();

console.log('✅ ModalManager carregado');