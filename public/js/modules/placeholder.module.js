/**
 * MODULE PLACEHOLDER - Orquestrador de Módulos em Homologação
 * Segue o padrão AtendimentoModule para manter compatibilidade com o main.js
 */

const PlaceholderModule = {
    id: 'placeholder', // Será sobrescrito pelo ID real no routes.js se necessário
    _initialized: false,

    async init() {
        if (this._initialized) {
            console.warn('⚠️ Módulo já inicializado.');
            return;
        }

        console.log('🚧 Inicializando Placeholder de Homologação');

        try {
            await this.renderAlphaTemplate();
            this._initialized = true;
            console.log('✅ Interface Alpha pronta');
        } catch (error) {
            console.error('❌ Erro no placeholder:', error);
        }
    },

    async renderAlphaTemplate() {
        const container = document.getElementById('app-container'); // Mesmo container do Atendimento
        if (!container) throw new Error('Container #app-container não encontrado');

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; color: #666; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9f9f9; border-radius: 12px; margin: 20px; border: 2px dashed #ddd;">
                <div style="font-size: 5rem; margin-bottom: 20px; filter: grayscale(0.5);">🚧</div>
                <h2 style="color: #333; margin-bottom: 10px; font-weight: 600;">Módulo em Homologação</h2>
                <p style="max-width: 450px; text-align: center; line-height: 1.6; color: #888; font-size: 1.1rem;">
                    A arquitetura para este serviço já está integrada, mas as funcionalidades estão em ambiente de testes (Alpha).
                </p>
                <div style="margin-top: 30px; display: flex; gap: 15px;">
                    <button onclick="location.reload()" style="padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s;">
                        Voltar ao Dashboard
                    </button>
                </div>
                <div style="margin-top: 40px; font-size: 0.8rem; color: #bbb; text-transform: uppercase; letter-spacing: 1px;">
                    Protocolo de Conexão: Modular_V2_Alpha
                </div>
            </div>
        `;
    },

    cleanup() {
        console.log('🧹 Limpando rastro do Placeholder');
        const container = document.getElementById('app-container');
        if (container) container.innerHTML = '';
        this._initialized = false;
    }
};

export default PlaceholderModule;