/**
 * PriorityMaster - Motor Global de Inteligência de Prioridade
 * Responsável por cálculos de score e verificação de regras de negócio.
 */
const PriorityMaster = {
    // Cache interno
    configCache: null,
    vipCache: null,

    /**
     * Inicializa/Atualiza as configurações
     */
    async refreshConfigs() {
        const fStore = window.FirebaseApp.fStore;
        const db = window.FirebaseApp.db;

        try {
            const [docPesos, docVip] = await Promise.all([
                fStore.getDoc(fStore.doc(db, "geral_configs_pesos", "atendimento")),
                fStore.getDoc(fStore.doc(db, "geral_configs_vip", "listas"))
            ]);

            // Valores padrão mais simples
            this.configCache = docPesos.exists() ? docPesos.data() : {
                pesos_base: {},
                pesos_vip: {
                    diamante: 100,
                    ouro: 60,
                    prata: 30,
                    comum: 0  // Peso fixo para não-VIP
                },
                fatores_complexidade: {}
            };
            
            // Só precisa armazenar os VIPs
            this.vipCache = docVip.exists() ? docVip.data() : {
                diamante: [],
                ouro: [],
                prata: []
                // NÃO PRECISA de array para "comum"
            };

            console.log("🚀 [PriorityMaster] Configurações atualizadas.");

        } catch (error) {
            console.error("❌ [PriorityMaster] Erro ao carregar configurações:", error);
            
            // Configurações padrão simplificadas
            this.configCache = {
                pesos_base: {},
                pesos_vip: {
                    diamante: 100,
                    ouro: 60,
                    prata: 30,
                    comum: 0
                },
                fatores_complexidade: {}
            };
            
            this.vipCache = {
                diamante: [],
                ouro: [],
                prata: []
            };
        }
    },

    /**
     * Identifica o nível VIP do cliente (mais eficiente)
     */
    getNivelVip(email) {
        if (!this.vipCache) return 'comum';
        
        const emailLower = email.toLowerCase();
        
        // Verifica apenas nas listas VIP
        if (this.vipCache.diamante?.includes(emailLower)) return 'diamante';
        if (this.vipCache.ouro?.includes(emailLower)) return 'ouro';
        if (this.vipCache.prata?.includes(emailLower)) return 'prata';
        
        // Se não encontrou em nenhuma lista VIP, é comum
        return 'comum';
    },

    /**
     * CÁLCULO MESTRE DE SCORE
     */
    async calcularScore(params) {
        // Garante que temos as configs
        if (!this.configCache) await this.refreshConfigs();
        
        // Fallback se ainda não tem configs
        if (!this.configCache) {
            console.warn("⚠️ [PriorityMaster] Usando configurações padrão");
            return this.calcularScoreFallback(params);
        }

        const { tipoConta, emailCliente, complexidade } = params;
        const cfg = this.configCache;

        let score = 0;

        // 1. Peso Base
        const pesoBase = cfg.pesos_base?.[tipoConta?.toLowerCase()] || 0;
        score += pesoBase;

        // 2. Bônus VIP
        const nivel = this.getNivelVip(emailCliente);
        const bonusVip = cfg.pesos_vip?.[nivel] || 0;
        score += bonusVip;

        // 3. Complexidade
        const fatorComplex = cfg.fatores_complexidade?.[complexidade] || 0;
        score += fatorComplex;

        return {
            total: score,
            detalhes: {
                base: tipoConta,
                peso_base: pesoBase,
                vip: nivel,
                bonus_vip: bonusVip,
                complexidade: complexidade,
                fator_complexidade: fatorComplex
            }
        };
    },

    /**
     * Fallback para quando não há conexão com Firebase
     */
    calcularScoreFallback(params) {
        const { tipoConta, emailCliente, complexidade } = params;
        
        // Valores padrão hardcoded
        const pesosBase = {
            selo: 50,
            artista: 40,
            portador: 30
        };
        
        const pesosVip = {
            diamante: 100,
            ouro: 60,
            prata: 30,
            comum: 0
        };
        
        let score = 0;
        const nivel = 'comum'; // Sem Firebase, assume comum
        
        // Cálculo com valores padrão
        score += pesosBase[tipoConta?.toLowerCase()] || 0;
        score += pesosVip[nivel];
        
        return {
            total: score,
            detalhes: {
                base: tipoConta,
                vip: nivel,
                complexidade: complexidade,
                observacao: "Usando valores padrão (Firebase offline)"
            }
        };
    }
};

// Torna global para ser usado por qualquer script do sistema
window.PriorityMaster = PriorityMaster;