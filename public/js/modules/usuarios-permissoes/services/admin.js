/* ===============================
   ADMIN MODULE - VERSÃO MODULAR (v9/v10)
================================ */




if (typeof MODULE_ID === 'undefined') {
    var MODULE_ID = 'admin';
}  

window.initAdminModule = function() {
  console.log("🧠 Inicializando módulo ADMIN (Firebase Modular)");

  window.StateManager.init(MODULE_ID, {
    users: [],
    currentEditingUserId: null
  });

  initAdminTabs();
  initUserModal();
  initRoleModal();
  renderUsers(); 
  renderRoles();
  renderPermissionsMatrix();
  initSearch();
};

/* ===============================
   TABS
================================ */
function initAdminTabs() {
  window.TabManager.init('.modulo-painel-admin', MODULE_ID, {
    onTabChange: (tabId) => {
      console.log(`Admin: aba alterada para ${tabId}`);
    }
  });
}

/* ===============================
   USERS (LISTAGEM REAL-TIME)
================================ */
function renderUsers() {  
  const { db, fStore } = window.FirebaseApp || {};
  
  // Verifica se as funções modulares estão disponíveis
  if (!db || !fStore || !fStore.collection) {
      console.warn("⏳ Aguardando ferramentas do Firestore...");
      setTimeout(renderUsers, 1000);
      return;
  }

  const { collection, onSnapshot, query, orderBy } = fStore;
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("name", "asc"));

  // Escuta em tempo real usando a sintaxe funcional
  onSnapshot(q, (snapshot) => {
    const users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    
    window.StateManager.set(MODULE_ID, { users: users });

    window.ListManager.render({
      data: users,
      container: '#usersTableBody',
      template: (user) => {
        const statusClass = user.active ? "status-active" : "status-inactive";
        return `
          <tr>
            <td>${user.name || 'Sem nome'}</td>
            <td>${user.email}</td>
            <td><span class="role-badge">${user.role}</span></td>
            <td><span class="status-badge ${statusClass}">${user.active ? "Ativo" : "Inativo"}</span></td>
            <td>${user.createdAt ? window.Utils.formatDate(user.createdAt) : '--'}</td>
            <td class="action-btns">
              <button class="btn btn-sm btn-secondary btn-edit-user" data-user-id="${user.id}">Editar</button>
            </td>
          </tr>
        `;
      },
      onRender: () => {
        document.querySelectorAll('.btn-edit-user').forEach(btn => {
          btn.onclick = () => editUser(btn.dataset.userId);
        });
      }
    });
  }, (error) => {
      console.error("Erro no Firestore:", error);
  });
}
function editUser(userId) {
  const state = window.StateManager.get(MODULE_ID);
  const user = state.users.find(u => u.id === userId);
  
  if (!user) return;

  window.StateManager.set(MODULE_ID, { currentEditingUserId: userId });

  document.getElementById("modalTitle").textContent = "Editar Usuário";
  document.getElementById("userName").value = user.name || '';
  document.getElementById("userEmail").value = user.email || '';
  document.getElementById("userUsername").value = user.username || '';
  document.getElementById("userPassword").value = "";
  document.getElementById("userRole").value = user.role || 'ATENDENTE';
  document.getElementById("userActive").value = (user.active !== undefined) ? user.active.toString() : "true";

  window.ModalManager.open('userModal');
  renderPermissionsCheckboxes();
  
  setTimeout(() => {
    if (user.customPermissions) {
       marcarPermissoesAutomaticas(user.customPermissions);
    }
  }, 150);
}

