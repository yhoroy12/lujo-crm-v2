/**
 * =====================================================
 * MODULE LIFECYCLE MANAGER (CORRIGIDO)
 * Gerencia ciclo de vida dos módulos SPA
 * Previne vazamento de memória e duplicação de eventos
 * =====================================================
 */

window.ModuleLifecycle = (function () {

  const state = {
    activeModule: null,
    listeners: new Map(),
    initialized: new Set(),
    pendingInit: null // ✅ NOVO: Rastreia módulo sendo inicializado
  };

  /**
   * Adiciona event listener com tracking automático
   * @param {HTMLElement} element - Elemento DOM
   * @param {string} event - Tipo de evento ('click', 'change', etc)
   * @param {Function} handler - Função callback
   * @param {string} moduleId - ID do módulo (ex: 'atendimento')
   */
  function addListener(element, event, handler, moduleId) {
    if (!element || !event || !handler || !moduleId) {
      console.warn('ModuleLifecycle: parâmetros inválidos', { element, event, moduleId });
      return;
    }

    const key = `${moduleId}_${event}_${Date.now()}_${Math.random()}`;
    element.addEventListener(event, handler);

    state.listeners.set(key, {
      element,
      event,
      handler,
      moduleId,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Listener registrado: ${moduleId} (${event}) - Total: ${state.listeners.size}`);
  }

  /**
   * Remove todos os listeners de um módulo específico
   * @param {string} moduleId - ID do módulo para limpar
   */
  function cleanup(moduleId) {
    let removed = 0;

    for (const [key, data] of state.listeners.entries()) {
      if (data.moduleId === moduleId) {
        try {
          data.element?.removeEventListener(data.event, data.handler);
          state.listeners.delete(key);
          removed++;
        } catch (e) {
          console.warn(`Erro ao remover listener: ${key}`, e);
        }
      }
    }

    // Limpar state do módulo
    state.initialized.delete(moduleId);
    if (state.activeModule === moduleId) {
      state.activeModule = null;
    }

    console.log(`🧹 Cleanup ${moduleId}: ${removed} listeners removidos e estado resetado.`);
    return removed;
  }

  /**
   * Inicializa um módulo com cleanup automático do anterior
   * 
   * @param {string} moduleId - ID do novo módulo
   * @param {Function} initFunction - Função de inicialização do módulo
   /*//* 
  function init(moduleId, initFunction) {
    // ===== TRAVA 1: Se já é o módulo ativo, ignora reinit =====
    if (state.activeModule === moduleId) {
      console.warn(`⚠️ Módulo ${moduleId} já está ativo. Abortando duplicata.`);
      return;
    }

    console.log(`🚀 Preparando inicialização do módulo: ${moduleId}`);

    // ===== MARCAR COMO ATIVO ANTES DE CLEANUP (CRÍTICO!) =====
    // Isso previne que o módulo anterior seja reiniciado durante seu cleanup
    state.activeModule = moduleId;
    state.initialized.add(moduleId);

    // ===== LIMPAR LISTENERS DO MÓDULO ANTERIOR =====
    const previousModule = Array.from(state.listeners.values())
      .find(listener => listener.moduleId !== moduleId);
    
    if (previousModule) {
      const prevModuleId = previousModule.moduleId;
      console.log(`🔄 Limpando módulo anterior: ${prevModuleId}`);
      cleanup(prevModuleId);
      
      // Chamar função de cleanup customizada (se existir)
      const cleanupFunctionName = `cleanup${prevModuleId.charAt(0).toUpperCase() + prevModuleId.slice(1)}Module`;
      if (typeof window[cleanupFunctionName] === 'function') {
        try {
          window[cleanupFunctionName]();
          console.log(`✅ Cleanup customizado chamado: ${cleanupFunctionName}`);
        } catch (e) {
          console.warn(`⚠️ Erro ao chamar ${cleanupFunctionName}:`, e);
        }
      }
    }

    // ===== EXECUTAR INICIALIZAÇÃO COM TRATAMENTO DE ERRO =====
    try {
      if (typeof initFunction === 'function') {
        initFunction();
        console.log(`✅ Módulo ${moduleId} carregado no palco com sucesso`);
      } else {
        console.error(`❌ Erro: initFunction para ${moduleId} não é uma função válida`);
        // Reset em caso de erro
        state.activeModule = null;
        state.initialized.delete(moduleId);
      }
    } catch (e) {
      console.error(`❌ Erro crítico ao processar script de ${moduleId}:`, e);
      // Reset em caso de erro
      state.activeModule = null;
      state.initialized.delete(moduleId);
    }
  }
    */
  /**
   * ✅ CORRIGIDO: Inicializa um módulo com proteção robusta contra duplicação
   * 
   * Mudanças principais:
   * 1. Marca como "pendente" ANTES de qualquer operação
   * 2. Verifica se já está ativo OU pendente
   * 3. Cleanup do módulo anterior ANTES de marcar como ativo
   * 
   * @param {string} moduleId - ID do novo módulo
   * @param {Function} initFunction - Função de inicialização do módulo
   */
  function init(moduleId, initFunction) {
    // ===== TRAVA 1: Se já está ativo OU pendente, ignorar =====
    if (state.activeModule === moduleId) {
      console.warn(`⚠️ Módulo ${moduleId} já está ativo. Abortando duplicata.`);
      return;
    }

    if (state.pendingInit === moduleId) {
      console.warn(`⚠️ Módulo ${moduleId} já está sendo inicializado. Abortando duplicata.`);
      return;
    }

    console.log(`🚀 Preparando inicialização do módulo: ${moduleId}`);

    // ===== MARCAR COMO PENDENTE IMEDIATAMENTE (CRÍTICO!) =====
    state.pendingInit = moduleId;

    try {
      // ===== LIMPAR MÓDULO ANTERIOR =====
      if (state.activeModule && state.activeModule !== moduleId) {
        const prevModuleId = state.activeModule;
        console.log(`🔄 Limpando módulo anterior: ${prevModuleId}`);
        
        cleanup(prevModuleId);
        
        // Chamar função de cleanup customizada (se existir)
        const cleanupFunctionName = `cleanup${prevModuleId.charAt(0).toUpperCase() + prevModuleId.slice(1)}Module`;
        if (typeof window[cleanupFunctionName] === 'function') {
          try {
            window[cleanupFunctionName]();
            console.log(`✅ Cleanup customizado chamado: ${cleanupFunctionName}`);
          } catch (e) {
            console.warn(`⚠️ Erro ao chamar ${cleanupFunctionName}:`, e);
          }
        }
      }

      // ===== MARCAR COMO ATIVO ANTES DE EXECUTAR =====
      state.activeModule = moduleId;
      state.initialized.add(moduleId);

      // ===== EXECUTAR INICIALIZAÇÃO COM TRATAMENTO DE ERRO =====
      if (typeof initFunction === 'function') {
        initFunction();
        console.log(`✅ Módulo ${moduleId} carregado no palco com sucesso`);
      } else {
        console.error(`❌ Erro: initFunction para ${moduleId} não é uma função válida`);
        // Reset em caso de erro
        state.activeModule = null;
        state.initialized.delete(moduleId);
      }

    } catch (e) {
      console.error(`❌ Erro crítico ao processar script de ${moduleId}:`, e);
      // Reset em caso de erro
      state.activeModule = null;
      state.initialized.delete(moduleId);
    } finally {
      // ===== LIMPAR FLAG DE PENDENTE =====
      state.pendingInit = null;
    }
  }

  /**
   * Retorna estatísticas de uso
   */
  function getStats() {
    const byModule = {};

    for (const data of state.listeners.values()) {
      byModule[data.moduleId] = (byModule[data.moduleId] || 0) + 1;
    }

    return {
      activeModule: state.activeModule,
      pendingInit: state.pendingInit,
      totalListeners: state.listeners.size,
      byModule,
      initialized: Array.from(state.initialized)
    };
  }

  /**
   * Limpa TODOS os listeners (usar apenas em logout/refresh completo)
   */
  function cleanupAll() {
    const modules = new Set(
      Array.from(state.listeners.values()).map(l => l.moduleId)
    );

    modules.forEach(cleanup);
    state.initialized.clear();
    state.activeModule = null;
    state.pendingInit = null;

    console.log('🧹 Cleanup completo executado');
  }

  /**
   * ✅ NOVO: Debug helper
   */
  function debug() {
    console.group('🔍 MODULE LIFECYCLE DEBUG');
    console.log('📊 Estado atual:', {
      activeModule: state.activeModule,
      pendingInit: state.pendingInit,
      initialized: Array.from(state.initialized),
      totalListeners: state.listeners.size
    });

    console.log('📋 Listeners por módulo:');
    const stats = getStats();
    console.table(stats.byModule);

    console.groupEnd();
  }

  // API pública
  return {
    addListener,
    cleanup,
    init,
    getStats,
    debug,
    cleanupAll
  };

})();

console.log('✅ ModuleLifecycle carregado (CORRIGIDO)');