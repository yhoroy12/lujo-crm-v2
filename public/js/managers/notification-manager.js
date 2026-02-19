/**
 * NotificationManager — Lujo Network CRM
 * Integrado ao Firestore com suporte a UID, Setor (Role), Global e Link de Navegação.
 *
 * MUDANÇAS em relação à versão anterior:
 *  - send() agora aceita o campo `link` e o persiste no Firestore.
 *  - renderList() renderiza notificações clicáveis que navegam via link.
 *  - markAsRead() também executa a navegação quando a notificação tem link.
 */
const NotificationManager = {
    notifications: [],
    badge: null,
    panel: null,
    btn: null,
    unsubscribe: null,

    init() {
        this.badge = document.querySelector('.notification-badge');
        this.btn = document.getElementById('btnNotifications');

        if (!this.btn) {
            console.error("🔔 NotificationManager: Botão #btnNotifications não encontrado.");
            return;
        }

        this.createPanel();
        this.bindEvents();
        console.log("🔔 NotificationManager: Sistema de UI Pronto");
    },

    createPanel() {
        if (document.getElementById('notifPanel')) return;

        const html = `
            <div id="notifPanel" class="notifications-panel">
                <div class="notif-header">
                    <h3>Notificações</h3>
                    <button id="notifMarkAll" style="font-size: 11px; cursor:pointer; border:none; background:none; color:var(--color-primary, #007bff);">Marcar todas como lidas</button>
                </div>
                <div class="notif-list" id="notifList"></div>
                <div style="padding: 10px; text-align: center; border-top: 1px solid #eee;">
                    <small style="color: #888; cursor: pointer;">Ver histórico completo</small>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.panel = document.getElementById('notifPanel');
    },

    bindEvents() {
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.panel.classList.toggle('active');
            this.renderList();
        });

        document.addEventListener('click', (e) => {
            if (this.panel && !this.panel.contains(e.target)) {
                this.panel.classList.remove('active');
            }
        });

        document.getElementById('notifMarkAll').addEventListener('click', (e) => {
            e.stopPropagation();
            this.markAllAsRead();
        });
    },

    async listenToNotifications(userData) {
        if (this.unsubscribe) this.unsubscribe();
        const { db, fStore } = window.FirebaseApp;
        const { query, collection, where, orderBy, limit, onSnapshot } = fStore;

        if (!db) return;

        let rolesToFilter = Array.isArray(userData.role) ? userData.role : [userData.role];
        if (!rolesToFilter.includes("todos")) rolesToFilter.push("todos");
        if (!rolesToFilter.includes(null)) rolesToFilter.push(null);
        rolesToFilter = rolesToFilter.slice(0, 10);

        console.log("📡 Query Roles:", rolesToFilter);

        const q = query(
            collection(db, "geral_notifications"),
            where("role", "in", rolesToFilter),
            orderBy("createdAt", "desc"),
            limit(30)
        );

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.notifications = allNotifs.filter(n => {
                const matchRole = rolesToFilter.includes(n.role);
                const matchUser = n.userId === userData.uid;
                return matchRole || matchUser;
            });

            console.log(`🔔 Notificações atualizadas: ${this.notifications.length} encontradas.`);
            this.updateBadge();
            if (this.panel && this.panel.classList.contains('active')) {
                this.renderList();
            }
        }, (error) => {
            console.error("🔔 Erro no Snapshot:", error);
        });
    },

    updateBadge() {
        const count = this.notifications.filter(n => !n.read).length;
        if (this.badge) {
            this.badge.textContent = count > 99 ? '99+' : count;
            this.badge.style.display = count > 0 ? 'flex' : 'none';
        }
    },

    renderList() {
        const listContainer = document.getElementById('notifList');
        if (!listContainer) return;

        if (this.notifications.length === 0) {
            listContainer.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999; font-size:12px;">Tudo limpo por aqui!</div>';
            return;
        }

        listContainer.innerHTML = this.notifications.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'} ${n.link ? 'has-link' : ''}"
                 data-id="${n.id}"
                 data-link="${n.link || ''}"
                 style="${n.link ? 'cursor:pointer;' : ''}">
                <div class="notif-icon notif-${n.type || 'info'}">
                    <i class="fi fi-rr-${this.getIcon(n.type)}"></i>
                </div>
                <div class="notif-content">
                    <span class="title">${n.title}</span>
                    <span class="desc">${n.message}</span>
                    ${n.link ? `<span class="notif-link-hint" style="font-size:10px;color:var(--color-primary,#007bff);margin-top:3px;display:block;">
                        <i class="fi fi-rr-link"></i> Abrir demanda
                    </span>` : ''}
                    <span class="time">${this.formatTime(n.createdAt)}</span>
                </div>
            </div>
        `).join('');

        // Evento de clique: marca como lida e navega se houver link
        listContainer.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', () => {
                const link = item.dataset.link;
                this.markAsRead(item.dataset.id);
                if (link) {
                    this.panel.classList.remove('active');
                    // Navega pelo sistema — ajuste para o roteador do seu app se necessário
                    window.location.hash = link;
                }
            });
        });
    },

    getIcon(type) {
        const icons = { success: 'check', error: 'cross-circle', info: 'info', warning: 'exclamation' };
        return icons[type] || 'bell';
    },

    async markAsRead(docId) {
        const { db, fStore } = window.FirebaseApp;
        const { doc, updateDoc } = fStore;
        try {
            const notifRef = doc(db, "geral_notifications", docId);
            await updateDoc(notifRef, { read: true });
        } catch (e) {
            console.error("Erro ao marcar como lida:", e);
        }
    },

    async markAllAsRead() {
        const unread = this.notifications.filter(n => !n.read);
        for (const n of unread) {
            await this.markAsRead(n.id);
        }
    },

    formatTime(timestamp) {
        if (!timestamp) return 'Agora';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    /**
     * Envia uma notificação para o Firestore.
     *
     * @param {Object} data
     * @param {string}  [data.targetId]    UID do destinatário específico (privada)
     * @param {string}  [data.targetRole]  Role/Setor destino (ex: 'atendimento', 'GERENTE', 'todos')
     * @param {string}  data.title         Título da notificação
     * @param {string}  data.message       Corpo da mensagem
     * @param {string}  [data.type]        'info' | 'warning' | 'error' | 'success'
     * @param {string}  [data.link]        Hash de rota para navegar ao clicar (ex: '#atendimento/demandas/minhas?id=XXX')
     */
    async send(data) {
        const { db, fStore } = window.FirebaseApp;
        const { collection, addDoc, serverTimestamp } = fStore;

        try {
            const notifData = {
                title: data.title || 'Solicitação de Atualização',
                message: data.message || '',
                type: data.type || 'info',
                read: false,
                createdAt: serverTimestamp(),
                userId: data.targetId || null,
                role: data.targetRole || null,
                // NOVO: Link opcional para navegação direta ao clicar na notificação
                link: data.link || null
            };

            const docRef = await addDoc(collection(db, "geral_notifications"), notifData);
            console.log("🔔 Notificação enviada com ID:", docRef.id);
            return true;
        } catch (error) {
            console.error("❌ Erro ao enviar notificação:", error);
            return false;
        }
    },
};

window.NotificationManager = NotificationManager;
document.addEventListener('DOMContentLoaded', () => NotificationManager.init());