/* ===============================
   SALVAR USUÁRIO (FIREBASE AUTH + FIRESTORE)
================================ */
async function saveUser() {
  const { db, fStore } = window.FirebaseApp;
  const { doc, setDoc } = fStore;
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));

  if (!currentUser) {
    alert("Usuário não autenticado");
    return;
  }

  const email = document.getElementById("userEmail").value.toLowerCase().trim();
  const name = document.getElementById("userName").value.trim();
  const role = document.getElementById("userRole").value;

  // Validações
  if (!email || !name || !role) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  // Verificar hierarquia
  if (!window.AuthHierarchy.canAssignRole(currentUser, role)) {
    alert("Você não tem permissão para atribuir este cargo.");
    return;
  }

  const roleLevel = window.AuthHierarchy.getRoleLevel(role);

  // Criar ID único para o convite (Base64 sem caracteres especiais)
  const inviteId = btoa(email + Date.now()).replace(/[=+/]/g, "");

  const inviteData = {
    name: name,
    email: email,
    role: role,
    roleLevel: roleLevel,
    customPermissions: [], // Pode adicionar lógica para incluir permissões customizadas
    invitedBy: currentUser.name,
    active: false,
    status: "pendente",
    createdAt: new Date().toISOString()
  };

  try {
    if (window.setLoading) window.setLoading(true);

    // Salvar convite no Firestore
    await setDoc(doc(db, "invites", inviteId), inviteData);
    console.log("✅ Convite criado:", inviteId);

    // Gerar link de registro
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/public/html/registro.html?invite=${inviteId}`;

    // Mostrar modal de sucesso com o link
    mostrarModalLink(name, email, inviteLink);

    window.ModalManager.close('userModal');

  } catch (error) {
    console.error("❌ Erro ao criar convite:", error);
    alert("Erro ao salvar convite no banco: " + error.message);
  } finally {
    if (window.setLoading) window.setLoading(false);
  }
}

/* ===============================
   FUNÇÕES DE UI E AUXILIARES
================================ */

function initUserModal() {
  window.ModalManager.setup('userModal', MODULE_ID);
  const btnNovo = document.getElementById("btnNovoUsuario");
  if (btnNovo) {
    btnNovo.onclick = () => {
      window.StateManager.set(MODULE_ID, { currentEditingUserId: null });
      document.getElementById("userForm").reset();
      window.ModalManager.open('userModal');
      renderPermissionsCheckboxes();
    };
  }
  document.getElementById("userForm").onsubmit = (e) => { e.preventDefault(); saveUser(); };
}

function groupPermissionsByModule(permissions) {
  const grouped = {};
  Object.entries(permissions).forEach(([key, value]) => {
    const module = value.split('.')[0];
    const moduleName = module.charAt(0).toUpperCase() + module.slice(1);
    if (!grouped[moduleName]) grouped[moduleName] = [];
    grouped[moduleName].push({ key, value, label: key.replace(/_/g, ' ') });
  });
  return grouped;
}

function renderRoles() {
  if (!window.PermissionsSystem) return;
  const container = document.getElementById("rolesGrid");
  if (!container) return;
  const roles = window.PermissionsSystem.ROLES;
  container.innerHTML = Object.entries(roles).map(([key, role]) => `
    <div class="role-card">
      <h3>${window.Utils.escapeHtml(role.name)}</h3>
      <p>${window.Utils.escapeHtml(role.description)}</p>
      <div class="role-stats">
        <span>${role.permissions.length} permissões</span>
        <button class="btn btn-sm btn-secondary btn-edit-role" data-role="${key}">Editar</button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.btn-edit-role').forEach(btn => {
    window.ModuleLifecycle.addListener(btn, 'click', function() { editRole(this.dataset.role); }, MODULE_ID);
  });
}

function editRole(roleKey) {
  const role = window.PermissionsSystem.ROLES[roleKey];
  if (!role) return;
  window.StateManager.set(MODULE_ID, { currentEditingRole: roleKey });
  document.getElementById("roleModalTitle").textContent = `Editar Perfil: ${role.name}`;
  document.getElementById("roleInfoName").textContent = role.name;
  document.getElementById("roleInfoDesc").textContent = role.description;
  renderRolePermissionsCheckboxes(role.permissions);
  window.ModalManager.open('roleModal');
}

function initRoleModal() {
  window.ModalManager.setup('roleModal', MODULE_ID);
  const form = document.getElementById("roleForm");
  if (form) {
    window.ModuleLifecycle.addListener(form, 'submit', (e) => {
      e.preventDefault();
      alert("Alterações de perfis globais desabilitadas nesta versão.");
      window.ModalManager.close('roleModal');
    }, MODULE_ID);
  }
}

