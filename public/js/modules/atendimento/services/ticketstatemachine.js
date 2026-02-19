// ==================== TICKETSTATEMACHINE.JS - MÁQUINA DE ESTADOS DE TICKET ====================

/**
 * LUJO NETWORK CRM - TICKET STATE MACHINE
 * Controle centralizado e rígido de transições de estado de tickets
 * Arquitetura: Finite State Machine (FSM)
 */

const TICKET_STATES = {
  FILA: "FILA", // Estado inicial temporário ao criar ticket
  NOVO: "NOVO", // Ticket direcionado a um operador, aguardando validação de identidade
  IDENTIDADE_VALIDADA: "IDENTIDADE_VALIDADA", // Identidade do solicitante validada
  EM_ATENDIMENTO: "EM_ATENDIMENTO",// Ticket em atendimento ativo
  ENCAMINHADO: "ENCAMINHADO", // Ticket encaminhado para outro setor, altera apenas o campo setor
  AGUARDANDO_SETOR: "AGUARDANDO_SETOR", // Aguardando ação de setor específico (ex: COPYRIGHT, CONTEUDO)
  AGUARDANDO_CLIENTE: "AGUARDANDO_CLIENTE", // Aguardando resposta do cliente
  CONCLUIDO: "CONCLUIDO" // Atendimento concluído, aguardando reabertura ou ação administrativa
};

const FINAL_STATES = [
  TICKET_STATES.CONCLUIDO
];

const TRANSITION_MATRIX = {
  [TICKET_STATES.FILA]: {
    [TICKET_STATES.NOVO]: {  // ✅ FILA → NOVO (operador aceita)
      roles: ["ATENDENTE", "SUPERVISOR", "GERENTE", "ADMIN"],
      requiresJustification: false
    }
  },
  [TICKET_STATES.NOVO]: {
    [TICKET_STATES.IDENTIDADE_VALIDADA]: {  // ✅ NOVO → IDENTIDADE_VALIDADA
      roles: ["ATENDENTE", "SUPERVISOR", "GERENTE", "ADMIN"],
      requiresJustification: false
    }
  },
  [TICKET_STATES.IDENTIDADE_VALIDADA]: {
    [TICKET_STATES.EM_ATENDIMENTO]: {  // ✅ IDENTIDADE_VALIDADA → EM_ATENDIMENTO
      roles: ["ATENDENTE", "SUPERVISOR", "GERENTE", "ADMIN"],
      requiresJustification: false
    }
  },
  [TICKET_STATES.EM_ATENDIMENTO]: {
    [TICKET_STATES.CONCLUIDO]: {  // ✅ EM_ATENDIMENTO → CONCLUIDO
      roles: ["ATENDENTE", "SUPERVISOR", "GERENTE", "ADMIN"],
      requiresJustification: false
    },
    [TICKET_STATES.ENCAMINHADO]: {  // ✅ EM_ATENDIMENTO → ENCAMINHADO
      roles: ["ATENDENTE", "SUPERVISOR", "GERENTE", "ADMIN"],
      requiresJustification: true  // Precisa justificar o encaminhamento
    }
  },
  [TICKET_STATES.ENCAMINHADO]: {
    [TICKET_STATES.CONCLUIDO]: {  // ✅ ENCAMINHADO → CONCLUIDO (após tratar demanda externa)
      roles: ["COPYRIGHT", "CONTEUDO", "SUPERVISOR", "GERENTE", "ADMIN"],
      requiresJustification: false
    }
  },
};

function isValidState(state) {
  return Object.values(TICKET_STATES).includes(state);
}

function isFinalState(state) {
  return FINAL_STATES.includes(state);
}

function canTransition(currentState, nextState, userRole) {
  if (!isValidState(currentState) || !isValidState(nextState)) {
    return { allowed: false, reason: "Estado inválido" };
  }

  if (isFinalState(currentState)) {
    return { allowed: false, reason: "Estado final não pode ser alterado" };
  }

  const possibleTransitions = TRANSITION_MATRIX[currentState];
  if (!possibleTransitions || !possibleTransitions[nextState]) {
    return { allowed: false, reason: "Transição não permitida" };
  }

  const transition = possibleTransitions[nextState];
  if (!transition.roles.includes(userRole)) {
    return { allowed: false, reason: "Usuário não autorizado para esta transição" };
  }

  return { 
    allowed: true, 
    requiresJustification: transition.requiresJustification 
  };
}

function requiresJustification(currentState, nextState) {
  const possibleTransitions = TRANSITION_MATRIX[currentState];
  if (!possibleTransitions || !possibleTransitions[nextState]) {
    return false;
  }
  return possibleTransitions[nextState].requiresJustification;
}

function getAvailableTransitions(currentState, userRole) {
  if (isFinalState(currentState)) {
    return [];
  }

  const possibleTransitions = TRANSITION_MATRIX[currentState];
  if (!possibleTransitions) {
    return [];
  }

  return Object.keys(possibleTransitions).filter(nextState => {
    const transition = possibleTransitions[nextState];
    return transition.roles.includes(userRole) || transition.roles.includes("SYSTEM");
  });
}

function validateTransition(currentState, nextState, userRole, justification = null) {
  const check = canTransition(currentState, nextState, userRole);
  
  if (!check.allowed) {
    return { valid: false, error: check.reason };
  }

  if (check.requiresJustification && (!justification || justification.trim().length < 10)) {
    return { valid: false, error: "Justificativa obrigatória (mínimo 10 caracteres)" };
  }

  return { valid: true };
}

function createStateLog(ticketId, previousState, newState, user, justification = null) {
  return {
    ticketId,
    previousState,
    newState,
    user: {
      username: user.username,
      name: user.name,
      role: user.role
    },
    timestamp: new Date().toISOString(),
    justification: justification || null
  };
}

window.TicketStateMachine = {
  STATES: TICKET_STATES,
  isValidState,
  isFinalState,
  canTransition,
  requiresJustification,
  getAvailableTransitions,
  validateTransition,
  createStateLog
};

console.log("✅ Ticket State Machine carregado");