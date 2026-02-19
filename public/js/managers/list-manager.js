/**
 * =====================================================
 * LIST MANAGER
 * Gerenciador universal de listas e tabelas
 * =====================================================
 */

window.ListManager = (function() {

  /**
   * Renderiza lista/tabela com filtros e busca
   * @param {Object} config - Configuração
   */
  function render(config) {
    const {
      data,              // Array de dados
      container,         // Seletor ou elemento do container
      template,          // Função que retorna HTML para cada item
      filters = {},      // Objeto com filtros ativos
      searchTerm = '',   // Termo de busca
      searchFields = [], // Campos para buscar
      emptyMessage = 'Nenhum item encontrado',
      onRender = null    // Callback após render
    } = config;

    const containerEl = typeof container === 'string' 
      ? document.querySelector(container)
      : container;

    if (!containerEl) {
      console.error('ListManager: container não encontrado', container);
      return;
    }

    // Aplicar filtros
    let filtered = [...data];

    // Filtros customizados
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && value !== 'todos' && value !== 'all') {
        filtered = filtered.filter(item => {
          if (typeof value === 'function') {
            return value(item);
          }
          return item[key] === value;
        });
      }
    });

    // Busca textual
    if (searchTerm && searchFields.length > 0) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        return searchFields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(term);
        });
      });
    }

    // Renderizar
    if (filtered.length === 0) {
      containerEl.innerHTML = `
        <tr><td colspan="999" style="text-align: center; padding: 40px; color: #999;">
          ${emptyMessage}
        </td></tr>
      `;
    } else {
      containerEl.innerHTML = filtered.map(template).join('');
    }

    // Callback
    if (onRender) {
      onRender(filtered, containerEl);
    }

    console.log(`📋 Lista renderizada: ${filtered.length} de ${data.length} itens`);
    return filtered;
  }

  /**
   * Configura filtros automáticos
   * @param {Object} config
   */
  function setupFilters(config) {
    const {
      filterElements,  // { selectStatus: '#filtroStatus', ... }
      searchElement,   // Seletor do input de busca
      data,           // Dados originais
      onFilter,       // Callback(filteredData, filters, searchTerm)
      moduleId        // ID do módulo para lifecycle
    } = config;

    let currentFilters = {};
    let currentSearch = '';

    // Função de atualização
    const update = window.Utils.debounce(() => {
      if (onFilter) {
        onFilter(data, currentFilters, currentSearch);
      }
    }, 300);

    // Configurar selects de filtro
    Object.entries(filterElements).forEach(([key, selector]) => {
      const element = document.querySelector(selector);
      if (!element) {
        console.warn(`ListManager: filtro não encontrado - ${selector}`);
        return;
      }

      window.ModuleLifecycle.addListener(
        element,
        'change',
        (e) => {
          currentFilters[key] = e.target.value;
          update();
        },
        moduleId
      );
    });

    // Configurar busca
    if (searchElement) {
      const searchEl = document.querySelector(searchElement);
      if (searchEl) {
        window.ModuleLifecycle.addListener(
          searchEl,
          'input',
          (e) => {
            currentSearch = e.target.value;
            update();
          },
          moduleId
        );
      }
    }

    console.log('✅ Filtros configurados:', Object.keys(filterElements));

    // Retornar função para limpar filtros
    return {
      clear: () => {
        currentFilters = {};
        currentSearch = '';
        
        // Resetar UI
        Object.values(filterElements).forEach(selector => {
          const el = document.querySelector(selector);
          if (el) el.value = '';
        });
        
        if (searchElement) {
          const searchEl = document.querySelector(searchElement);
          if (searchEl) searchEl.value = '';
        }

        update();
      },
      getFilters: () => ({ ...currentFilters, search: currentSearch })
    };
  }

  /**
   * Adiciona paginação simples
   * @param {Object} config
   */
  function paginate(config) {
    const {
      data,
      pageSize = 10,
      container,
      template,
      paginationContainer
    } = config;

    let currentPage = 1;
    const totalPages = Math.ceil(data.length / pageSize);

    function renderPage(page) {
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pageData = data.slice(start, end);

      const containerEl = document.querySelector(container);
      if (containerEl) {
        containerEl.innerHTML = pageData.map(template).join('');
      }

      // Atualizar controles de paginação
      if (paginationContainer) {
        const paginationEl = document.querySelector(paginationContainer);
        if (paginationEl) {
          paginationEl.innerHTML = `
            <button class="btn btn-sm" ${page === 1 ? 'disabled' : ''} data-page="prev">
              Anterior
            </button>
            <span>Página ${page} de ${totalPages}</span>
            <button class="btn btn-sm" ${page === totalPages ? 'disabled' : ''} data-page="next">
              Próxima
            </button>
          `;
        }
      }
    }

    renderPage(currentPage);

    return {
      next: () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderPage(currentPage);
        }
      },
      prev: () => {
        if (currentPage > 1) {
          currentPage--;
          renderPage(currentPage);
        }
      },
      goTo: (page) => {
        if (page >= 1 && page <= totalPages) {
          currentPage = page;
          renderPage(currentPage);
        }
      }
    };
  }

  return {
    render,
    setupFilters,
    paginate
  };

})();

console.log('✅ ListManager carregado');