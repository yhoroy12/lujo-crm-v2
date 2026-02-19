/**
 * DEMANDA STATE MACHINE
 * Motor de estados exclusivo para o fluxo de demandas entre setores.
 */

const DEMANDA_STATES = {
    PENDENTE: "PENDENTE",
    EM_PROCESSO: "EM_PROCESSO",
    AGUARDANDO_GERENCIA: "AGUARDANDO_GERENCIA",
    CONCLUIDO: "CONCLUIDO",
    RECUSADO: "RECUSADO"
};

const DEMANDA_TRANSITIONS = {
    [DEMANDA_STATES.PENDENTE]: {
        [DEMANDA_STATES.EM_PROCESSO]: { roles: ["OPERADOR_SETOR", "GERENTE", "ADMIN"], requiresJustification: false }
    },
    [DEMANDA_STATES.EM_PROCESSO]: {
        [DEMANDA_STATES.PENDENTE]: { roles: ["OPERADOR_SETOR", "GERENTE", "ADMIN"], requiresJustification: true }, // Encaminhado p/ outro setor
        [DEMANDA_STATES.AGUARDANDO_GERENCIA]: { roles: ["OPERADOR_SETOR", "ADMIN"], requiresJustification: false },
        [DEMANDA_STATES.CONCLUIDO]: { roles: ["OPERADOR_SETOR", "GERENTE", "ADMIN"], requiresJustification: false },
        [DEMANDA_STATES.RECUSADO]: { roles: ["OPERADOR_SETOR", "GERENTE", "ADMIN"], requiresJustification: true }
    },
    [DEMANDA_STATES.AGUARDANDO_GERENCIA]: {
        [DEMANDA_STATES.EM_PROCESSO]: { roles: ["GERENTE", "ADMIN"], requiresJustification: false }, // Aprovação
        [DEMANDA_STATES.RECUSADO]: { roles: ["GERENTE", "ADMIN"], requiresJustification: true } // Reprovação
    },
    [DEMANDA_STATES.RECUSADO]: {
        [DEMANDA_STATES.PENDENTE]: { roles: ["OPERADOR_ORIGEM", "ADMIN"], requiresJustification: false }, // Reenviar
        [DEMANDA_STATES.CONCLUIDO]: { roles: ["OPERADOR_ORIGEM", "ADMIN"], requiresJustification: false }  // Finalizar sem fazer
    },
    [DEMANDA_STATES.CONCLUIDO]: {} // Estado Final
};



window.DemandaStateMachine = {
    STATES: DEMANDA_STATES,

    /**
     * Verifica se a transição é válida
     */
    canTransition(currentState, nextState, userRole) {
        const transition = DEMANDA_TRANSITIONS[currentState]?.[nextState];
        if (!transition) return { allowed: false, reason: "Fluxo não permitido." };
        
        if (!transition.roles.includes(userRole)) {
            return { allowed: false, reason: "Seu cargo não tem permissão para esta ação." };
        }

        return { allowed: true, requiresJustification: transition.requiresJustification };
    },

    /**
     * Retorna os próximos passos possíveis para o usuário atual
     */
    getAvailableActions(currentState, userRole) {
        const actions = DEMANDA_TRANSITIONS[currentState] || {};
        return Object.keys(actions).filter(next => actions[next].roles.includes(userRole));
    }
};

console.log("✅ Demanda State Machine carregada.");