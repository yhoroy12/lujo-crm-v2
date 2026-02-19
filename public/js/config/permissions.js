// ==================== PERMISSIONS.JS - SISTEMA DE PERMISSÕES GRANULAR ====================

/* 
 * LUJO NETWORK CRM - SISTEMA DE PERMISSÕES
 * Arquitetura baseada em RBAC (Role-Based Access Control)
 */

const PERMISSIONS = {
  // MÓDULO: ATENDIMENTO
  ATEND_VIEW: "atendimento.view",
  ATEND_CREATE: "atendimento.create",
  ATEND_UPDATE: "atendimento.update",
  ATEND_DELETE: "atendimento.delete",
  ATEND_ASSIGN: "atendimento.assign",
  ATEND_CLOSE: "atendimento.close",
  ATEND_REOPEN: "atendimento.reopen",
  ATEND_EXPORT: "atendimento.export",
  ATEND_APPLY_ADMIN_ACTION: "atendimento.apply_admin_action",

  // MÓDULO: CHAT
  CHAT_VIEW: "chat.view",
  CHAT_SEND: "chat.send",
  CHAT_HISTORY: "chat.history",

  // MÓDULO: GERÊNCIA
  GERENCIA_VIEW: "gerencia.view",
  GERENCIA_ASSIGN_TASKS: "gerencia.assign_tasks",
  GERENCIA_VIEW_METRICS: "gerencia.view_metrics",
  GERENCIA_MANAGE_TEAM: "gerencia.manage_team",

  // MÓDULO: RELATÓRIOS
  RELAT_VIEW: "relatorios.view",
  RELAT_EXPORT: "relatorios.export",
  RELAT_VIEW_FINANCIAL: "relatorios.view_financial",
  RELAT_VIEW_ALL: "relatorios.view_all",

  // MÓDULO: CONTEÚDO
  CONT_VIEW: "conteudo.view",
  CONT_REQUEST: "conteudo.request",
  CONT_UPDATE_STATUS: "conteudo.update_status",
  CONT_APPROVE: "conteudo.approve",
  CONT_PRODUCTIVITY: "conteudo.productivity",

  // MÓDULO: COPYRIGHT
  COPYR_VIEW: "copyright.view",
  COPYR_CREATE_ACCOUNT: "copyright.create_account",
  COPYR_APPROVE_ACCOUNT: "copyright.approve_account",
  COPYR_VIEW_CONTRACTS: "copyright.view_contracts",
  COPYR_MANAGE_STRIKES: "copyright.manage_strikes",
  COPYR_MANAGE_TAKEDOWNS: "copyright.manage_takedowns",
  COPYR_SEND_NOTIFICATIONS: "copyright.send_notifications",

  // MÓDULO: FINANCEIRO
  FIN_VIEW: "financeiro.view",
  FIN_VIEW_SUMMARY: "financeiro.view_summary",
  FIN_CREATE: "financeiro.create",
  FIN_UPDATE: "financeiro.update",
  FIN_APPROVE: "financeiro.approve",
  FIN_EXECUTE_PAYMENT: "financeiro.execute_payment",
  FIN_EXPORT: "financeiro.export",
  FIN_ADV_VIEW: "financeiro.advance.view",
  FIN_ADV_CREATE: "financeiro.advance.create",
  FIN_ADV_EDIT: "financeiro.advance.edit",
  FIN_REPORTS: "financeiro.reports",

  // MÓDULO: MARKETING
  MKT_VIEW: "marketing.view",
  MKT_CREATE_CAMPAIGN: "marketing.create_campaign",
  MKT_APPROVE: "marketing.approve",
  MKT_ANALYTICS: "marketing.analytics",

  // MÓDULO: TÉCNICO
  TEC_VIEW: "tecnico.view",
  TEC_CREATE_TICKET: "tecnico.create_ticket",
  TEC_RESOLVE: "tecnico.resolve",

  // MÓDULO: USUÁRIOS (ADMIN)
  USER_VIEW: "usuarios.view",
  USER_CREATE: "usuarios.create",
  USER_UPDATE: "usuarios.update",
  USER_DELETE: "usuarios.delete",
  USER_MANAGE_ROLES: "usuarios.manage_roles",

  // MÓDULO: CONFIGURAÇÕES (ADMIN)
  CONFIG_VIEW: "configuracoes.view",
  CONFIG_UPDATE: "configuracoes.update",
  CONFIG_SYSTEM: "configuracoes.system",

  // PERMISSÕES ESPECIAIS
  SUPER_ADMIN: "system.super_admin",
  VIEW_ALL_DATA: "system.view_all_data",
  AUDIT_LOGS: "system.audit_logs"
};

