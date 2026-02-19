/**
 * ATENDIMENTO RESTORATION MANAGER
 * 
 * Responsável por:
 * ✅ Restaurar atendimento ativo com segurança
 * ✅ Firestore como fonte de verdade
 * ✅ localStorage apenas como cache de UX
 * ✅ Validar posse do atendimento
 * ✅ Suportar múltiplos operadores
 * 
 * FLUXO DE RESTAURAÇÃO:
 * 1. 🔹 Buscar no Firestore: status='em_atendimento' + atribuido_para_uid=operador.uid
 * 2. 🔹 Se não encontrar: verificar localStorage como fallback
 * 3. 🔹 Se tem no localStorage: validar se ainda pertence ao operador
 * 4. 🔹 Se válido: recuperar UI
 * 5. 🔹 Se inválido: limpar e descartar
 */

class AtendimentoRestorationManager {
  constructor() {
    this.db = window.FirebaseApp?.db;
    this.fStore = window.FirebaseApp?.fStore;
    this.auth = window.FirebaseApp?.auth;

    // Estado
    this.atendimentoRestaurado = null;
  }

  /**
   * ========================================================
   * RESTAURAR ATENDIMENTO AO CARREGAR PÁ GINA
   * ========================================================
   * Chamada única quando o operador carrega a página
   * (ex: no init do atendimento.module.js ou atendimento.js)
   */
  async restaurarSessao() {
    console.log('🔄 Iniciando restauração de sessão...');

    // 1. Validar autenticação
    if (!this.auth?.currentUser) {
      console.log('ℹ️ Operador não autenticado ainda, aguardando...');
      
      // Aguardar autenticação
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.auth?.currentUser) {
            clearInterval(check);
            console.log('✅ Autenticação carregada');
            this.restaurarSessao().then(resolve);
          }
        }, 200);

        // Timeout de 30 segundos
        setTimeout(() => {
          clearInterval(check);
          console.warn('⚠️ Timeout esperando autenticação');
          resolve(null);
        }, 30000);
      });
    }

    const operadorUid = this.auth.currentUser.uid;
    console.log(`🔑 UID do operador: ${operadorUid}`);

    try {
      // 2. ETAPA 1: Buscar no Firestore (fonte de verdade)
      console.log('📊 Buscando no Firestore...');
      const atendimentoFS = await this.buscarNoFirestore(operadorUid);

      if (atendimentoFS) {
        console.log(`✅ Encontrado no Firestore: ${atendimentoFS.id}`);
        this.atendimentoRestaurado = atendimentoFS;
        return atendimentoFS;
      }

      // 3. ETAPA 2: Fallback para localStorage (apenas cache de UX)
      console.log('💾 Buscando em localStorage como fallback...');
      const atendimentoLS = await this.validarFallbackLocalStorage(operadorUid);

      if (atendimentoLS) {
        console.log(`✅ Recuperado de localStorage: ${atendimentoLS.id}`);
        this.atendimentoRestaurado = atendimentoLS;
        return atendimentoLS;
      }

      // 4. Nenhum atendimento ativo
      console.log('ℹ️ Nenhum atendimento ativo para restaurar');
      return null;

    } catch (error) {
      console.error('❌ Erro durante restauração:', error);
      return null;
    }
  }

  /**
   * ========================================================
   * ETAPA 1: BUSCAR NO FIRESTORE
   * ========================================================
   * Fonte de verdade: Firestore decide se tem atendimento ativo
   */
  async buscarNoFirestore(operadorUid) {
    try {
      const { collection, query, where, getDocs, limit } = this.fStore;

      // Query: Buscar TODOS os atendimentos em_atendimento deste operador
      const q = query(
        collection(this.db, 'atend_chat_fila'),
        where('status', '==', 'EM_ATENDIMENTO'),
        where('atribuido_para_uid', '==', operadorUid),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('📭 Nenhum atendimento ativo no Firestore');
        return null;
      }

      // Retornar primeiro (e único) resultado
      const doc = snapshot.docs[0];
      const data = doc.data();

      console.log(`✅ Atendimento validado:
        ID: ${doc.id}
        Status: ${data.status}
        Operador UID: ${data.atribuido_para_uid}
        Canal: ${data.canal}
      `);

      return {
        id: doc.id,
        data,
        fonte: 'firestore'
      };

    } catch (error) {
      console.error('⚠️ Erro ao buscar no Firestore:', error);
      // Não lançar erro, apenas retornar null
      return null;
    }
  }

  /**
   * ========================================================
   * ETAPA 2: VALIDAR FALLBACK LOCALSTORAGE
   * ========================================================
   * localStorage é APENAS cache para salvar UX
   * SEMPRE validar no Firestore antes de usar
   */
  async validarFallbackLocalStorage(operadorUid) {
    try {
      // 1. Buscar no localStorage
      const cached = sessionStorage.getItem('atendimento_ativo_whatsapp');
      
      if (!cached) {
        console.log('💾 Nada em localStorage');
        return null;
      }

      let cachedData;
      try {
        cachedData = JSON.parse(cached);
      } catch (e) {
        console.warn('⚠️ localStorage corrompido, descartando');
        sessionStorage.removeItem('atendimento_ativo_whatsapp');
        return null;
      }

      const cachedId = cachedData?.atendimentoId;

      if (!cachedId) {
        console.warn('⚠️ ID inválido em localStorage');
        sessionStorage.removeItem('atendimento_ativo_whatsapp');
        return null;
      }

      console.log(`💾 Cache encontrado: ${cachedId}, validando no Firestore...`);

      // 2. VALIDAR no Firestore antes de usar
      const { doc, getDoc } = this.fStore;
      const docRef = doc(this.db, 'atend_chat_fila', cachedId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn(`⚠️ ${cachedId} não existe mais no Firestore`);
        sessionStorage.removeItem('atendimento_ativo_whatsapp');
        return null;
      }

      const docData = docSnap.data();

      // 3. Validar posse
      if (docData.atribuido_para_uid !== operadorUid) {
        console.warn(`⚠️ ${cachedId} não pertence a este operador`);
        console.warn(`   Cache diz: ${operadorUid}, Firestore diz: ${docData.atribuido_para_uid}`);
        sessionStorage.removeItem('atendimento_ativo_whatsapp');
        return null;
      }

      // 4. Validar status
      if (docData.status !== 'em_atendimento') {
        console.warn(`⚠️ ${cachedId} mudou de status: ${docData.status}`);
        sessionStorage.removeItem('atendimento_ativo_whatsapp');
        return null;
      }

      console.log(`✅ Cache validado no Firestore, usando...`);

      return {
        id: cachedId,
        data: docData,
        fonte: 'localStorage_validado'
      };

    } catch (error) {
      console.error('⚠️ Erro ao validar fallback:', error);
      sessionStorage.removeItem('atendimento_ativo_whatsapp');
      return null;
    }
  }

  /**
   * ========================================================
   * VALIDAR ATENDIMENTO ESPECÍFICO
   * ========================================================
   * Para quando você já tem um ID e quer validar
   * (ex: ao clicar em "restaurar este atendimento")
   */
  async validarAtendimento(atendimentoId, operadorUid) {
    try {
      const { doc, getDoc } = this.fStore;
      const docRef = doc(this.db, 'atend_chat_fila', atendimentoId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          valido: false,
          erro: 'Atendimento não encontrado'
        };
      }

      const data = docSnap.data();

      // Verificar posse
      if (data.atribuido_para_uid !== operadorUid) {
        return {
          valido: false,
          erro: 'Este atendimento não é seu'
        };
      }

      // Verificar status
      if (data.status !== 'em_atendimento') {
        return {
          valido: false,
          erro: `Atendimento não está ativo (${data.status})`
        };
      }

      return {
        valido: true,
        atendimentoId,
        data
      };

    } catch (error) {
      console.error('⚠️ Erro ao validar:', error);
      return {
        valido: false,
        erro: 'Erro ao validar atendimento'
      };
    }
  }

  /**
   * ========================================================
   * OBTER ATENDIMENTO RESTAURADO
   * ========================================================
   */
  obterRestaurado() {
    return this.atendimentoRestaurado;
  }

  /**
   * ========================================================
   * LIMPAR CACHE LOCAL
   * ========================================================
   */
  limparCache() {
    sessionStorage.removeItem('atendimento_ativo_whatsapp');
    this.atendimentoRestaurado = null;
    console.log('🧹 Cache local limpo');
  }
}

// Exportar como global
window.AtendimentoRestorationManager = new AtendimentoRestorationManager();

console.log('✅ AtendimentoRestorationManager carregado (Firestore-first)');