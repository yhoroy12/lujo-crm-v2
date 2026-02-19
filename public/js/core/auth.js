// ==================== AUTH.JS - SISTEMA DE PERMISSÕES REFATORADO ====================
// Fluxo: Email → Firebase Auth → Firestore (Custom Claims via Cloud Functions)

// ==================== HIERARQUIA DO SISTEMA ====================
const ROLE_LEVELS = {
  ADMIN: 999,           // somente sistema
  CEO: 100,             // jeff
  GERENTE_MASTER: 80,   // mauricio
  GERENTE: 60,          // lisbeth
  SUPERVISOR: 40,       // cesar
  OPERADOR: 20,         // matheus, carlos, reginaldo...
  ESTAGIARIO: 0
};

// Cargos autorizados a criar perfis e usuários
const ROLE_CAN_MANAGE_USERS = [
  'ADMIN',
  'CEO',
  'GERENTE_MASTER',
  'GERENTE'
];

// ===== IMPORTS FIREBASE =====
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ===== ELEMENTOS DO DOM =====
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loading = document.getElementById('loading');

// ===== SISTEMA DE PERMISSÕES GLOBAL =====
window.AuthSystem = {
  isAuthenticated: () => {
    return sessionStorage.getItem('currentUser') !== null;
  },

  /**
   * Retorna dados do usuário atual
   */
  getCurrentUser: () => {
    const userData = sessionStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Verifica se usuário tem uma permissão específica
   * ADMIN tem acesso a tudo
   */
  hasPermission: (permission) => {
    const user = window.AuthSystem.getCurrentUser();

    if (!user) {
      console.warn('🚫 Nenhum usuário logado');
      return false;
    }

    // ADMIN tem acesso total
    if (user.role === 'ADMIN') {
      console.log('✅ Permissão concedida (ADMIN):', permission);
      return true;
    }

    // Verifica permissões customizadas do usuário
    const hasCustomPermission = user.permissions &&
      user.permissions.includes(permission);

    // Verifica permissões do role base (do permissions.js, se existir)
    const rolePermissions = window.PermissionsSystem?.ROLES[user.role]?.permissions || [];
    const hasRolePermission = rolePermissions.includes(permission);

    const hasAccess = hasCustomPermission || hasRolePermission;

    console.log(hasAccess ? '✅' : '❌',
      'Permissão:', permission,
      '| Role:', user.role,
      '| Custom:', hasCustomPermission,
      '| Role Base:', hasRolePermission);

    return hasAccess;
  },

  /**
   * Faz logout
   */
  logout: async () => {
    try {
      if (window.FirebaseApp?.auth) {
        await signOut(window.FirebaseApp.auth);
      }
      sessionStorage.removeItem('currentUser');
      window.location.href = './index.html';
    } catch (error) {
      console.error('Erro no logout:', error);
      // Força logout mesmo com erro
      sessionStorage.removeItem('currentUser');
      window.location.href = './index.html';
    }
  },

  /**
   * Aguarda Firebase estar pronto (Promise)
   */
  ensureUserLoaded: function () {
    return new Promise((resolve) => {
      const check = () => {
        const user = window.AuthSystem?.getCurrentUser();

        if (
          user &&
          user.uid &&
          user.role &&
          typeof user.setor === 'string'
        ) {
          resolve(user);
        } else {
          setTimeout(check, 100);
        }
      };

      check();
    });
  }
};

// ===== HIERARQUIA - FUNÇÕES UTILITÁRIAS =====
function getRoleLevel(role) {
  return ROLE_LEVELS[role] ?? -1;
}

function isAdminSystem(user) {
  return user?.role === 'ADMIN';
}

function canManageUsers(user) {
  if (!user) return false;
  if (isAdminSystem(user)) return true;
  return ROLE_CAN_MANAGE_USERS.includes(user.role);
}

function canCreateRole(user, targetLevel) {
  if (!user) return false;
  if (isAdminSystem(user)) return true;

  const userLevel = getRoleLevel(user.role);
  return userLevel > targetLevel;
}

function canAssignRole(user, targetRole) {
  if (!user) return false;
  if (isAdminSystem(user)) return true;

  const userLevel = getRoleLevel(user.role);
  const targetLevel = getRoleLevel(targetRole);

  return userLevel > targetLevel;
}

// ===== EXPOR FUNÇÕES GLOBAIS (COMPATIBILIDADE) =====
window.logout = window.AuthSystem.logout;
window.isAuthenticated = window.AuthSystem.isAuthenticated;
window.hasPermission = window.AuthSystem.hasPermission;
window.AuthHierarchy = {
  ROLE_LEVELS,
  getRoleLevel,
  canManageUsers,
  canCreateRole,
  canAssignRole,
  isAdminSystem
};

// ===== INICIALIZAÇÃO =====
window.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.endsWith('/') || window.location.pathname.includes('index.html')) {
    initLoginPage();
  }

  // Monitora estado do Firebase Auth
  waitForFirebase().then(() => {
    onAuthStateChanged(window.FirebaseApp.auth, async (fbUser) => {
      if (fbUser) {
        console.log("🔥 Firebase Auth detectado. Validando perfil no banco...");

        try {
          // BUSCA OBRIGATÓRIA NO FIRESTORE ANTES DE LIBERAR
          const userDoc = await getDoc(doc(window.FirebaseApp.db, "users", fbUser.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Monta o crachá completo
            const sessionData = {
              uid: fbUser.uid,
              name: userData.name || 'Usuário',
              email: fbUser.email,
              role: userData.role || 'ESTAGIARIO',
              setor: userData.setor || 'triagem',
              roleLevel: getRoleLevel(userData.role || 'ESTAGIARIO'), // Use a função para garantir o número
              permissions: userData.customPermissions || [],
              department: userData.department || null,
              phone: userData.phone || null
            };

            // Salva na sessão
            sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
            console.log("✅ Perfil validado e salvo na sessão.");

            // SÓ AGORA REDIRECIONA (Se estiver na página de login)
            if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
              window.location.href = './main.html';
            }
          } else {
            throw new Error("Usuário não encontrado no banco de dados.");
          }
        } catch (error) {
          console.error("❌ Falha crítica na validação:", error);
          // Se der erro, desloga por segurança
          signOut(window.FirebaseApp.auth);
          sessionStorage.removeItem('currentUser');
        }
      }
    });
  });
});