const BASE_PERMISSIONS = {
  ATENDENTE: [
    PERMISSIONS.ATEND_VIEW,
    PERMISSIONS.ATEND_CREATE,
    PERMISSIONS.ATEND_UPDATE,
    PERMISSIONS.ATEND_CLOSE,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.CHAT_SEND,
    PERMISSIONS.CHAT_HISTORY,
    PERMISSIONS.CONT_REQUEST,
    PERMISSIONS.FIN_VIEW_SUMMARY,
    PERMISSIONS.COPYR_VIEW
  ]
};

BASE_PERMISSIONS.SUPERVISOR = [
  ...BASE_PERMISSIONS.ATENDENTE,
  PERMISSIONS.ATEND_ASSIGN,
  PERMISSIONS.ATEND_REOPEN,
  PERMISSIONS.ATEND_EXPORT,
  PERMISSIONS.GERENCIA_VIEW,
  PERMISSIONS.GERENCIA_ASSIGN_TASKS,
  PERMISSIONS.GERENCIA_VIEW_METRICS,
  PERMISSIONS.RELAT_VIEW,
  PERMISSIONS.RELAT_EXPORT,
  PERMISSIONS.FIN_VIEW,
  PERMISSIONS.FIN_ADV_VIEW,
  PERMISSIONS.FIN_ADV_CREATE,
  PERMISSIONS.FIN_ADV_EDIT
];

BASE_PERMISSIONS.GERENTE = [
  ...BASE_PERMISSIONS.SUPERVISOR,
  PERMISSIONS.ATEND_APPLY_ADMIN_ACTION,
  PERMISSIONS.GERENCIA_MANAGE_TEAM,
  PERMISSIONS.RELAT_VIEW_FINANCIAL,
  PERMISSIONS.RELAT_VIEW_ALL,
  PERMISSIONS.FIN_CREATE,
  PERMISSIONS.FIN_UPDATE,
  PERMISSIONS.FIN_APPROVE,
  PERMISSIONS.FIN_REPORTS,
  PERMISSIONS.FIN_EXECUTE_PAYMENT,
  PERMISSIONS.FIN_EXPORT,
  PERMISSIONS.CONT_APPROVE,
  PERMISSIONS.MKT_VIEW,
  PERMISSIONS.MKT_CREATE_CAMPAIGN,
  PERMISSIONS.MKT_APPROVE
];

const ROLES = {
  ATENDENTE: {
    name: "Atendente",
    description: "Atendimento ao cliente via WhatsApp, e-mail e telefone",
    permissions: BASE_PERMISSIONS.ATENDENTE
  },

  COPYRIGHT: {
    name: "Copyright",
    description: "Análise legal, direitos autorais e conflitos de conteúdo",
    permissions: [
      PERMISSIONS.ATEND_VIEW,
      PERMISSIONS.ATEND_APPLY_ADMIN_ACTION,
      PERMISSIONS.COPYR_VIEW,
      PERMISSIONS.COPYR_CREATE_ACCOUNT,
      PERMISSIONS.COPYR_APPROVE_ACCOUNT,
      PERMISSIONS.COPYR_VIEW_CONTRACTS,
      PERMISSIONS.COPYR_MANAGE_STRIKES,
      PERMISSIONS.COPYR_MANAGE_TAKEDOWNS,
      PERMISSIONS.COPYR_SEND_NOTIFICATIONS,
      PERMISSIONS.CONT_VIEW,
      PERMISSIONS.TEC_VIEW,
      PERMISSIONS.TEC_CREATE_TICKET
    ]
  },

  CONTEUDO: {
    name: "Conteúdo",
    description: "Gestão de solicitações e produtividade de conteúdo",
    permissions: [
      PERMISSIONS.CONT_VIEW,
      PERMISSIONS.CONT_REQUEST,
      PERMISSIONS.CONT_UPDATE_STATUS,
      PERMISSIONS.CONT_PRODUCTIVITY,
      PERMISSIONS.ATEND_VIEW
    ]
  },

  SUPERVISOR: {
    name: "Supervisor",
    description: "Lidera operadores, distribui tarefas e acompanha métricas",
    permissions: BASE_PERMISSIONS.SUPERVISOR
  },

  GERENTE: {
    name: "Gerente",
    description: "Gestão estratégica e operacional da área",
    permissions: BASE_PERMISSIONS.GERENTE
  },

  CEO: {
    name: "CEO",
    description: "Visão estratégica total - somente visualização",
    permissions: [
      PERMISSIONS.VIEW_ALL_DATA,
      PERMISSIONS.RELAT_VIEW_ALL,
      PERMISSIONS.RELAT_VIEW_FINANCIAL,
      PERMISSIONS.GERENCIA_VIEW,
      PERMISSIONS.GERENCIA_VIEW_METRICS,
      PERMISSIONS.FIN_VIEW,
      PERMISSIONS.FIN_ADV_VIEW,
      PERMISSIONS.FIN_REPORTS,
      PERMISSIONS.MKT_ANALYTICS,
      PERMISSIONS.AUDIT_LOGS
    ]
  },

  ADMIN: {
    name: "Administrador",
    description: "Gestão total do sistema",
    permissions: [
      PERMISSIONS.SUPER_ADMIN,
      ...Object.values(PERMISSIONS)
    ]
  }
};
/*
let USERS_DB = {
  ana: { 
    password: '123456', 
    name: 'Ana Silva', 
    email: 'ana@lujonetwork.com', 
    role: 'ATENDENTE', 
    active: true, 
    createdAt: '2025-01-01', 
    customPermissions: [] 
  },
  carlos: { 
    password: '123456', 
    name: 'Carlos Souza', 
    email: 'carlos@lujonetwork.com', 
    role: 'SUPERVISOR', 
    active: true, 
    createdAt: '2025-01-01', 
    customPermissions: [] 
  },
  marina: { 
    password: '123456', 
    name: 'Marina Lopes', 
    email: 'marina@lujonetwork.com', 
    role: 'GERENTE', 
    active: true, 
    createdAt: '2025-01-01', 
    customPermissions: [] 
  },
  juan: { 
    password: '123456', 
    name: 'Juan Copyright', 
    email: 'juan@lujonetwork.com', 
    role: 'COPYRIGHT', 
    active: true, 
    createdAt: '2025-01-01', 
    customPermissions: [] 
  },
  jeff: { 
    password: '123456', 
    name: 'Jeff CEO', 
    email: 'jeff@lujonetwork.com', 
    role: 'CEO', 
    active: true, 
    createdAt: '2025-01-01', 
    customPermissions: [] 
  },
  admin: { 
    password: '123456', 
    name: 'Administrador', 
    email: 'admin@lujonetwork.com', 
    role: 'ADMIN', 
    active: true, 
    createdAt: '2025-01-01', 
    customPermissions: [] 
  }
};
*/

