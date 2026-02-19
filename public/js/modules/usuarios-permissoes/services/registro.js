// ==================== REGISTRO.JS ====================

// Aguardar Firebase estar pronto
waitForFirebase().then(() => {
  inicializarRegistro();
});

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

/* ============================= */
/* INICIALIZAÇÃO                 */
/* ============================= */
async function inicializarRegistro() {
  console.log("📋 Inicializando página de registro");

  // Elementos do DOM
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const registroForm = document.getElementById('registroForm');
  const form = document.getElementById('formCompletarCadastro');

  // Recuperar inviteId da URL
  const params = new URLSearchParams(window.location.search);
  const inviteId = params.get('invite');

  if (!inviteId) {
    mostrarErro('Link de convite inválido. Parâmetro ausente.');
    return;
  }

  try {
    // Buscar dados do convite no Firestore
    const inviteData = await buscarConvite(inviteId);

    if (!inviteData) {
      mostrarErro('Este convite não existe ou já foi utilizado.');
      return;
    }

    // Preencher formulário com dados do convite
    preencherFormulario(inviteData);

    // Mostrar formulário
    loadingState.classList.add('hidden');
    registroForm.classList.remove('hidden');

    // Inicializar validações
    inicializarValidacoes();

    // Handler do formulário
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await completarCadastro(inviteId, inviteData);
    });

  } catch (error) {
    console.error('Erro ao carregar convite:', error);
    mostrarErro('Erro ao verificar convite. Tente novamente mais tarde.');
  }
}

/* ============================= */
/* BUSCAR CONVITE (CORRIGIDO)    */
/* ============================= */
async function buscarConvite(inviteId) {
  const { db, fStore } = window.FirebaseApp;
  
  // Esta linha tenta pegar o getDoc de qualquer lugar possível dentro do seu app
  const getDocFunc = fStore?.getDoc || window.FirebaseApp?.getDoc;
  const docFunc = fStore?.doc || window.FirebaseApp?.doc;

  if (!getDocFunc || !docFunc) {
    console.error("❌ ERRO CRÍTICO: As funções getDoc ou doc não foram carregadas no objeto FirebaseApp.");
    console.log("Conteúdo de fStore:", fStore);
    return null;
  }

  try {
    const inviteRef = docFunc(db, "invites", inviteId);
    const inviteSnap = await getDocFunc(inviteRef);

    if (!inviteSnap.exists()) {
      return null;
    }

    return inviteSnap.data();
  } catch (error) {
    console.error('❌ Erro ao buscar convite no Firestore:', error);
    throw error;
  }
}
/* ============================= */
/* PREENCHER FORMULÁRIO          */
/* ============================= */
function preencherFormulario(data) {
  document.getElementById('userName').value = data.name || '';
  document.getElementById('userEmail').value = data.email || '';
  document.getElementById('userRole').value = data.role || '';
  document.getElementById('invitedBy').value = data.invitedBy || 'Sistema';
}

/* ============================= */
/* VALIDAÇÕES                    */
/* ============================= */
function inicializarValidacoes() {
  const passwordInput = document.getElementById('userPassword');
  const confirmInput = document.getElementById('userPasswordConfirm');
  const toggleBtn = document.getElementById('togglePassword');
  const strengthFill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');
  const matchError = document.getElementById('passwordMatchError');

  // Toggle mostrar/ocultar senha
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      confirmInput.type = type;
      
      const icon = toggleBtn.querySelector('i');
      icon.className = type === 'password' ? 'fi fi-rr-eye' : 'fi fi-rr-eye-crossed';
    });
  }

  // Força da senha
  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      const password = passwordInput.value;
      const strength = calcularForcaSenha(password);

      strengthFill.className = `strength-fill ${strength.level}`;
      strengthText.className = `strength-text ${strength.level}`;
      strengthText.textContent = strength.text;

      // Verificar correspondência
      if (confirmInput.value) {
        validarCorrespondencia();
      }
    });
  }

  // Verificar correspondência
  if (confirmInput) {
    confirmInput.addEventListener('input', validarCorrespondencia);
  }

  function validarCorrespondencia() {
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (confirm && password !== confirm) {
      confirmInput.classList.add('error');
      matchError.classList.add('show');
      return false;
    } else {
      confirmInput.classList.remove('error');
      matchError.classList.remove('show');
      return true;
    }
  }
}

