/**
 * NOVO CLIENTE NOTIFICACAO MANAGER - v4 FINAL
 * 
 * SIMPLIFICADO:
 * - Sem caracteres especiais (emojis)
 * - Logica clara: mostra ou nao mostra
 * - Fila funciona corretamente
 * - Sem duplicacoes
 */

class NovoClienteNotificacaoManager {
  constructor() {
    this.audioAlerta = null;
    this.toastContainer = null;

    // Controle de fila
    this._notificacaoAtiva = false;
    this._filaNotificacoes = [];
    this._onAceitarAtual = null;
    this._onRejeitarAtual = null;
    this._timeoutFechar = null;

    // Configuracoes
    this.config = {
      volumeAlerta: 0.5,
      duracao_toast: 5000,
      permitir_som: true,
      permitir_vibracoes: 'vibrate' in navigator,
      delay_entre_notificacoes: 800
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.inicializar());
    } else {
      this.inicializar();
    }
  }

  inicializar() {
    // Criar container de toast se nao existir
    if (!document.getElementById('toast-container-operador')) {
      const container = document.createElement('div');
      container.id = 'toast-container-operador';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9998;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
      `;
      document.body.appendChild(container);
      this.toastContainer = container;
    } else {
      this.toastContainer = document.getElementById('toast-container-operador');
    }

    // Elemento de audio
    if (!document.getElementById('audio-alerta')) {
      const audio = document.createElement('audio');
      audio.id = 'audio-alerta';
      audio.preload = 'auto';
      document.body.appendChild(audio);
      this.audioAlerta = audio;
    } else {
      this.audioAlerta = document.getElementById('audio-alerta');
    }

    this._vincularBotoes();
    console.log('[NOTIFICACAO] Manager inicializado');
  }

  /**
   * Vincular botoes do popup
   */
  _vincularBotoes() {
    const tentarVincularAceitar = (tentativas = 0) => {
      const btn = document.getElementById('btnIniciarAtendimentoPopup');
      if (btn) {
        btn.replaceWith(btn.cloneNode(true));
        const btnNovo = document.getElementById('btnIniciarAtendimentoPopup');
        
        btnNovo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('[NOTIFICACAO] Botao ACEITAR clicado');
          
          this.fecharNotificacao();
          const callback = this._onAceitarAtual;
          
          // Resetar IMEDIATAMENTE
          this._notificacaoAtiva = false;
          this._onAceitarAtual = null;
          this._onRejeitarAtual = null;
          
          if (callback) callback();
          this._mostrarProxima();
        });
        
        console.log('[NOTIFICACAO] Botao ACEITAR vinculado');
      } else if (tentativas < 20) {
        setTimeout(() => tentarVincularAceitar(tentativas + 1), 300);
      }
    };

    const tentarVincularRejeitar = (tentativas = 0) => {
      const btn = document.getElementById('btnRejeitarAtendimento');
      if (btn) {
        btn.replaceWith(btn.cloneNode(true));
        const btnNovo = document.getElementById('btnRejeitarAtendimento');
        
        btnNovo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('[NOTIFICACAO] Botao REJEITAR clicado');
          
          this.fecharNotificacao();
          const callback = this._onRejeitarAtual;
          
          // Resetar IMEDIATAMENTE
          this._notificacaoAtiva = false;
          this._onAceitarAtual = null;
          this._onRejeitarAtual = null;
          
          if (callback) callback();
          this._mostrarProxima();
        });
        
        console.log('[NOTIFICACAO] Botao REJEITAR vinculado');
      } else if (tentativas < 20) {
        setTimeout(() => tentarVincularRejeitar(tentativas + 1), 300);
      }
    };

    tentarVincularAceitar();
    tentarVincularRejeitar();
  }

  /**
   * Mostrar notificacao - LOGICA PRINCIPAL
   */
  mostrarNotificacao(dadosCliente, onAceitar, onRejeitar) {
    const atendimentoId = dadosCliente.atendimentoId;
    const nomeCliente = dadosCliente.cliente?.nome || 'Cliente';
    
    console.log(`[NOTIFICACAO] Solicitacao: ${atendimentoId} | Ativa: ${this._notificacaoAtiva} | Fila: ${this._filaNotificacoes.length}`);
    
    // Se ja tem uma ativa, enfileira
    if (this._notificacaoAtiva) {
      console.log(`[NOTIFICACAO] Ja tem ativa. Enfileirando: ${atendimentoId}`);
      this._filaNotificacoes.push({ dadosCliente, onAceitar, onRejeitar });
      return;
    }

    // Verificar popup
    const popup = document.getElementById('popupAtendimento');
    if (!popup) {
      console.error('[NOTIFICACAO] ERRO: popupAtendimento nao encontrado');
      return;
    }

    // Marcar como ativa
    this._notificacaoAtiva = true;

    // Guardar callbacks
    this._onAceitarAtual = onAceitar ? () => onAceitar(dadosCliente) : null;
    this._onRejeitarAtual = onRejeitar ? () => onRejeitar(dadosCliente) : null;

    // Preencher dados
    const nomeEl = document.getElementById('popupCliente');
    if (nomeEl) nomeEl.textContent = nomeCliente;

    const canalEl = document.getElementById('popupCanal');
    if (canalEl) canalEl.textContent = dadosCliente.canal || 'Chat';

    // Mostrar popup
    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');

    // Alerta
    this.tocarAlerta();
    this.vibrar();
    this.mostrarToast(`Novo cliente: ${nomeCliente}`, 'info');

    console.log(`[NOTIFICACAO] Exibindo popup: ${atendimentoId}`);
  }

  /**
   * Mostrar proxima da fila
   */
  _mostrarProxima() {
    if (this._timeoutFechar) {
      clearTimeout(this._timeoutFechar);
      this._timeoutFechar = null;
    }

    if (this._filaNotificacoes.length > 0) {
      const proxima = this._filaNotificacoes.shift();
      console.log(`[NOTIFICACAO] Processando proxima. Restantes: ${this._filaNotificacoes.length}`);
      
      this._timeoutFechar = setTimeout(() => {
        this.mostrarNotificacao(proxima.dadosCliente, proxima.onAceitar, proxima.onRejeitar);
      }, this.config.delay_entre_notificacoes);
    } else {
      console.log('[NOTIFICACAO] Fila vazia - pronto para proxima');
    }
  }

  /**
   * Fechar popup
   */
  fecharNotificacao() {
    const popup = document.getElementById('popupAtendimento');
    if (!popup) return;
    
    popup.style.display = 'none';
    popup.setAttribute('aria-hidden', 'true');
  }

  /**
   * Tocar som
   */
  tocarAlerta() {
    if (!this.config.permitir_som) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscilador = audioContext.createOscillator();
      const ganho = audioContext.createGain();

      oscilador.connect(ganho);
      ganho.connect(audioContext.destination);

      oscilador.frequency.value = 900;
      oscilador.type = 'sine';

      ganho.gain.setValueAtTime(0.3, audioContext.currentTime);
      ganho.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscilador.start(audioContext.currentTime);
      oscilador.stop(audioContext.currentTime + 0.5);

      console.log('[NOTIFICACAO] Som tocado');
    } catch (error) {
      console.warn('[NOTIFICACAO] Erro ao tocar som:', error.message);
    }
  }

  /**
   * Vibrar
   */
  vibrar() {
    if (!this.config.permitir_vibracoes) return;

    try {
      navigator.vibrate([200, 100, 200]);
      console.log('[NOTIFICACAO] Vibracoes ativadas');
    } catch (error) {
      console.warn('[NOTIFICACAO] Erro ao vibrar:', error.message);
    }
  }

  /**
   * Toast flutuante
   */
  mostrarToast(mensagem, tipo = 'info') {
    if (!this.toastContainer) return;

    const cores = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
      background: ${cores[tipo] || cores.info};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideInRight 0.3s ease;
      font-weight: 600;
      font-size: 14px;
    `;
    toast.textContent = mensagem;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, this.config.duracao_toast);
  }

  /**
   * Configurar opcoes
   */
  configurar(opcoes) {
    this.config = { ...this.config, ...opcoes };
    console.log('[NOTIFICACAO] Config atualizada:', this.config);
  }

  /**
   * Limpar fila (util ao mudar de aba)
   */
  limparFila() {
    console.log('[NOTIFICACAO] Limpando fila...');
    this._filaNotificacoes = [];
    this._notificacaoAtiva = false;
    this._onAceitarAtual = null;
    this._onRejeitarAtual = null;
    if (this._timeoutFechar) {
      clearTimeout(this._timeoutFechar);
      this._timeoutFechar = null;
    }
    this.fecharNotificacao();
    console.log('[NOTIFICACAO] Fila limpa');
  }

  /**
   * Obter status
   */
  obterStatus() {
    return {
      ativa: this._notificacaoAtiva,
      filaSize: this._filaNotificacoes.length,
      detalhes: this._filaNotificacoes.map(n => n.dadosCliente.atendimentoId)
    };
  }
}

// Estilos
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(400px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
`;
document.head.appendChild(style);

// Exportar
window.NovoClienteNotificacaoManager = new NovoClienteNotificacaoManager();

console.log('[NOTIFICACAO] Manager v4 FINAL carregado');