/**
 * Aguarda Firebase estar pronto
 */
function waitForFirebase() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (window.FirebaseApp?.auth && window.FirebaseApp?.db) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

/**
 * Inicializa página de login (chips de teste)
 * Carrega os chips com email (removido username)
 */
function initLoginPage() {
  document.querySelectorAll('.profile-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (usernameInput && passwordInput) {
        // Agora os chips contêm 'email' ao invés de 'user'
        usernameInput.value = chip.dataset.email || chip.dataset.user;
        passwordInput.value = chip.dataset.pass;
      }
    });
  });
}

// ===== PROCESSO DE LOGIN REFATORADO (APENAS EMAIL) =====
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    // ===== VALIDAÇÕES INICIAIS =====
    if (!window.FirebaseApp?.auth || !window.FirebaseApp?.db) {
      alert('⚠️ Sistema Firebase não inicializado. Recarregue a página.');
      return;
    }

    if (!email || !password) {
      alert('⚠️ Preencha todos os campos.');
      return;
    }

    if (!email.includes('@')) {
      alert('⚠️ Digite um e-mail válido.');
      return;
    }

    if (loginBtn) loginBtn.disabled = true;
    if (loading) loading.classList.add('show');

    try {
      // ===== ETAPA 1: AUTENTICAR NO FIREBASE AUTH =====
      console.log('🔐 Autenticando no Firebase Auth:', email);

      const userCredential = await signInWithEmailAndPassword(
        window.FirebaseApp.auth,
        email,
        password
      );

      const fbUser = userCredential.user;
      console.log('✅ Autenticação bem-sucedida:', fbUser.uid);

      // ===== ETAPA 2: BUSCAR DOCUMENTO DO FIRESTORE =====
      console.log('📋 Buscando dados do usuário no Firestore...');

      const userDocRef = doc(window.FirebaseApp.db, "users", fbUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('PROFILE_NOT_FOUND');
      }

      const userData = userDoc.data();
      console.log('📊 Dados obtidos:', userData);

      // ===== ETAPA 3: VALIDAR ROLE =====
      const resolvedRole = ROLE_LEVELS.hasOwnProperty(userData.role)
        ? userData.role
        : 'ESTAGIARIO';

      console.log('🔖 Role resolvido:', resolvedRole);

      // ===== ETAPA 4: MONTAR SESSÃO =====
      const sessionData = {
        uid: fbUser.uid,
        name: userData.name || 'Usuário',
        email: fbUser.email,
        role: resolvedRole,
        setor: userData.setor || 'triagem',
        roleLevel: getRoleLevel(resolvedRole),
        permissions: userData.customPermissions || [],
        // Informações adicionais opcionais
        department: userData.department || null,
        phone: userData.phone || null
      };

      // ===== ETAPA 5: SALVAR SESSÃO =====
      sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
      console.log('💾 Sessão salva:', sessionData);

      // ===== REDIRECIONAR =====
      window.location.href = './main.html';

    } catch (error) {
      console.error("❌ Erro no login:", error);

      let errorMessage = 'Erro ao fazer login. ';

      // Mapear erros específicos do Firebase
      switch (error.code) {
        case 'auth/invalid-credential':
          errorMessage = '❌ E-mail ou senha incorretos.';
          break;
        case 'auth/user-not-found':
          errorMessage = '❌ Este e-mail não está cadastrado.';
          break;
        case 'auth/wrong-password':
          errorMessage = '❌ Senha incorreta.';
          break;
        case 'auth/invalid-email':
          errorMessage = '❌ E-mail inválido.';
          break;
        case 'auth/too-many-requests':
          errorMessage = '⏱️ Muitas tentativas de login. Tente novamente em alguns minutos.';
          break;
        default:
          if (error.message === 'PROFILE_NOT_FOUND') {
            errorMessage = '❌ Seu perfil não foi encontrado no sistema. Contate o administrador.';
          } else {
            errorMessage += 'Verifique suas credenciais e tente novamente.';
          }
      }

      alert(errorMessage);

      // Reset do formulário
      if (loginBtn) loginBtn.disabled = false;
      if (loading) loading.classList.remove('show');
      passwordInput.value = '';
    }
  });
}

// ===== LOG DE INICIALIZAÇÃO =====
console.log('✅ Auth.js carregado - Sistema de Permissões inicializado (Modo Email-Only)');