/*
function login(username, password) {
  const user = USERS_DB[username];
  if (!user || user.password !== password) return { success: false, error: 'Usuário ou senha inválidos' };
  if (!user.active) return { success: false, error: 'Usuário inativo' };

  const sessionData = {
    username,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: getUserPermissions(username),
    loginTime: new Date().toISOString()
  };

  sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
  return { success: true, user: sessionData };
}
*/
function logout() {
  sessionStorage.clear();
window.location.href = './index.html';
}


function getCurrentUser() {
  const data = sessionStorage.getItem('currentUser');
  return data ? JSON.parse(data) : null;
}

function isAuthenticated() {
  return getCurrentUser() !== null;
}

function getUserPermissions() {
  const user = getCurrentUser();
  if (!user) return [];
  
  // Se for ADMIN, ele ganha TODAS as permissões do sistema automaticamente
  if (user.role === 'ADMIN') {
    return Object.values(PERMISSIONS);
  }
  
  const rolePermissions = ROLES[user.role]?.permissions || [];
  const customPermissions = user.permissions || [];
  
  return [...new Set([...rolePermissions, ...customPermissions])];
}

function hasPermission(permission) {
  const user = getCurrentUser();
  if (!user) return false;
  
  // Se for ADMIN, sempre retorna true para qualquer permissão solicitada
  if (user.role === 'ADMIN') return true;
  
  const userPermissions = getUserPermissions();
  return userPermissions.includes(permission) || userPermissions.includes(PERMISSIONS.SUPER_ADMIN);
}

function hasModuleAccess(module) {
  const user = getCurrentUser();
  if (!user) return false;

  // REGRA DE OURO: Admin entra em qualquer lugar
  if (user.role === 'ADMIN') return true;

  const modulePermissions = {
    atendimento: PERMISSIONS.ATEND_VIEW,
    conteudo: PERMISSIONS.CONT_VIEW,
    financeiro: PERMISSIONS.FIN_VIEW,
    marketing: PERMISSIONS.MKT_VIEW,
    tecnico: PERMISSIONS.TEC_VIEW,
    gerencia: PERMISSIONS.GERENCIA_VIEW,
    relatorios: PERMISSIONS.RELAT_VIEW,
    admin: PERMISSIONS.SUPER_ADMIN
  };

  return hasPermission(modulePermissions[module]);
}
window.PermissionsSystem = {
  PERMISSIONS,
  ROLES,
  logout,
  getCurrentUser,
  isAuthenticated,
  hasPermission,
  hasModuleAccess,
  getUserPermissions
};

console.log("✅ Sistema de Permissões (RBAC Dinâmico) carregado");