function renderPermissionsCheckboxes() {
  const container = document.getElementById("customPermissionsCheckboxes");
  if (!container || !window.PermissionsSystem) return;
  const grouped = groupPermissionsByModule(window.PermissionsSystem.PERMISSIONS);
  container.innerHTML = Object.entries(grouped).map(([module, perms]) => `
    <div class="checkbox-group">
      <div class="checkbox-group-title">${module}</div>
      ${perms.map(perm => `
        <div class="checkbox-item">
          <input type="checkbox" id="perm_${perm.key}" value="${perm.value}">
          <label for="perm_${perm.key}">${perm.label} <span class="permission-code">${perm.value}</span></label>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function renderRolePermissionsCheckboxes(rolePermissions) {
  const container = document.getElementById("rolePermissionsCheckboxes");
  if (!container) return;
  const grouped = groupPermissionsByModule(window.PermissionsSystem.PERMISSIONS);
  container.innerHTML = Object.entries(grouped).map(([module, perms]) => `
    <div class="checkbox-group">
      <div class="checkbox-group-title">${module}</div>
      ${perms.map(perm => {
        const checked = rolePermissions.includes(perm.value) ? 'checked' : '';
        return `
          <div class="checkbox-item">
            <input type="checkbox" id="role_perm_${perm.key}" value="${perm.value}" ${checked}>
            <label for="role_perm_${perm.key}">${perm.label} <span class="permission-code">${perm.value}</span></label>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

function groupPermissionsByModule(permissions) {
  const grouped = {};
  Object.entries(permissions).forEach(([key, value]) => {
    const module = value.split('.')[0];
    const moduleName = module.charAt(0).toUpperCase() + module.slice(1);
    if (!grouped[moduleName]) grouped[moduleName] = [];
    grouped[moduleName].push({ key, value, label: key.replace(/_/g, ' ') });
  });
  return grouped;
}

function renderPermissionsMatrix() {
  const container = document.getElementById("permissionsMatrix");
  if (!container) return;
  const grouped = groupPermissionsByModule(window.PermissionsSystem.PERMISSIONS);
  container.innerHTML = Object.entries(grouped).map(([module, perms]) => `
    <div class="module-group">
      <h4>📦 ${module}</h4>
      <div class="permissions-list">
        ${perms.map(perm => `<div class="permission-item">${perm.label} <code>${perm.value}</code></div>`).join('')}
      </div>
    </div>
  `).join('');
}

function initSearch() {
  const searchInput = document.getElementById("searchUser");
  if (!searchInput) return;
  searchInput.oninput = (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll("#usersTableBody tr").forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(query) ? "" : "none";
    });
  };
}

/* ============================= */
/* MODAL COM LINK DE CONVITE     */
/* ============================= */
function mostrarModalLink(name, email, link) {
  const modalHTML = `
    <div class="modal-overlay active" id="modalInviteLink">
      <div class="modal-content">
        <div class="modal-header">
          <h3>✉️ Convite Criado com Sucesso</h3>
          <button class="close-btn" id="btnCloseInviteModal">&times;</button>
        </div>
        <div style="padding: 25px;">
          <div style="background: #e6f6ea; border-left: 4px solid #4CAF50; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1a7b3f;">
              <strong>✓ Convite gerado para ${window.Utils.escapeHtml(name)}</strong>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #1a7b3f;">
              Email: ${window.Utils.escapeHtml(email)}
            </p>
          </div>

          <div class="campo">
            <label>Link de Registro</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input 
                type="text" 
                id="inviteLinkInput" 
                value="${link}" 
                readonly 
                style="flex: 1; font-family: monospace; font-size: 12px;"
              >
              <button class="btn btn-primary" id="btnCopyLink">
                <i class="fi fi-rr-copy"></i> Copiar
              </button>
            </div>
          </div>

          <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #856404; font-size: 13px;">
              <strong>⚠️ Importante:</strong>
            </p>
            <ul style="margin: 10px 0 0 20px; color: #856404; font-size: 13px;">
              <li>Envie este link para o usuário por um canal seguro</li>
              <li>O link é válido por 7 dias</li>
              <li>Após o registro, o usuário precisará aguardar aprovação</li>
            </ul>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="btnCloseInvite">Fechar</button>
          <button class="btn btn-primary" id="btnSendEmail">
            <i class="fi fi-rr-envelope"></i> Enviar por Email
          </button>
        </div>
      </div>
    </div>
  `;

  // Remover modal anterior se existir
  const oldModal = document.getElementById('modalInviteLink');
  if (oldModal) oldModal.remove();

  // Adicionar novo modal
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Event Listeners
  const btnClose = document.getElementById('btnCloseInviteModal');
  const btnCloseBottom = document.getElementById('btnCloseInvite');
  const btnCopy = document.getElementById('btnCopyLink');
  const btnSendEmail = document.getElementById('btnSendEmail');
  const linkInput = document.getElementById('inviteLinkInput');

  // Fechar modal
  const closeModal = () => {
    const modal = document.getElementById('modalInviteLink');
    if (modal) modal.remove();
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCloseBottom) btnCloseBottom.onclick = closeModal;

  // Copiar link
  if (btnCopy && linkInput) {
    btnCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(link);
        btnCopy.innerHTML = '<i class="fi fi-rr-check"></i> Copiado!';
        btnCopy.style.background = '#4CAF50';
        
        setTimeout(() => {
          btnCopy.innerHTML = '<i class="fi fi-rr-copy"></i> Copiar';
          btnCopy.style.background = '';
        }, 2000);
      } catch (err) {
        // Fallback para navegadores antigos
        linkInput.select();
        document.execCommand('copy');
        alert('Link copiado!');
      }
    };
  }

  // Enviar por email (placeholder - implementar integração real)
  if (btnSendEmail) {
    btnSendEmail.onclick = () => {
      const subject = encodeURIComponent('Convite para Lujo Network CRM');
      const body = encodeURIComponent(`
Olá ${name},

Você foi convidado(a) para se juntar ao sistema Lujo Network CRM.

Clique no link abaixo para completar seu registro:
${link}

Este link é válido por 7 dias.

Após o registro, aguarde a aprovação do administrador.

Atenciosamente,
Equipe Lujo Network
      `);
      
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
      alert('Cliente de email aberto. Complete o envio manualmente.');
    };
  }

  // Selecionar link automaticamente
  if (linkInput) {
    linkInput.focus();
    linkInput.select();
  }
}

