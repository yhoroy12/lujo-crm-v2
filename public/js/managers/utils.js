/**
 * =====================================================
 * UTILS
 * Funções utilitárias compartilhadas
 * =====================================================
 */

window.Utils = (function() {

  /**
   * Formata data para padrão brasileiro
   * @param {string|Date} date - Data para formatar
   * @param {boolean} includeTime - Incluir horário
   * @returns {string}
   */
  function formatDate(date, includeTime = false) {
    if (!date) return '-';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let formatted = `${day}/${month}/${year}`;

    if (includeTime) {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      formatted += ` ${hours}:${minutes}`;
    }

    return formatted;
  }

  /**
   * Retorna hora atual formatada
   * @returns {string} HH:MM
   */
  function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Escapa HTML para prevenir XSS
   * @param {string} str - String para escapar
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Formata valor monetário (BRL)
   * @param {number} value - Valor numérico
   * @returns {string}
   */
  function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Debounce: limita frequência de execução de função
   * @param {Function} func - Função para debounce
   * @param {number} wait - Tempo de espera em ms
   * @returns {Function}
   */
  function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Gera ID único
   * @param {string} prefix - Prefixo opcional
   * @returns {string}
   */
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Copia texto para clipboard
   * @param {string} text - Texto para copiar
   * @returns {Promise<boolean>}
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.error('Erro ao copiar:', e);
      return false;
    }
  }

  /**
   * Valida email
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Valida telefone brasileiro
   * @param {string} phone
   * @returns {boolean}
   */
  function isValidPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
  }

  /**
   * Formata CPF
   * @param {string} cpf
   * @returns {string}
   */
  function formatCPF(cpf) {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Formata telefone
   * @param {string} phone
   * @returns {string}
   */
  function formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  /**
   * Scroll suave para elemento
   * @param {string} selector - Seletor CSS
   * @param {Object} options - Opções de scroll
   */
  function scrollTo(selector, options = {}) {
    const element = document.querySelector(selector);
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: options.block || 'start',
      ...options
    });
  }

  /**
   * Aguarda elemento aparecer no DOM
   * @param {string} selector - Seletor CSS
   * @param {number} timeout - Timeout em ms
   * @returns {Promise<HTMLElement>}
   */
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Elemento não encontrado: ${selector}`));
      }, timeout);
    });
  }

  /**
   * Extrai iniciais de um nome
   * @param {string} name
   * @returns {string}
   */
  function getInitials(name) {
    if (!name) return '?';
    
    return name
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, 2)
      .map(word => word[0].toUpperCase())
      .join('');
  }

  return {
    formatDate,
    getCurrentTime,
    escapeHtml,
    formatCurrency,
    debounce,
    generateId,
    copyToClipboard,
    isValidEmail,
    isValidPhone,
    formatCPF,
    formatPhone,
    scrollTo,
    waitForElement,
    getInitials
  };

})();

console.log('✅ Utils carregado');