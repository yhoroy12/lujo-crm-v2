// ==================== EMAIL.SERVICE.JS ====================
// Service de E-mails - Gerencia toda lógica de negócio de e-mails
// Responsável por: Transações Firestore, Fila, Histórico, Validações

/**
 * Configuração de transações Firestore
 * Garante operações atômicas e retry automático em caso de falha
 */
const TRANSACTION_CONFIG = {
    maxAttempts: 3,
    retryDelay: 300,
    timeoutMs: 5000
};

/**
 * Respostas padrão para facilitar atendimento
 */
const RESPOSTAS_PADROES = [
    { titulo: "Boas-vindas", texto: "Olá! Recebemos sua mensagem e nossa equipe já está analisando. Em breve retornaremos." },
    { titulo: "Financeiro - Boleto", texto: "Verificamos seu pagamento e ele já foi identificado em nosso sistema." },
    { titulo: "Solicitar Print", texto: "Poderia nos enviar um print da tela onde o erro ocorre para analisarmos?" }
];

// ===== SEÇÃO 1: TRANSAÇÕES FIRESTORE =====

/**
 * Executa uma transação Firestore com retry automático
 * Previne race conditions em operações concorrentes
 * 
 * @param {Function} transactionFn - Função da transação a executar
 * @param {Object} options - Opções de configuração
 * @returns {Promise} Resultado da transação
 */
