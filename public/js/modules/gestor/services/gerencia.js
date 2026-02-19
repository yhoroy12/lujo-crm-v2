// ==================== GERENCIA.JS COMPLETO E ATUALIZADO ====================
(function () {

    // =========================
    // DADOS SIMULADOS
    // =========================
    const MOCK_OPERADORES = {
        atendimento: [
            { id: 'op001', nome: 'Ana Silva', cargo: 'ATENDENTE', email: 'ana@lujo.com', status: 'online', avatar: 'AS', cor: '#e3f2fd', atendimentos: 47, tma: '7:23' },
            { id: 'op002', nome: 'Pedro Costa', cargo: 'ATENDENTE', email: 'pedro@lujo.com', status: 'online', avatar: 'PC', cor: '#e6f6ea', atendimentos: 38, tma: '8:15' },
            { id: 'op003', nome: 'Julia Mendes', cargo: 'SUPERVISOR', email: 'julia@lujo.com', status: 'pausa', avatar: 'JM', cor: '#fff3cd', atendimentos: 31, tma: '6:54' }
        ],
        financeiro: [
            { id: 'op004', nome: 'Carlos Souza', cargo: 'SUPERVISOR', email: 'carlos@lujo.com', status: 'online', avatar: 'CS', cor: '#e3f2fd', atendimentos: 52, tma: '8:45' }
        ],
        conteudo: [
            { id: 'op005', nome: 'Marina Lopes', cargo: 'CONTEUDO', email: 'marina@lujo.com', status: 'pausa', avatar: 'ML', cor: '#e6f6ea', atendimentos: 28, tma: '9:12' }
        ]
    };

    const PERFIS_POR_AREA = {
        atendimento: ['ATENDENTE', 'SUPERVISOR'],
        financeiro: ['SUPERVISOR', 'GERENTE'],
        conteudo: ['CONTEUDO', 'SUPERVISOR'],
        gerencia: ['SUPERVISOR', 'GERENTE']
    };

    // =========================
    // ESTADO GLOBAL DO MÓDULO
    // =========================
    let currentArea = 'atendimento'; // Área do gerente logado
    let selectedOperador = null;
    let selectedPerfil = null;
    let permissoesAlteradas = {};

    // =========================
    // ABAS PRINCIPAIS
    // =========================
    function initAbas() {
        const botoes = document.querySelectorAll(".aba-btn");
        const conteudos = document.querySelectorAll(".aba-conteudo");

        if (!botoes.length || !conteudos.length) return;

        botoes.forEach(btn => {
            btn.addEventListener("click", () => {
                const alvo = btn.dataset.aba;

                botoes.forEach(b => b.classList.remove("ativa"));
                conteudos.forEach(c => c.classList.remove("ativa"));

                btn.classList.add("ativa");

                const conteudoAtivo = document.querySelector("." + alvo);
                if (conteudoAtivo) {
                    conteudoAtivo.classList.add("ativa");
                }
            });
        });
    }

    // =========================
    // SUB-ABAS DO MÓDULO GERÊNCIA
    // =========================
    function initSubAbas() {
        const botoes = document.querySelectorAll(".sub-aba-btn");
        const conteudos = document.querySelectorAll(".sub-aba-conteudo");

        if (!botoes.length || !conteudos.length) return;

        botoes.forEach(btn => {
            btn.addEventListener("click", () => {
                const alvo = btn.dataset.subAba;

                botoes.forEach(b => b.classList.remove("ativa"));
                conteudos.forEach(c => c.classList.remove("ativa"));

                btn.classList.add("ativa");

                const conteudoAtivo = document.querySelector("." + alvo);
                if (conteudoAtivo) {
                    conteudoAtivo.classList.add("ativa");
                    
                    // Inicializar conteúdo específico da aba
                    if (alvo === 'sub-aba-operadores') {
                        initOperadoresTab();
                    } else if (alvo === 'sub-aba-controle') {
                        initControleTab();
                    }
                }
            });
        });
    }

    // =========================
    // PAINEL DE DETALHES DOS PEDIDOS
    // =========================
    function initPainelPedidos() {
        const btnDetalhes = document.querySelectorAll(".btn-detalhes");
        const painel = document.getElementById("painelDetalhes");
        const btnFechar = document.getElementById("fecharDetalhes");

        const dadosFicticios = {
            "0001": {
                cliente: "Ana Silva",
                email: "ana.silva@email.com",
                tipo: "Advanced",
                dataHora: "25/12/2025 14:30",
                status: "Pendente",
                responsavel: "Carlos Souza",
                descricao: "Solicitação de alteração de faixa para lançamento adiantado."
            },
            "0002": {
                cliente: "Marcos Lima",
                email: "marcos.lima@email.com",
                tipo: "Takedown",
                dataHora: "24/12/2025 09:15",
                status: "Pendente",
                responsavel: "Marina Lopes",
                descricao: "Pedido de remoção de conteúdo da plataforma devido a direitos autorais."
            }
        };

        btnDetalhes.forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.pedidoId;
                const info = dadosFicticios[id] || {
                    cliente: "-",
                    email: "-",
                    tipo: "-",
                    dataHora: "-",
                    status: "-",
                    responsavel: "-",
                    descricao: "-"
                };

                document.getElementById("detalhesTitulo").textContent = `Pedido #${id}`;
                document.getElementById("detalhesCliente").textContent = info.cliente;
                document.getElementById("detalhesEmail").textContent = info.email;
                document.getElementById("detalhesTipo").textContent = info.tipo;
                document.getElementById("detalhesDataHora").textContent = info.dataHora;
                document.getElementById("detalhesStatus").textContent = info.status;
                document.getElementById("detalhesResponsavel").textContent = info.responsavel;
                document.getElementById("detalhesDescricao").textContent = info.descricao;

                painel.style.display = "block";
            });
        });

        if (btnFechar) {
            btnFechar.addEventListener("click", () => {
                painel.style.display = "none";
            });
        }

        if (painel) {
            painel.style.display = "none";
        }
    }

    // =========================
    // ABA OPERADORES
    // =========================
    function initOperadoresTab() {
        const listaContainer = document.getElementById('listaOperadores');
        const detalhesContainer = document.getElementById('operadorDetalhes');
        
        if (!listaContainer || !detalhesContainer) return;

        // Determinar área do gerente atual
        const user = window.PermissionsSystem?.getCurrentUser();
        if (user) {
            // Lógica simplificada: definir área baseada no cargo
            if (user.role === 'GERENTE') {
                currentArea = 'atendimento'; // Pode ser customizado
            }
        }

        renderListaOperadores(listaContainer);
    }

    function renderListaOperadores(container) {
        const operadores = MOCK_OPERADORES[currentArea] || [];
        
        if (operadores.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum operador encontrado</p>';
            return;
        }

        container.innerHTML = operadores.map(op => `
            <div class="operador-card-mini" data-op-id="${op.id}">
                <div class="operador-info">
                    <div class="operador-avatar" style="background: ${op.cor}; color: #333;">
                        ${op.avatar}
                    </div>
                    <div>
                        <div class="operador-nome">${op.nome}</div>
                        <div class="operador-cargo">${op.cargo}</div>
                    </div>
                </div>
                <div class="operador-status-row">
                    <span class="status-dot ${op.status}"></span>
                    <span>${op.status === 'online' ? 'Online' : op.status === 'pausa' ? 'Em pausa' : 'Offline'}</span>
                </div>
            </div>
        `).join('');

        // Event listeners
        container.querySelectorAll('.operador-card-mini').forEach(card => {
            card.addEventListener('click', () => {
                const opId = card.dataset.opId;
                selecionarOperador(opId);
            });
        });
    }

    function selecionarOperador(opId) {
        // Encontrar operador
        let operador = null;
        for (let area in MOCK_OPERADORES) {
            const found = MOCK_OPERADORES[area].find(op => op.id === opId);
            if (found) {
                operador = found;
                break;
            }
        }

        if (!operador) return;

        selectedOperador = operador;

        // Atualizar UI
        document.querySelectorAll('.operador-card-mini').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-op-id="${opId}"]`)?.classList.add('active');

        renderDetalhesOperador(operador);
    }

    function renderDetalhesOperador(op) {
        const container = document.getElementById('operadorDetalhes');
        if (!container) return;

        const statusBadgeClass = op.status === 'online' ? 'status-online' : 'status-pausa';
        const statusText = op.status === 'online' ? 'Online' : 'Em Pausa';

        container.innerHTML = `
            <div class="detalhes-header">
                <div class="detalhes-perfil">
                    <div class="perfil-avatar-grande" style="background: ${op.cor}; color: #333;">
                        ${op.avatar}
                    </div>
                    <div class="perfil-info">
                        <h2>${op.nome}</h2>
                        <div class="perfil-badges">
                            <span class="badge cargo">${op.cargo}</span>
                            <span class="badge ${statusBadgeClass}">${statusText}</span>
                        </div>
                        <div class="perfil-contatos">
                            <span><i class="fi fi-rr-envelope"></i> ${op.email}</span>
                            <span><i class="fi fi-rr-phone-call"></i> +55 11 9xxxx-xxxx</span>
                        </div>
                    </div>
                </div>

                <div class="metricas-operador">
                    <div class="metrica-card">
                        <div class="metrica-titulo">Atendimentos Hoje</div>
                        <div class="metrica-valor">${op.atendimentos}</div>
                        <div class="metrica-subtitulo">+5 vs ontem</div>
                    </div>
                    <div class="metrica-card">
                        <div class="metrica-titulo">TMA Médio</div>
                        <div class="metrica-valor">${op.tma}</div>
                        <div class="metrica-subtitulo">tempo médio</div>
                    </div>
                    <div class="metrica-card">
                        <div class="metrica-titulo">Taxa Conclusão</div>
                        <div class="metrica-valor">94%</div>
                        <div class="metrica-subtitulo">acima da meta</div>
                    </div>
                    <div class="metrica-card">
                        <div class="metrica-titulo">Satisfação</div>
                        <div class="metrica-valor">4.8</div>
                        <div class="metrica-subtitulo">de 5.0</div>
                    </div>
                </div>
            </div>

            <div class="desempenho-card">
                <h3>Desempenho</h3>
                <div class="desempenho-periodo">
                    <button class="periodo-btn active">Hoje</button>
                    <button class="periodo-btn">7 dias</button>
                    <button class="periodo-btn">30 dias</button>
                </div>
                <div class="grafico-placeholder">
                    <div class="barra-container">
                        <div class="barra primary" style="height: 65%;"></div>
                        <span class="barra-label">Seg</span>
                    </div>
                    <div class="barra-container">
                        <div class="barra primary" style="height: 78%;"></div>
                        <span class="barra-label">Ter</span>
                    </div>
                    <div class="barra-container">
                        <div class="barra primary" style="height: 85%;"></div>
                        <span class="barra-label">Qua</span>
                    </div>
                    <div class="barra-container">
                        <div class="barra primary" style="height: 72%;"></div>
                        <span class="barra-label">Qui</span>
                    </div>
                    <div class="barra-container">
                        <div class="barra primary" style="height: 90%;"></div>
                        <span class="barra-label">Sex</span>
                    </div>
                </div>
            </div>

            <div class="atividades-card">
                <div class="atividades-header">
                    <h3>Atividades Recentes</h3>
                    <button class="btn btn-sm btn-secondary">Ver Todas</button>
                </div>
                <div class="atividades-lista">
                    <div class="atividade-item">
                        <div class="atividade-icon">
                            <i class="fi fi-rr-check"></i>
                        </div>
                        <div class="atividade-content">
                            <div class="atividade-titulo">Atendimento finalizado</div>
                            <div class="atividade-descricao">Cliente: Maria Santos - Ticket #4521</div>
                            <div class="atividade-tempo">há 15 minutos</div>
                        </div>
                    </div>
                    <div class="atividade-item">
                        <div class="atividade-icon">
                            <i class="fi fi-rr-comment-alt"></i>
                        </div>
                        <div class="atividade-content">
                            <div class="atividade-titulo">Novo atendimento iniciado</div>
                            <div class="atividade-descricao">Cliente: João Silva - Dúvida sobre produto</div>
                            <div class="atividade-tempo">há 42 minutos</div>
                        </div>
                    </div>
                    <div class="atividade-item">
                        <div class="atividade-icon">
                            <i class="fi fi-rr-coffee"></i>
                        </div>
                        <div class="atividade-content">
                            <div class="atividade-titulo">Pausa realizada</div>
                            <div class="atividade-descricao">Duração: 15 minutos</div>
                            <div class="atividade-tempo">há 1 hora</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================
    // ABA CONTROLE
    // =========================
    function initControleTab() {
        const container = document.getElementById('controleGrid');
        if (!container) return;

        renderPerfisControle(container);
    }

    function renderPerfisControle(container) {
        const perfisGerenciaveis = PERFIS_POR_AREA[currentArea] || [];
        
        if (!window.PermissionsSystem) {
            container.innerHTML = '<div class="controle-empty"><p>Sistema de permissões não disponível</p></div>';
            return;
        }

        const ROLES = window.PermissionsSystem.ROLES;
        
        container.innerHTML = `
            <div class="perfis-lista">
                ${perfisGerenciaveis.map(roleKey => {
                    const role = ROLES[roleKey];
                    if (!role) return '';
                    
                    const usuarios = contarUsuariosPorRole(roleKey);
                    
                    return `
                        <div class="perfil-card" data-role="${roleKey}">
                            <div class="perfil-card-header">
                                <div>
                                    <div class="perfil-nome">${role.name}</div>
                                    <div class="perfil-descricao">${role.description}</div>
                                </div>
                            </div>
                            <div class="perfil-stats">
                                <div class="perfil-stat">
                                    <strong>${role.permissions.length}</strong> permissões
                                </div>
                                <div class="perfil-stat">
                                    <strong>${usuarios}</strong> usuários
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="edicao-area" id="edicaoArea">
                <div class="empty-state" style="padding: 40px 20px;">
                    <i class="fi fi-rr-shield-check" style="font-size: 48px; color: #ddd; margin-bottom: 15px;"></i>
                    <h3 style="font-size: 18px; margin-bottom: 8px; color: #666;">Selecione um Perfil</h3>
                    <p style="font-size: 14px; color: #999;">Escolha um perfil para gerenciar suas permissões</p>
                </div>
            </div>
        `;

        // Event listeners
        container.querySelectorAll('.perfil-card').forEach(card => {
            card.addEventListener('click', () => {
                const roleKey = card.dataset.role;
                selecionarPerfil(roleKey);
            });
        });
    }

    function selecionarPerfil(roleKey) {
        if (!window.PermissionsSystem) return;

        const ROLES = window.PermissionsSystem.ROLES;
        const PERMISSIONS = window.PermissionsSystem.PERMISSIONS;
        const role = ROLES[roleKey];
        
        if (!role) return;

        selectedPerfil = roleKey;
        permissoesAlteradas = {};

        // Atualizar UI
        document.querySelectorAll('.perfil-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-role="${roleKey}"]`)?.classList.add('active');

        renderEdicaoPerfil(role, PERMISSIONS);
    }

    function renderEdicaoPerfil(role, PERMISSIONS) {
        const container = document.getElementById('edicaoArea');
        if (!container) return;

        // Agrupar permissões por módulo
        const permissoesPorModulo = agruparPermissoesPorModulo(PERMISSIONS, currentArea);

        container.innerHTML = `
            <div class="edicao-header">
                <h3>${role.name}</h3>
                <p>${role.description}</p>
            </div>

            <div class="permissoes-edicao" id="permissoesEdicao">
                ${Object.entries(permissoesPorModulo).map(([modulo, perms]) => `
                    <div class="modulo-permissoes">
                        <div class="modulo-titulo">
                            <i class="fi fi-rr-apps"></i>
                            ${modulo}
                        </div>
                        <div class="permissoes-lista">
                            ${perms.map(perm => {
                                const checked = role.permissions.includes(perm.value) ? 'checked' : '';
                                const disabled = !podeEditarPermissao(perm.value) ? 'disabled' : '';
                                const itemClass = disabled ? 'disabled' : '';
                                
                                return `
                                    <div class="permissao-item ${itemClass}">
                                        <input 
                                            type="checkbox" 
                                            class="permissao-checkbox" 
                                            id="perm_${perm.key}"
                                            value="${perm.value}"
                                            ${checked}
                                            ${disabled}
                                            data-original="${checked ? 'true' : 'false'}"
                                        >
                                        <label class="permissao-label" for="perm_${perm.key}">
                                            ${perm.label}
                                            <span class="permissao-codigo">${perm.value}</span>
                                        </label>
                                        ${disabled ? '<i class="fi fi-rr-lock permissao-lock"></i>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div id="mudancasResumo" style="display: none;" class="mudancas-resumo">
                <h4>Alterações Pendentes</h4>
                <ul class="mudancas-lista" id="mudancasLista"></ul>
            </div>

            <div class="edicao-acoes">
                <button class="btn btn-secondary" onclick="gerenciaModule.cancelarEdicao()">
                    Cancelar
                </button>
                <button class="btn btn-primary" id="btnSalvarPermissoes" disabled>
                    Salvar Alterações
                </button>
            </div>
        `;

        // Event listeners para checkboxes
        container.querySelectorAll('.permissao-checkbox:not([disabled])').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                handlePermissaoChange(e.target);
            });
        });

        // Event listener para salvar
        const btnSalvar = document.getElementById('btnSalvarPermissoes');
        if (btnSalvar) {
            btnSalvar.addEventListener('click', salvarAlteracoes);
        }
    }

    function handlePermissaoChange(checkbox) {
        const permValue = checkbox.value;
        const wasOriginallyChecked = checkbox.dataset.original === 'true';
        const isNowChecked = checkbox.checked;

        if (wasOriginallyChecked !== isNowChecked) {
            permissoesAlteradas[permValue] = isNowChecked;
        } else {
            delete permissoesAlteradas[permValue];
        }

        atualizarResumoMudancas();
    }

    function atualizarResumoMudancas() {
        const resumoDiv = document.getElementById('mudancasResumo');
        const listaUl = document.getElementById('mudancasLista');
        const btnSalvar = document.getElementById('btnSalvarPermissoes');

        const numMudancas = Object.keys(permissoesAlteradas).length;

        if (numMudancas === 0) {
            if (resumoDiv) resumoDiv.style.display = 'none';
            if (btnSalvar) btnSalvar.disabled = true;
            return;
        }

        if (resumoDiv) resumoDiv.style.display = 'block';
        if (btnSalvar) btnSalvar.disabled = false;

        if (listaUl) {
            listaUl.innerHTML = Object.entries(permissoesAlteradas).map(([perm, ativada]) => 
                `<li>${ativada ? 'Adicionar' : 'Remover'}: ${perm}</li>`
            ).join('');
        }
    }

    function salvarAlteracoes() {
        if (Object.keys(permissoesAlteradas).length === 0) {
            return;
        }

        const confirmMsg = `Você está prestes a alterar ${Object.keys(permissoesAlteradas).length} permissão(ões) do perfil ${selectedPerfil}. Confirmar?`;
        
        if (!confirm(confirmMsg)) {
            return;
        }

        // Aqui você implementaria a lógica real de salvar
        console.log('Salvando alterações:', permissoesAlteradas);
        
        alert('✅ Permissões atualizadas com sucesso!');
        
        // Limpar estado
        permissoesAlteradas = {};
        
        // Re-renderizar
        if (selectedPerfil) {
            const role = window.PermissionsSystem.ROLES[selectedPerfil];
            renderEdicaoPerfil(role, window.PermissionsSystem.PERMISSIONS);
        }
    }

    function cancelarEdicao() {
        if (Object.keys(permissoesAlteradas).length > 0) {
            if (!confirm('Você tem alterações não salvas. Deseja descartar?')) {
                return;
            }
        }

        permissoesAlteradas = {};
        selectedPerfil = null;

        const container = document.getElementById('controleGrid');
        if (container) {
            renderPerfisControle(container);
        }
    }

    // =========================
    // FUNÇÕES AUXILIARES
    // =========================
    function agruparPermissoesPorModulo(PERMISSIONS, area) {
        const grouped = {};
        const prefixosArea = getPrefixosArea(area);

        Object.entries(PERMISSIONS).forEach(([key, value]) => {
            const prefix = value.split('.')[0];
            
            // Só mostrar permissões da área atual
            if (!prefixosArea.includes(prefix)) {
                return;
            }

            const moduleName = capitalize(prefix);

            if (!grouped[moduleName]) {
                grouped[moduleName] = [];
            }

            grouped[moduleName].push({
                key,
                value,
                label: key.replace(/_/g, ' ')
            });
        });

        return grouped;
    }

    function getPrefixosArea(area) {
        const prefixos = {
            atendimento: ['atendimento', 'chat'],
            financeiro: ['financeiro'],
            conteudo: ['conteudo'],
            gerencia: ['gerencia', 'relatorios']
        };

        return prefixos[area] || [];
    }

    function podeEditarPermissao(permValue) {
        const prefix = permValue.split('.')[0];
        const prefixosArea = getPrefixosArea(currentArea);
        
        return prefixosArea.includes(prefix);
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function contarUsuariosPorRole(roleKey) {
        // Mock - em produção consultaria o banco
        const counts = {
            'ATENDENTE': 12,
            'SUPERVISOR': 4,
            'GERENTE': 2,
            'CONTEUDO': 5
        };
        return counts[roleKey] || 0;
    }

    // =========================
    // FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO MÓDULO
    // =========================
    function initGerencia() {
        initAbas();
        initSubAbas();
        initPainelPedidos();
    }

    // =========================
    // FUNÇÃO DE ENTRADA DO MÓDULO
    // =========================
    window.initGerenciaModule = function () {
        initGerencia();
    };

    // Exportar funções necessárias
    window.gerenciaModule = {
        cancelarEdicao: cancelarEdicao
    };

})();