/* ============================= */
/* CALCULAR FORÇA DA SENHA       */
/* ============================= */
function calcularForcaSenha(password) {
  if (!password) {
    return { level: '', text: 'Digite uma senha' };
  }

  let score = 0;

  // Critérios
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) {
    return { level: 'weak', text: 'Senha fraca' };
  } else if (score <= 4) {
    return { level: 'medium', text: 'Senha média' };
  } else {
    return { level: 'strong', text: 'Senha forte' };
  }
}

/* ============================= */
/* COMPLETAR CADASTRO            */
/* ============================= */
async function completarCadastro(inviteId, inviteData) {
  const { auth, db, fStore, fAuth } = window.FirebaseApp;
  const { doc, setDoc, deleteDoc } = fStore;
  const { createUserWithEmailAndPassword } = fAuth;

  const password = document.getElementById('userPassword').value;
  const confirmPassword = document.getElementById('userPasswordConfirm').value;
  const acceptTerms = document.getElementById('acceptTerms').checked;

  const btnSubmit = document.getElementById('btnFinalizarCadastro');
  const loadingInline = document.getElementById('loadingInline');

  // Validações
  if (!password || password.length < 6) {
    alert('A senha deve ter no mínimo 6 caracteres.');
    return;
  }

  if (password !== confirmPassword) {
    alert('As senhas não coincidem.');
    return;
  }

  if (!acceptTerms) {
    alert('Você deve aceitar os termos de uso.');
    return;
  }

  // UI Feedback
  btnSubmit.disabled = true;
  loadingInline.classList.remove('hidden');

  try {
    // 1. Criar usuário no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      inviteData.email,
      password
    );

      const uid = userCredential.user.uid;
      console.log('✅ Usuário criado no Auth:', uid);

      // 2. Salvar perfil completo no Firestore
      await setDoc(doc(db, "users", uid), {
          uid: uid,
          name: inviteData.name,
          email: inviteData.email,
          username: inviteData.email.split('@')[0],
          role: inviteData.role,
          roleLevel: inviteData.roleLevel,
          customPermissions: inviteData.customPermissions || [],
          invitedBy: inviteData.invitedBy,
          active: true,
          status: "ativo",
          createdAt: inviteData.createdAt,
          activatedAt: new Date().toISOString()
      });

        console.log('✅ Perfil salvo no Firestore');

    // 3. Deletar convite usado
    await deleteDoc(doc(db, "invites", inviteId));
    console.log('✅ Convite deletado');

    // 4. Sucesso!
    mostrarSucesso();

  } catch (error) {
    console.error('❌ Erro ao completar cadastro:', error);
    
    let errorMessage = 'Erro ao criar conta. ';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage += 'Este e-mail já está em uso.';
        break;
      case 'auth/weak-password':
        errorMessage += 'Senha muito fraca.';
        break;
      case 'auth/network-request-failed':
        errorMessage += 'Erro de conexão. Verifique sua internet.';
        break;
      default:
        errorMessage += error.message;
    }

    alert(errorMessage);

    // Resetar UI
    btnSubmit.disabled = false;
    loadingInline.classList.add('hidden');
  }
}

/* ============================= */
/* MOSTRAR SUCESSO               */
/* ============================= */
function mostrarSucesso() {
  const registroForm = document.getElementById('registroForm');
  
  registroForm.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #e6f6ea; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <i class="fi fi-rr-check-circle" style="font-size: 48px; color: var(--color-success);"></i>
      </div>
      <h2 style="font-size: 24px; margin-bottom: 10px; color: var(--color-text);">
        ✅ Conta Ativada com Sucesso!
      </h2>
      <p style="color: #666; margin-bottom: 25px; font-size: 15px;">
        Sua conta foi criada e você já pode fazer login no sistema.
      </p>
      <button class="btn btn-primary" onclick="window.location.href='login.html'">
        <i class="fi fi-rr-arrow-right"></i>
        Ir para o Login
      </button>
    </div>
  `;

  // Redirecionar automaticamente após 3 segundos
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 3000);
}

/* ============================= */
/* MOSTRAR ERRO                  */
/* ============================= */
function mostrarErro(mensagem) {
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');

  loadingState.classList.add('hidden');
  errorMessage.textContent = mensagem;
  errorState.classList.remove('hidden');
}

console.log('✅ Registro.js carregado');