async function executeTransaction(transactionFn, options = {}) {
    const config = { ...TRANSACTION_CONFIG, ...options };
    let lastError;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            console.log(`🔄 Tentativa ${attempt}/${config.maxAttempts}`);

            const result = await Promise.race([
                transactionFn(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Transaction timeout')), config.timeoutMs)
                )
            ]);

            console.log('✅ Transação concluída com sucesso');
            return result;

        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Tentativa ${attempt} falhou:`, error.message);

            if (attempt === config.maxAttempts) break;
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
    }

    throw new Error(`Transação falhou após ${config.maxAttempts} tentativas: ${lastError.message}`);
}

// ===== SEÇÃO 2: GERENCIAMENTO DE FILA =====

/**
 * Configura listener em tempo real para fila de e-mails
 * Atualiza UI automaticamente quando novos e-mails chegam
 * 
 * @param {string} userUID - ID do usuário
 * @param {Array} userSetor - Setores do usuário
 * @param {Function} onUpdate - Callback quando fila atualiza
 */
function setupFilaListener(userUID, userSetor, onUpdate) {
    const { db, fStore } = window.FirebaseApp;

    if (!Array.isArray(userSetor) || userSetor.length === 0) {
        console.warn("⚠️ Setor do usuário ainda não carregado (deve ser array)");
        return null;
    }

    try {
        const setoresFiltro = Array.isArray(userSetor) ? userSetor : [userSetor];
        const qFila = fStore.query(
            fStore.collection(db, "atend_emails_fila"),
            fStore.where("status", "==", "novo"),
            fStore.where("grupo", "in", setoresFiltro),
            fStore.orderBy("metadata_recebido_em", "asc"),
            fStore.limit(20)
        );

        return fStore.onSnapshot(qFila, (snap) => {
            console.log("📊 Fila atualizada:", snap.size, "e-mails");

            const emails = [];
            snap.forEach(doc => {
                emails.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            if (onUpdate) onUpdate(emails);

        }, (error) => {
            console.error("❌ Erro no Listener da Fila:", error);
            if (error.code === 'failed-precondition') {
                console.error("🔗 Índice necessário:", error.message);
            }
            if (error.code === 'permission-denied') {
                showToast("Erro de permissão. Contate o administrador.", 'error');
            }
        });

    } catch (error) {
        console.error("❌ Erro ao configurar listener:", error);
        return null;
    }
}

/**
 * Configura listener para atendimento ativo
 * Recupera e-mail em atendimento caso página seja recarregada
 * 
 * @param {string} userUID - ID do usuário
 * @param {Function} onResumo - Callback quando encontrar atendimento ativo
 */
function setupAtendimentoAtivoListener(userUID, onResumo) {
    const { db, fStore } = window.FirebaseApp;

    try {
        const qAtivo = fStore.query(
            fStore.collection(db, "atend_emails_atribuido"),
            fStore.where("atribuido_para_uid", "==", userUID),
            fStore.where("status", "==", "em_atendimento"),
            fStore.limit(1)
        );

        return fStore.onSnapshot(qAtivo, (snap) => {
            if (!snap.empty) {
                const docAtivo = snap.docs[0];
                const dados = docAtivo.data();

                console.log("📌 Atendimento ativo recuperado:", docAtivo.id);

                if (onResumo) {
                    onResumo({
                        id: docAtivo.id,
                        ...dados
                    });
                }
            }
        }, (error) => {
            console.error("❌ Erro na Retomada:", error);
            if (error.code === 'failed-precondition') {
                console.error("🔗 Crie o índice:", error.message);
            }
        });

    } catch (error) {
        console.error("❌ Erro ao configurar listener de retomada:", error);
        return null;
    }
}

// ===== SEÇÃO 3: PUXAR E-MAIL DA FILA =====

/**
 * Puxa o próximo e-mail da fila com transação atômica
 * Previne race conditions com múltiplos operadores
 * Garante que apenas um operador pegue um e-mail
 * 
 * @returns {Promise<Object|null>} Dados do e-mail atribuído ou null
 */
async function puxarProximoEmail() {
    const { db, fStore, auth } = window.FirebaseApp;
    const currentUser = auth.currentUser;

    if (!currentUser) {
        showToast("Erro: Usuário não autenticado.", 'error');
        return null;
    }

    const operadorUID = currentUser.uid;
    const agora = new Date();

    try {
        // Buscar candidatos fora da transação (melhora performance)
        const q = fStore.query(
            fStore.collection(db, "atend_emails_fila"),
            fStore.where("status", "==", "novo"),
            fStore.orderBy("metadata_recebido_em", "asc"),
            fStore.limit(5)
        );

        const querySnapshot = await fStore.getDocs(q);

        if (querySnapshot.empty) {
            showToast("Nenhum e-mail disponível na fila.", 'info');
            return null;
        }

        let emailAtribuido = null;

        // Tentar pegar o primeiro e-mail disponível
        for (const docCandidate of querySnapshot.docs) {
            try {
                emailAtribuido = await executeTransaction(async () => {
                    return await fStore.runTransaction(db, async (transaction) => {
                        const docRef = fStore.doc(db, "atend_emails_fila", docCandidate.id);
                        const freshDoc = await transaction.get(docRef);

                        // Validação 1: Documento existe?
                        if (!freshDoc.exists()) {
                            throw new Error('EMAIL_NAO_EXISTE');
                        }

                        const dados = freshDoc.data();

                        // Validação 2: Ainda está disponível?
                        if (dados.status !== "novo") {
                            throw new Error('EMAIL_JA_ATRIBUIDO');
                        }

                        // Criar evento de histórico
                        const eventoPosse = {
                            timestamp: agora,
                            acao: "puxou_fila",
                            operador_uid: operadorUID,
                            setor: dados.grupo || "triagem"
                        };

                        // Preparar updates
                        const updates = {
                            status: "em_atendimento",
                            atribuido_para_uid: operadorUID,
                            puxado_em: agora,
                            historico_custodia: fStore.arrayUnion(eventoPosse),
                            versao_documento: (dados.versao_documento || 0) + 1
                        };

                        // Atualizar marcos de rastreio
                        if (!dados.tracking_marcos?.triagem_inicio) {
                            updates["tracking_marcos.triagem_inicio"] = agora;
                        }

                        // TRANSAÇÃO ATÔMICA: Mover de Fila para Atribuído
                        const novoDocRef = fStore.doc(db, "atend_emails_atribuido", docCandidate.id);
                        const dadosCompletos = { ...dados, ...updates };

                        transaction.set(novoDocRef, dadosCompletos);
                        transaction.delete(docRef);

                        return {
                            id: docCandidate.id,
                            dados: dadosCompletos
                        };
                    });
                }, { maxAttempts: 2, retryDelay: 200 });

                break; // Conseguiu atribuir, sair do loop

            } catch (error) {
                console.warn(`⚠️ Candidato ${docCandidate.id} não disponível:`, error.message);
                continue; // Tentar próximo
            }
        }

        // Validar resultado
        if (!emailAtribuido) {
            showToast("Todos os e-mails foram atribuídos. Tente novamente.", 'warning');
            return null;
        }

        showToast("✓ E-mail atribuído com sucesso!", 'success');
        return emailAtribuido;

    } catch (error) {
        console.error("❌ Erro crítico ao puxar e-mail:", error);
        showToast("Erro ao processar solicitação. Tente novamente.", 'error');
        return null;
    }
}

// ===== SEÇÃO 4: FINALIZAR ATENDIMENTO =====

/**
 * Finaliza o atendimento de um e-mail
 * Salva resposta no histórico e remove de atribuído
 * Usa transação para garantir consistência
 * 
 * @param {string} emailId - ID do e-mail
 * @param {string} resposta - Texto da resposta
 * @returns {Promise<boolean>} Sucesso ou falha
 */
async function finalizarAtendimento(emailId, resposta) {
    const { db, fStore, auth } = window.FirebaseApp;
    const currentUser = auth.currentUser;
    const agora = new Date();

    if (!resposta?.trim()) {
        showToast("Por favor, escreva uma resposta.", 'warning');
        return false;
    }

    if (!emailId) {
        showToast("Erro: ID do e-mail não encontrado.", 'error');
        return false;
    }

    const operadorUID = currentUser?.uid;

    try {
        const resultado = await executeTransaction(async () => {
            return await fStore.runTransaction(db, async (transaction) => {
                const docRef = fStore.doc(db, "atend_emails_atribuido", emailId);
                const docSnap = await transaction.get(docRef);

                // Validação 1: Documento existe?
                if (!docSnap.exists()) {
                    throw new Error('DOCUMENTO_NAO_ENCONTRADO');
                }

                const dados = docSnap.data();

                // Validação 2: É seu?
                if (dados.atribuido_para_uid !== operadorUID) {
                    throw new Error('SEM_PERMISSAO_OWNERSHIP');
                }

                // Validação 3: Status correto?
                if (dados.status !== "em_atendimento") {
                    throw new Error('STATUS_INVALIDO');
                }

                // Calcular tempo de retenção
                const tempoRetencaoMs = dados.puxado_em
                    ? agora.getTime() - dados.puxado_em.toDate().getTime()
                    : 0;

                // Criar evento final
                const eventoFinal = {
                    timestamp: agora,
                    acao: "finalizou",
                    operador_uid: operadorUID,
                    setor: dados.grupo || "atendimento",
                    tempo_retencao_ms: tempoRetencaoMs,
                    resposta_corpo: resposta
                };

                // Preparar dossiê para histórico
                const payloadHistorico = {
                    ...dados,
                    status: 'finalizado',
                    resposta_enviada: resposta,
                    operador_finalizador_uid: operadorUID,
                    finalizado_em: agora,
                    tracking_marcos: {
                        ...(dados.tracking_marcos || {}),
                        finalizado_em: agora
                    },
                    historico_custodia: fStore.arrayUnion(eventoFinal),
                    email_enviado: false,
                    versao_documento: (dados.versao_documento || 0) + 1
                };

                // TRANSAÇÃO ATÔMICA: Atribuído → Histórico
                const historicoRef = fStore.doc(db, "atend_emails_historico", emailId);
                transaction.set(historicoRef, payloadHistorico);
                transaction.delete(docRef);

                return { success: true };
            });
        });

        if (resultado.success) {
            showToast("✓ Atendimento finalizado!", 'success');
            return true;
        }

        return false;

    } catch (error) {
        console.error("❌ Erro ao finalizar:", error);

        if (error.message === 'SEM_PERMISSAO_OWNERSHIP') {
            showToast("⚠️ Este atendimento não pertence mais a você.", 'warning');
        } else if (error.message === 'DOCUMENTO_NAO_ENCONTRADO') {
            showToast("⚠️ Este atendimento já foi processado.", 'warning');
        } else {
            showToast("Erro ao processar finalização.", 'error');
        }

        return false;
    }
}

// ===== SEÇÃO 5: DEVOLVER À FILA =====

/**
 * Devolve e-mail à fila com justificativa
 * Remove da atribuído e volta para fila
 * 
 * @param {string} emailId - ID do e-mail
 * @param {string} motivo - Justificativa da devolução
 * @returns {Promise<boolean>} Sucesso ou falha
 */
async function devolverParaFila(emailId, motivo) {
    const { db, fStore, auth } = window.FirebaseApp;
    const userUID = auth.currentUser?.uid;
    const agora = new Date();

    if (!motivo || motivo.length < 10) {
        showToast("Justificativa mínimo 10 caracteres.", 'warning');
        return false;
    }

    if (!emailId) {
        showToast("ID do e-mail não identificado.", 'error');
        return false;
    }

    try {
        const resultado = await executeTransaction(async () => {
            return await fStore.runTransaction(db, async (transaction) => {
                const docRef = fStore.doc(db, "atend_emails_atribuido", emailId);
                const docSnap = await transaction.get(docRef);

                if (!docSnap.exists()) throw new Error('DOCUMENTO_NAO_ENCONTRADO');

                const dados = docSnap.data();

                if (dados.atribuido_para_uid !== userUID) throw new Error('SEM_PERMISSAO_OWNERSHIP');
                if (dados.status !== "em_atendimento") throw new Error('STATUS_INVALIDO');

                const eventoDevolver = {
                    timestamp: agora,
                    acao: "devolveu",
                    operador_uid: userUID,
                    setor: dados.grupo || "triagem",
                    justificativa: motivo
                };

                const dadosAtualizados = {
                    ...dados,
                    status: 'novo',
                    atribuido_para_uid: null,
                    puxado_em: null,
                    motivo_devolucao: motivo,
                    devolvido_uid: userUID,
                    devolvido_em: agora,
                    historico_custodia: fStore.arrayUnion(eventoDevolver),
                    versao_documento: (dados.versao_documento || 0) + 1
                };

                const filaRef = fStore.doc(db, "atend_emails_fila", emailId);
                transaction.set(filaRef, dadosAtualizados);
                transaction.delete(docRef);

                return { success: true };
            });
        });

        if (resultado.success) {
            showToast("✓ E-mail devolvido à fila.", 'success');
            return true;
        }

        return false;

    } catch (error) {
        console.error("❌ Erro na devolução:", error);
        if (error.message === 'SEM_PERMISSAO_OWNERSHIP') {
            showToast("⚠️ Você não pode devolver este e-mail.", 'warning');
        } else {
            showToast("Erro ao devolver.", 'error');
        }
        return false;
    }
}

// ===== SEÇÃO 6: DIRECIONAR PARA OUTRO SETOR =====

/**
 * Direciona e-mail para outro setor
 * Move de atribuído para fila do novo setor
 * 
 * @param {string} emailId - ID do e-mail
 * @param {string} novoSetor - Setor de destino
 * @returns {Promise<boolean>} Sucesso ou falha
 */
async function direcionarParaSetor(emailId, novoSetor) {
    const { db, fStore, auth } = window.FirebaseApp;
    const currentUser = auth.currentUser;
    const agora = new Date();

    if (!emailId) {
        showToast("Nenhum e-mail selecionado.", 'warning');
        return false;
    }

    if (!novoSetor) {
        showToast("Selecione um setor de destino.", 'warning');
        return false;
    }

    try {
        const docAtribuidoRef = fStore.doc(db, "atend_emails_atribuido", emailId);
        const docSnap = await fStore.getDoc(docAtribuidoRef);

        if (!docSnap.exists()) {
            showToast("Documento não encontrado.", 'error');
            return false;
        }

        const dadosAtuais = docSnap.data();
        const tempoRetencaoMs = dadosAtuais.puxado_em
            ? agora.getTime() - dadosAtuais.puxado_em.toDate().getTime()
            : 0;

        const eventoDerivacao = {
            timestamp: agora,
            acao: "derivou",
            operador_uid: currentUser?.uid || "sistema",
            setor_origem: dadosAtuais.grupo || "triagem",
            setor_destino: novoSetor,
            tempo_retencao_ms: tempoRetencaoMs
        };

        const dadosParaFila = {
            ...dadosAtuais,
            grupo: novoSetor,
            status: "novo",
            derivado_por_uid: currentUser?.uid || "sistema",
            derivado_em: agora,
            atribuido_para_uid: null,
            puxado_em: null,
            historico_custodia: fStore.arrayUnion(eventoDerivacao)
        };

        if (dadosAtuais.grupo === "triagem") {
            dadosParaFila["tracking_marcos.triagem_fim"] = agora;
        }

        // Executar movimentação
        await fStore.setDoc(fStore.doc(db, "atend_emails_fila", emailId), dadosParaFila);
        await fStore.deleteDoc(docAtribuidoRef);

        showToast("E-mail direcionado com sucesso.", 'success');
        return true;

    } catch (error) {
        console.error("Erro ao direcionar:", error);
        showToast("Erro ao processar direcionamento.", 'error');
        return false;
    }
}

// ===== SEÇÃO 7: HISTÓRICO DO THREAD =====

/**
 * Carrega histórico de mensagens de um thread
 * Mostra respostas anteriores no mesmo e-mail
 * 
 * @param {string} threadId - ID do thread
 * @returns {Promise<Array>} Lista de mensagens do histórico
 */
async function carregarHistoricoThread(threadId) {
    if (!threadId) return [];

    const { db, fStore } = window.FirebaseApp;

    try {
        const q = fStore.query(
            fStore.collection(db, "atend_emails_historico"),
            fStore.where("threadId", "==", threadId),
            fStore.orderBy("finalizado_em", "asc")
        );

        const querySnapshot = await fStore.getDocs(q);
        const historico = [];

        querySnapshot.forEach(doc => {
            historico.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return historico;

    } catch (error) {
        console.error("❌ Erro ao buscar histórico:", error);
        return [];
    }
}

// ===== SEÇÃO 8: BUSCAR HISTÓRICO GERAL =====

/**
 * Busca e-mails finalizados do histórico
 * Usado na aba de histórico
 * 
 * @param {number} limit - Limite de registros
 * @returns {Promise<Array>} Lista de e-mails do histórico
 */
async function buscarHistoricoGeral(limit = 30) {
    const { db, fStore } = window.FirebaseApp;

    try {
        const q = fStore.query(
            fStore.collection(db, "atend_emails_historico"),
            fStore.orderBy("finalizado_em", "desc"),
            fStore.limit(limit)
        );

        const querySnapshot = await fStore.getDocs(q);
        const historico = [];

        querySnapshot.forEach(doc => {
            historico.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return historico;

    } catch (error) {
        console.error("❌ Erro ao buscar histórico:", error);
        return [];
    }
}

/**
 * Busca detalhes de um e-mail específico do histórico
 * 
 * @param {string} emailId - ID do e-mail
 * @returns {Promise<Object|null>} Dados do e-mail ou null
 */
async function buscarDetalhesHistorico(emailId) {
    const { db, fStore } = window.FirebaseApp;

    try {
        const docRef = fStore.doc(db, "atend_emails_historico", emailId);
        const docSnap = await fStore.getDoc(docRef);

        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        }

        return null;

    } catch (error) {
        console.error("❌ Erro ao buscar detalhes:", error);
        return null;
    }
}

// ===== EXPORTS =====

/**
 * EmailService - Expõe todas as funções públicas
 */
window.EmailService = {
    // Configuração
    RESPOSTAS_PADROES,
    
    // Listeners
    setupFilaListener,
    setupAtendimentoAtivoListener,
    
    // Operações de Fila
    puxarProximoEmail,
    devolverParaFila,
    direcionarParaSetor,
    
    // Operações de Atendimento
    finalizarAtendimento,
    
    // Histórico
    carregarHistoricoThread,
    buscarHistoricoGeral,
    buscarDetalhesHistorico,
    
    // Utilitários
    executeTransaction
};

console.log("✅ email.service.js carregado com sucesso");