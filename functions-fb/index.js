const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

const PESOS = {
  DIAMANTE: 1,
  OURO: 2,
  PRATA: 3,
  PADRAO: 4
};

// ============================================================
// AUXILIAR: Consulta geral_configs_vip/lista e retorna
// a classe do cliente pelo email
// ============================================================
async function classificarClientePorEmail(email) {
  if (!email) return { classe: 'PADRAO', peso: 4 };

  try {
    const vipDoc = await db.doc('geral_configs_vip/lista').get();

    if (!vipDoc.exists) {
      console.warn('⚠️ geral_configs_vip/lista não encontrado');
      return { classe: 'PADRAO', peso: 4 };
    }

    const listas = vipDoc.data();
    const emailLower = email.toLowerCase().trim();

    const classes = ['diamante', 'ouro', 'prata'];
    for (const classe of classes) {
      const lista = listas[classe] || [];
      const encontrado = lista.some(e => e.toLowerCase().trim() === emailLower);

      if (encontrado) {
        const classeUpper = classe.toUpperCase();
        console.log(`✅ Cliente ${email} classificado como ${classeUpper}`);
        return { classe: classeUpper, peso: PESOS[classeUpper] };
      }
    }

    return { classe: 'PADRAO', peso: 4 };

  } catch (error) {
    console.error('❌ Erro ao classificar cliente:', error);
    return { classe: 'PADRAO', peso: 4 };
  }
}

// ============================================================
// AUXILIAR: Atualiza fila_controle/status com contagens reais
// ============================================================
async function atualizarContadorFila() {
  const snapshot = await db.collection('atend_chat_fila')
    .where('status', '==', 'FILA')
    .orderBy('prioridade_peso', 'asc')
    .orderBy('criadoEm', 'asc')
    .get();

  const porPrioridade = { DIAMANTE: 3, OURO: 2, PRATA: 1, PADRAO: 0 };

  // Atribuir posição a cada cliente na fila
  const batch = db.batch();
  let posicao = 1;

  snapshot.forEach((doc) => {
    const classe = doc.data().classe_cliente || 'PADRAO';
    if (porPrioridade[classe] !== undefined) porPrioridade[classe]++;

    // Salva posição individual no documento do cliente
    batch.update(doc.ref, { posicao_fila: posicao });
    posicao++;
  });

  await batch.commit();

  // Atualiza o contador geral
  await db.doc('fila_controle/status').set({
    total_na_fila: snapshot.size,
    por_prioridade: porPrioridade,
    atualizado_em: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`📊 Fila: ${snapshot.size} total | Posições atualizadas`);
}

// ============================================================
// TRIGGER PRINCIPAL — v2
// ============================================================
exports.processarAtendimentoFila = onDocumentWritten(
  'atend_chat_fila/{atendimentoId}',
  async (event) => {
    const atendimentoId = event.params.atendimentoId;

    // Documento deletado — só atualiza contador
    if (!event.data.after.exists) {
      await atualizarContadorFila();
      return;
    }

    const dadosNovos = event.data.after.data();
    const dadosAntigos = event.data.before.exists
      ? event.data.before.data()
      : null;

    // ── CASO 1: Documento recém criado em FILA ──────────────
    if (!dadosAntigos && dadosNovos.status === 'FILA') {
      const email = dadosNovos.cliente?.email || null;
      const { classe, peso } = await classificarClientePorEmail(email);

      await db.doc(`atend_chat_fila/${atendimentoId}`).update({
        classe_cliente: classe,
        prioridade_peso: peso,
        classificado_em: admin.firestore.FieldValue.serverTimestamp()
      });

      return;
    }

    // ── CASO 2: Documento atualizado ────────────────────────
    const statusMudou = dadosAntigos?.status !== dadosNovos?.status;
    const classeMudou = dadosAntigos?.classe_cliente !== dadosNovos?.classe_cliente;

    if (statusMudou || classeMudou) {
      await atualizarContadorFila();
    }
  }
);