/* ===============================
   RENDER USERS - INCLUIR CONVITES
================================ */
function renderUsers() {
  const { db, fStore } = window.FirebaseApp || {};
  if (!db || !fStore) return;

  const { collection, onSnapshot, query, orderBy } = fStore;

  // Buscar usuários ativos
  const qUsers = query(collection(db, "users"), orderBy("name"));
  
  // Buscar convites pendentes
  const qInvites = query(collection(db, "invites"), orderBy("createdAt", "desc"));

  // Combinar dados de usuários e convites
  Promise.all([
    new Promise(resolve => onSnapshot(qUsers, snap => resolve(snap.docs))),
    new Promise(resolve => onSnapshot(qInvites, snap => resolve(snap.docs)))
  ]).then(([userDocs, inviteDocs]) => {
    const users = userDocs.map(d => ({ 
      id: d.id, 
      ...d.data(), 
      type: 'user' 
    }));
    
    const invites = inviteDocs.map(d => ({ 
      id: d.id, 
      ...d.data(), 
      type: 'invite' 
    }));

    const allData = [...users, ...invites];
    
    window.StateManager.set(MODULE_ID, { users: allData });

    window.ListManager.render({
      data: allData,
      container: '#usersTableBody',
      template: (item) => {
        if (item.type === 'invite') {
          return `
            <tr style="background: #fff3cd;">
              <td>
                ${window.Utils.escapeHtml(item.name)}
                <span style="font-size: 11px; color: #856404; display: block;">
                  ⏳ Convite Pendente
                </span>
              </td>
              <td>${window.Utils.escapeHtml(item.email)}</td>
              <td>${item.role}</td>
              <td>
                <span class="status-badge status-pendente">Aguardando</span>
              </td>
              <td>${window.Utils.formatDate(item.createdAt, true)}</td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-sm btn-secondary btn-resend-invite" data-id="${item.id}">
                    <i class="fi fi-rr-envelope"></i> Reenviar
                  </button>
                  <button class="btn btn-sm btn-danger btn-cancel-invite" data-id="${item.id}">
                    <i class="fi fi-rr-cross"></i> Cancelar
                  </button>
                </div>
              </td>
            </tr>
          `;
        } else {
          return `
            <tr>
              <td>${window.Utils.escapeHtml(item.name || '-')}</td>
              <td>${window.Utils.escapeHtml(item.email)}</td>
              <td>
                <span class="role-badge">${item.role}</span>
              </td>
              <td>
                <span class="status-badge ${item.active ? 'status-active' : 'status-inactive'}">
                  ${item.active ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td>${window.Utils.formatDate(item.createdAt, true)}</td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-sm btn-secondary btn-edit-user" data-id="${item.id}">
                    <i class="fi fi-rr-edit"></i> Editar
                  </button>
                </div>
              </td>
            </tr>
          `;
        }
      },
      onRender: () => {
        // Editar usuário
        document.querySelectorAll('.btn-edit-user').forEach(btn => {
          window.ModuleLifecycle.addListener(btn, 'click', function() {
            editUser(this.dataset.id);
          }, MODULE_ID);
        });

        // Reenviar convite
        document.querySelectorAll('.btn-resend-invite').forEach(btn => {
          window.ModuleLifecycle.addListener(btn, 'click', function() {
            resendInvite(this.dataset.id);
          }, MODULE_ID);
        });

        // Cancelar convite
        document.querySelectorAll('.btn-cancel-invite').forEach(btn => {
          window.ModuleLifecycle.addListener(btn, 'click', function() {
            cancelInvite(this.dataset.id);
          }, MODULE_ID);
        });
      }
    });
  });
}

/* ===============================
   GERENCIAR CONVITES
================================ */
async function resendInvite(inviteId) {
  const state = window.StateManager.get(MODULE_ID);
  const invite = state.users.find(u => u.id === inviteId && u.type === 'invite');
  
  if (!invite) return;

  const baseUrl = window.location.origin;
  const inviteLink = `${baseUrl}/public/html/registro.html?invite=${inviteId}`;
  
  mostrarModalLink(invite.name, invite.email, inviteLink);
}

async function cancelInvite(inviteId) {
  if (!confirm('Tem certeza que deseja cancelar este convite?')) return;

  try {
    const { db, fStore } = window.FirebaseApp;
    const { doc, deleteDoc } = fStore;
    
    await deleteDoc(doc(db, "invites", inviteId));
    alert('✓ Convite cancelado com sucesso!');
  } catch (error) {
    console.error('Erro ao cancelar convite:', error);
    alert('Erro ao cancelar convite: ' + error.message);
  }
}

/* ===============================
   BOTÃO NOVO USUÁRIO
================================ */
function initNewUserButton() {
  const btnNovo = document.getElementById('btnNovoUsuario');
  if (btnNovo) {
    window.ModuleLifecycle.addListener(btnNovo, 'click', () => {
      window.StateManager.set(MODULE_ID, { currentEditingUserId: null });
      
      // Limpar formulário
      document.getElementById('userName').value = '';
      document.getElementById('userEmail').value = '';
      document.getElementById('userRole').value = '';
      
      // Atualizar título
      document.getElementById('modalTitle').textContent = 'Novo Usuário (Convite)';
      
      window.ModalManager.open('userModal');
    }, MODULE_ID);
  }
}

// Adicionar ao initAdminModule
window.initAdminModule = function () {
  console.log("🧠 Inicializando módulo ADMIN");

  window.StateManager.init(MODULE_ID, {
    users: [],
    currentEditingUserId: null
  });

  initAdminTabs();
  initUserModal();
  initNewUserButton(); // NOVO
  renderUsers();
  renderRoles();
  renderPermissionsMatrix();
  initSearch();
};

console.log("✅ Admin module (com sistema de convites) carregado");



/* ===============================
   DEBUG: Verificar hierarquia (opcional)
================================ */
function debugUserHierarchy() {
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
  
  if (!currentUser) {
    console.warn("Nenhum usuário logado");
    return;
  }

  console.group("🔍 Debug de Hierarquia");
  console.log("Usuário atual:", currentUser.name);
  console.log("Cargo:", currentUser.role);
  console.log("Nível:", currentUser.roleLevel);
  console.log("Permissões:", currentUser.permissions);
  
  console.log("\n📊 Teste de atribuição de cargos:");
  
  const roles = ['ADMIN', 'CEO', 'GERENTE', 'SUPERVISOR', 'OPERADOR'];
  
  roles.forEach(role => {
    const canAssign = window.AuthHierarchy.canAssignRole(currentUser, role);
    const roleLevel = window.AuthHierarchy.getRoleLevel(role);
    
    console.log(`${canAssign ? '✅' : '❌'} ${role} (nível ${roleLevel})`);
  });
  
  console.groupEnd();
}

// Expor função de debug no console
window.debugUserHierarchy = debugUserHierarchy;


testFirestoreComplete();
console.log("✅ Admin module carregado com correções definitivas");