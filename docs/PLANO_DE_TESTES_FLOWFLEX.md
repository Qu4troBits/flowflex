# 📋 Plano de Testes — Flowflex
**Repositório:** https://github.com/Qu4troBits/flowflex  
**Versão:** 1.0 · **Data:** 2026-06-02  
**Stack:** Next.js 16 (frontend) · Spring Boot 3.4 + JWT (backend) · PostgreSQL  
**Ferramentas:** Cypress (E2E) · Playwright (E2E cross-browser) · JUnit/MockMvc (API)

---

## Índice
1. [Objetivo e Escopo](#1-objetivo-e-escopo)
2. [Estratégia](#2-estratégia)
3. [Critérios de Entrada e Saída](#3-critérios-de-entrada-e-saída)
4. [Riscos](#4-riscos)
5. [AUTH — Autenticação e Cadastro](#5-auth--autenticação-e-cadastro)
6. [CT — Lista de Custos Diários](#6-ct--lista-de-custos-diários)
7. [CT — Formulário Nova Inserção](#7-ct--formulário-nova-inserção)
8. [CT — Fluxo de Caixa](#8-ct--fluxo-de-caixa)
9. [CT — DRE](#9-ct--dre)
10. [CT — Conciliação Bancária](#10-ct--conciliação-bancária)
11. [CT — Dashboard (Cards)](#11-ct--dashboard-cards)
12. [CT — Sidebar e Navegação](#12-ct--sidebar-e-navegação)
13. [API — Endpoints Backend](#13-api--endpoints-backend)
14. [SEC — Segurança](#14-sec--segurança)
15. [Resumo de Cobertura](#15-resumo-de-cobertura)

---

## 1. Objetivo e Escopo

**Objetivo:** Garantir que todas as funcionalidades do Flowflex funcionem corretamente de ponta a ponta — do frontend Next.js ao backend Spring Boot — antes de cada entrega na branch `qa-teste-github-issue`.

**In-scope:**
- Autenticação (login, cadastro, logout, sessão JWT)
- Lista de Custos Diários (CRUD completo)
- Formulário de Nova Inserção (criar, editar, repetição)
- Fluxo de Caixa (projeção 90 dias, filtros, paginação)
- DRE (cálculo anual, inputs locais, integração API)
- Conciliação Bancária (saldo inicial, check, salvar)
- Dashboard (cards de resumo)
- Sidebar e navegação entre módulos
- Endpoints REST da API backend
- Segurança básica (OWASP Top 10 aplicável)

**Out-of-scope:** Landing page marketing (`/`), infra de deploy, integrações externas de pagamento.

---

## 2. Estratégia

| Camada | Ferramenta | Foco |
|---|---|---|
| E2E fluxo completo | **Cypress** | Feliz + negativo + borda (interface) |
| E2E cross-browser | **Playwright** | Chrome + Firefox + Safari |
| API REST | **JUnit + MockMvc** | Todos endpoints mapeados |
| Segurança | Cypress + inspeção manual | OWASP básico |

**Ambiente:** `http://localhost:3000` (frontend) · `http://localhost:8080` (backend)  
**Dados de teste:** fixtures isolados, usuário `teste@flowflex.com` / senha `Teste@123`

---

## 3. Critérios de Entrada e Saída

**Entrada:**
- Backend rodando (`./mvnw spring-boot:run`)
- Frontend rodando (`npm run dev`)
- Banco PostgreSQL com dados de seed

**Saída:**
- 100% dos casos 🔴 Crítica passando
- 0 issues abertas sem label `test:e2e` ou `test:api`
- Cobertura ≥ 80% nos endpoints da API

---

## 4. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Token JWT expira durante o teste | 🔴 Alto | Renovar token no `beforeEach` do Cypress |
| API sem dados seed | 🔴 Alto | Script de seed no `cypress/fixtures` |
| `localStorage` bloqueado em modo privado | 🟠 Médio | Testar em modo normal |
| Cálculos de DRE dependem de dados reais | 🟠 Médio | Mockar chamadas à API no Jest/Playwright |
| Race condition na conciliação bancária | 🟡 Baixo | `cy.wait()` após POST de conciliação |

---

## 5. AUTH — Autenticação e Cadastro

### 5.1 Login (`/login`)

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| AUTH-001 | Login com credenciais válidas | Usuário `teste@flowflex.com` cadastrado | 1. Acessar `/login`<br>2. Preencher email e senha corretos<br>3. Clicar em "Entrar" | Redireciona para `/principal`; token JWT salvo no `localStorage["token"]` | 🔴 | Cypress |
| AUTH-002 | Login com senha incorreta | Usuário cadastrado | 1. Acessar `/login`<br>2. Informar email válido + senha errada<br>3. Clicar em "Entrar" | Mensagem de erro visível; URL permanece `/login`; nenhum token no `localStorage` | 🔴 | Cypress |
| AUTH-003 | Login com email inexistente | — | 1. Acessar `/login`<br>2. Preencher email não cadastrado + qualquer senha<br>3. Clicar em "Entrar" | Mensagem de erro; sem redirecionamento | 🔴 | Cypress |
| AUTH-004 | Login com campos vazios | — | 1. Acessar `/login`<br>2. Clicar em "Entrar" sem preencher nada | Validação HTML bloqueia submit; campos em destaque | 🟠 | Cypress |
| AUTH-005 | Toggle mostrar/ocultar senha | Tela de login aberta | 1. Clicar no ícone de olho ao lado do campo senha | Campo alterna entre `type="password"` e `type="text"` | 🟢 | Cypress |
| AUTH-006 | Sessão expirada redireciona para login | Token expirado inserido manualmente no localStorage | 1. Inserir token expirado<br>2. Acessar `/principal` | API retorna 401; `localStorage["token"]` removido; redireciona para `/` | 🔴 | Cypress |
| AUTH-007 | Acesso direto a `/principal` sem token | localStorage vazio | 1. Navegar direto para `/principal` sem autenticar | Redireciona para `/` ou exibe erro de autenticação | 🔴 | Cypress |
| AUTH-008 | Login via modal na landing page | Landing page visível | 1. Clicar em "Login" na navbar<br>2. Preencher credenciais no modal<br>3. Clicar em "Entrar" | Modal fecha; redireciona para `/principal`; token salvo | 🟠 | Cypress |

### 5.2 Cadastro (`/cadastro`)

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| AUTH-009 | Cadastro com dados válidos | Nenhum usuário com o email | 1. Acessar `/cadastro`<br>2. Preencher nome, email, senha e confirmação<br>3. Clicar em "Cadastrar" | Redireciona para `/login`; usuário criado no banco | 🔴 | Cypress |
| AUTH-010 | Senhas não coincidem | Tela de cadastro aberta | 1. Preencher senha `Abc@123`<br>2. Preencher confirmação `Xyz@123`<br>3. Clicar em "Cadastrar" | Mensagem "As senhas não coincidem" exibida; sem chamada à API | 🔴 | Cypress |
| AUTH-011 | Email já cadastrado | Usuário com email existente no banco | 1. Tentar cadastrar com email já existente | API retorna erro; mensagem de conflito exibida | 🟠 | Cypress |
| AUTH-012 | Cadastro com email inválido | — | 1. Digitar `nao-e-um-email` no campo email<br>2. Submeter | Validação HTML/frontend bloqueia; campo em destaque | 🟠 | Cypress |
| AUTH-013 | Link "Possui conta? Login" navega para `/login` | Tela de cadastro | 1. Clicar no link "Login" no rodapé do form | Navega para `/login` | 🟢 | Cypress |

### 5.3 Logout

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| AUTH-014 | Logout remove token e redireciona | Usuário logado em `/principal` | 1. Clicar em "Sair" na sidebar | Token removido do `localStorage`; redireciona para `/` | 🔴 | Cypress |
| AUTH-015 | Após logout, botão voltar não acessa `/principal` | Usuário recém deslogado | 1. Após logout, pressionar botão voltar do browser | Permanece em `/` ou redireciona novamente para login | 🔴 | Cypress |

---

## 6. CT — Lista de Custos Diários

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| CT-001 | Listar custos diários com dados | Usuário logado; ao menos 1 custo cadastrado | 1. Navegar para "Lista de Custos" pela sidebar | Tabela exibe linhas com colunas: Descrição, Item, Competência, Vencimento, Pagamento, Valor, Status, Forma Pgto, Banco, Natureza, DRE | 🔴 | Cypress |
| CT-002 | Listar custos sem dados retorna tabela vazia | Usuário logado; nenhum custo cadastrado | 1. Navegar para "Lista de Custos" | Tabela exibe 0 linhas; sem erro no console | 🟠 | Cypress |
| CT-003 | Busca por descrição filtra corretamente | Ao menos 2 custos com descrições distintas | 1. Digitar parte da descrição no campo de busca | Apenas linhas com a descrição buscada são exibidas | 🔴 | Cypress |
| CT-004 | Filtro por item filtra corretamente | Ao menos 2 itens distintos na lista | 1. Clicar no ícone de filtro<br>2. Selecionar um item específico | Apenas linhas do item selecionado aparecem; contador atualizado | 🔴 | Cypress |
| CT-005 | Limpar filtro restaura lista completa | Filtro ativo | 1. Com filtro ativo, clicar em "Limpar filtro" | Todos os registros voltam a aparecer | 🟠 | Cypress |
| CT-006 | Paginação — navegar para próxima página | Mais de 10 registros | 1. Clicar em "próxima página" | Segunda página de registros é exibida; botão anterior fica ativo | 🟠 | Cypress |
| CT-007 | Alterar itens por página para 20 | Lista com mais de 10 registros | 1. Clicar no seletor de itens por página<br>2. Selecionar 20 | Lista passa a exibir até 20 itens por página | 🟢 | Cypress |
| CT-008 | Alterar status de PREVISTO para PAGO | Registro com status PREVISTO | 1. Clicar no badge de status do registro<br>2. Selecionar "PAGO" | Status muda para PAGO (badge verde); data de pagamento preenchida com data de hoje; PUT enviado à API com sucesso | 🔴 | Cypress |
| CT-009 | Alterar status para CANCELADO | Registro com status qualquer | 1. Clicar no badge de status<br>2. Selecionar "CANCELADO" | Status muda para CANCELADO (badge cinza); API confirma com 200 | 🟠 | Cypress |
| CT-010 | Abrir formulário de edição pelo menu de ações | Ao menos 1 registro | 1. Clicar nos 3 pontos (⋮) do registro<br>2. Clicar em "Editar" | Modal abre com todos os campos preenchidos com dados do registro | 🔴 | Cypress |
| CT-011 | Abrir modal de Nova Inserção | Usuário logado | 1. Clicar em "+ Nova Inserção" | Modal abre com formulário vazio | 🔴 | Cypress |
| CT-012 | Erro de API ao listar custos exibe feedback | Backend indisponível (simular) | 1. Bloquear chamada à `/formulario-custo-diario/listar`<br>2. Navegar para "Lista de Custos" | Mensagem de erro amigável; tabela não quebra | 🟠 | Cypress |
| CT-013 | Coluna "Tipo" exibe ENTRADA em verde e SAÍDA em vermelho | Registros de entrada e saída presentes | 1. Visualizar tabela | Entradas exibem indicador diferenciado de saídas | 🟢 | Cypress |

---

## 7. CT — Formulário Nova Inserção

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| CT-014 | Cadastrar novo lançamento com todos os campos | Usuário logado; itens disponíveis na API | 1. Abrir modal de Nova Inserção<br>2. Preencher: Item, Forma Pagamento, Descrição, Valor, Mês Competência, Status, Data Vencimento, Banco<br>3. Clicar em "Salvar" | Modal fecha; toast de sucesso exibido; novo registro aparece na tabela | 🔴 | Cypress |
| CT-015 | Selecionar item preenche automaticamente Tipo, Natureza e DRE | Item cadastrado com natureza e DRE vinculados | 1. Abrir formulário<br>2. Selecionar item no dropdown | Campos "Entrada/Saída", "Natureza" e "DRE" preenchidos automaticamente | 🔴 | Cypress |
| CT-016 | Campos obrigatórios impedem submissão | Formulário aberto | 1. Clicar em "Salvar" sem preencher campos obrigatórios | Formulário não é submetido; campos obrigatórios em destaque | 🔴 | Cypress |
| CT-017 | Mês Competência inválido exibe alerta | Formulário aberto | 1. Inserir valor inválido em "Mês Competência" manualmente<br>2. Tentar submeter | Alerta "Mês de competência inválido. Formato esperado: AAAA-MM" | 🟠 | Cypress |
| CT-018 | Criar novo banco no formulário | Banco digitado não existe | 1. Digitar nome de banco novo no campo Banco<br>2. Clicar em "+ Criar banco" | Banco criado via `POST /banco/cadastrar`; selecionado automaticamente | 🟠 | Cypress |
| CT-019 | Ativar "Se repete" habilita campo de meses | Formulário aberto | 1. Marcar checkbox "Se repete" | Campo "Meses de repetição" fica visível e editável | 🟠 | Cypress |
| CT-020 | Editar lançamento existente | Modal de edição aberto com dados preenchidos | 1. Alterar o valor<br>2. Clicar em "Salvar" | Modal fecha; toast "Registro atualizado com sucesso!"; tabela reflete a alteração | 🔴 | Cypress |
| CT-021 | Edição sem token redireciona para login | Token removido do localStorage | 1. Tentar submeter edição sem token | Alerta de autenticação; redireciona para `/` | 🔴 | Cypress |
| CT-022 | Valor 0 (zero) pode ser cadastrado | Formulário aberto | 1. Preencher Valor = `0`<br>2. Submeter | Lançamento criado com valor 0; sem erro | 🟡 | Cypress |
| CT-023 | Valor negativo é aceito ou bloqueado | Formulário aberto | 1. Inserir Valor = `-100`<br>2. Submeter | Comportamento definido: se bloqueado, mensagem de erro; se aceito, salva corretamente | 🟡 | Cypress |

---

## 8. CT — Fluxo de Caixa

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| CT-024 | Projeção 90 dias exibe tabela com datas | Usuário logado; lançamentos cadastrados | 1. Navegar para "Fluxo de Caixa" | Tabela exibe 90 linhas (dias úteis + hoje); colunas Data, Entradas, Saídas, Saldo Dia, Saldo Projetado | 🔴 | Playwright |
| CT-025 | Saldo projetado acumula corretamente | 2+ lançamentos com datas distintas | 1. Visualizar tabela de projeção | Cada linha de "Saldo Projetado" = saldo da linha anterior + (Entradas - Saídas) do dia | 🔴 | Playwright |
| CT-026 | Filtro por coluna "Data" filtra linhas | Tabela com 90 dias visível | 1. Clicar no funil da coluna "Data"<br>2. Digitar uma data parcial | Apenas linhas com a data digitada aparecem | 🟠 | Playwright |
| CT-027 | Filtro por "Entradas" filtra por valor | Tabela carregada | 1. Filtrar pela coluna "Entradas" com valor conhecido | Linhas sem aquela entrada somem | 🟠 | Playwright |
| CT-028 | Limpar filtro de coluna restaura todas as linhas | Filtro ativo | 1. Com filtro ativo, clicar em "Limpar filtro" da coluna | Todas as 90 linhas voltam a aparecer | 🟠 | Playwright |
| CT-029 | Dia atual destacado visualmente | — | 1. Visualizar tabela | A linha do dia atual está com destaque visual diferenciado | 🟢 | Playwright |
| CT-030 | Valores negativos exibidos em vermelho | Saldo do dia negativo em alguma linha | 1. Visualizar tabela com saldo negativo | Valor negativo exibido em vermelho (`text-red-500`) | 🟠 | Playwright |
| CT-031 | Custos por natureza exibidos por dia | Lançamentos com natureza definida | 1. Verificar colunas de natureza na tabela | Colunas de natureza exibem valores agrupados por dia corretamente | 🟡 | Playwright |

---

## 9. CT — DRE

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| CT-032 | DRE carrega dados do ano corrente | Lançamentos do ano atual | 1. Navegar para "DRE" | Tabela exibe 12 colunas de meses com valores da API em `receitaBruta`, `custoOperacional`, etc. | 🔴 | Playwright |
| CT-033 | Selecionar ano diferente recarrega dados | DRE visível | 1. Alterar o seletor de ano | API chamada com novo `ano`; tabela atualiza | 🔴 | Playwright |
| CT-034 | Inputs locais de despesas salvam no localStorage | DRE carregado | 1. Editar campo "Despesa de Pessoal" para um mês<br>2. Navegar para outro módulo e voltar | Valor persiste no campo após retorno | 🟠 | Playwright |
| CT-035 | Receita Bruta Projetada calcula ROAS × Investimento | DRE com valores de Facebook Ads e ROAS preenchidos | 1. Preencher Facebook Ads = `1000`<br>2. Preencher ROAS = `3` | "Receita Bruta Projetada" exibe `3000` | 🔴 | Playwright |
| CT-036 | Resultado Operacional = Receita Líquida − Despesas | Valores de API retornados | 1. Verificar cálculo do "Resultado Operacional" | Valor igual à `receitaLiquida - despesaOperacional` retornado pela API | 🔴 | Playwright |
| CT-037 | DRE sem dados exibe zeros ou indicador de ausência | Nenhum lançamento no ano | 1. Selecionar ano sem dados | Todos os campos de API exibem `R$ 0,00`; sem erro no console | 🟠 | Playwright |
| CT-038 | Campos de % de faturamento calculam proporcionalmente | Campos de receita e despesa preenchidos | 1. Preencher % "Impostos x Faturamento"<br>2. Verificar células correspondentes | Valores calculados como percentual da receita bruta | 🟡 | Playwright |

---

## 10. CT — Conciliação Bancária

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| CT-039 | Selecionar banco carrega histórico de conciliações | Banco com conciliações anteriores | 1. Navegar para "Conciliação Bancária"<br>2. Selecionar banco no dropdown | Tabela exibe linhas por dia com Início, Entradas, Saídas, Final | 🔴 | Cypress |
| CT-040 | Informar saldo inicial ativa a tabela | Banco selecionado; saldo = 0 | 1. Digitar saldo inicial no campo "Início do Dia Banco"<br>2. Perder o foco (blur) | API `POST /conciliacao-bancaria-diaria/conciliar` chamada; tabela inicializada | 🔴 | Cypress |
| CT-041 | Informar saldo final do banco calcula check | Tabela com dados carregados | 1. Preencher "Saldo Final Banco" de uma linha<br>2. Verificar coluna "Check Banco" | Check = Saldo Final Calculado − Saldo Informado; diferença exibida numericamente | 🔴 | Cypress |
| CT-042 | Check zero marca linha como Conciliado | Linha com saldo exato | 1. Informar saldo igual ao calculado | Status da linha = "Conciliado" com indicador verde | 🔴 | Cypress |
| CT-043 | Check ≠ zero marca linha como Divergente | Saldo informado diferente do calculado | 1. Informar saldo diferente do calculado | Status = "Divergente" com indicador de alerta | 🔴 | Cypress |
| CT-044 | Salvar conciliação persiste dados na API | Linha do dia atual com saldo informado | 1. Clicar em "Salvar conciliação" | `POST /conciliacao-bancaria-diaria/conciliar` retorna 200; feedback de sucesso | 🔴 | Cypress |
| CT-045 | Reiniciar limpa todos os campos e localStorage | Conciliação iniciada | 1. Clicar em "Reiniciar" | Todos os campos zerados; localStorage limpo; banco desselecionado | 🟠 | Cypress |
| CT-046 | Filtro por coluna "Status" filtra conciliados | Linhas conciliadas e divergentes | 1. Filtrar coluna Status por "conciliado" | Apenas linhas conciliadas aparecem | 🟠 | Cypress |
| CT-047 | Saldo inicial inválido (negativo) exibe erro | Campo de saldo inicial | 1. Digitar `-500` no campo saldo inicial<br>2. Perder foco | Valor ignorado ou mensagem de erro; API não chamada | 🟠 | Cypress |
| CT-048 | Nenhum lançamento para banco no dia exibe aviso | Banco sem lançamentos no dia atual | 1. Clicar em "Salvar conciliação" sem lançamentos do dia | Mensagem "Não há dados para o dia atual" exibida | 🟠 | Cypress |

---

## 11. CT — Dashboard (Cards)

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| CT-049 | Dashboard exibe cards de resumo | Usuário logado; lançamentos do mês | 1. Navegar para "Início" / "Principal" | Cards exibem: Total Entradas, Total Saídas, Saldo Inicial, Saldo Final do mês | 🔴 | Cypress |
| CT-050 | Barra de progresso de entradas proporcional | Entradas e saídas com valores distintos | 1. Visualizar cards | Barra de entradas tem largura proporcional ao valor; nunca ultrapassa 100% | 🟠 | Cypress |
| CT-051 | Valores em BRL formatados corretamente | Valores cadastrados com centavos | 1. Verificar valores nos cards | Formato `R$ X.XXX,XX` em todos os valores monetários | 🟠 | Cypress |
| CT-052 | Dashboard com 0 lançamentos exibe zeros | Nenhum lançamento no mês | 1. Acessar dashboard sem lançamentos | Cards exibem `R$ 0,00`; sem erros de divisão por zero | 🟠 | Cypress |

---

## 12. CT — Sidebar e Navegação

| ID | Título | Pré-condições | Passos | Resultado esperado | Prio | Tipo |
|---|---|---|---|---|---|---|
| CT-053 | Sidebar recolhe ao clicar no hamburguer | Sidebar expandida | 1. Clicar no ícone hamburguer | Sidebar colapsa para modo ícone (largura `w-20`); textos somem | 🟠 | Cypress |
| CT-054 | Sidebar expande ao clicar novamente | Sidebar colapsada | 1. Clicar no ícone hamburguer | Sidebar volta para `w-64`; textos reaparecem | 🟠 | Cypress |
| CT-055 | Navegar para DRE renderiza componente DRE | Usuário logado | 1. Clicar em "DRE" na sidebar | Componente `tableDRE` renderizado; sem erro 404 | 🔴 | Cypress |
| CT-056 | Navegar para Fluxo de Caixa renderiza tabela | Usuário logado | 1. Clicar em "Fluxo de Caixa" | Componente `tableFluxoDeCaixa` renderizado | 🔴 | Cypress |
| CT-057 | Navegar para Conciliação renderiza componente | Usuário logado | 1. Clicar em "Conciliação Bancária" | Componente `tableConciliacaoBancaria` renderizado | 🔴 | Cypress |
| CT-058 | Navegar para Lista de Custos renderiza tabela | Usuário logado | 1. Clicar em "Lista de Custos" | Tabela de custos diários renderizada com colunas corretas | 🔴 | Cypress |

---

## 13. API — Endpoints Backend

> ⚠️ Assunção: todos os endpoints abaixo existem no backend Spring Boot com base no uso pelo frontend.  
> Ferramenta: JUnit + MockMvc · Prefixo `API-`

### 13.1 Autenticação

| ID | Endpoint | Cenário | Corpo | Esperado | Prio |
|---|---|---|---|---|---|
| API-001 | `POST /login` | Credenciais válidas | `{email, senha}` corretos | `200 OK` com JWT no body | 🔴 |
| API-002 | `POST /login` | Senha errada | `{email, senha}` incorretos | `401 Unauthorized` | 🔴 |
| API-003 | `POST /login` | Corpo vazio | `{}` | `400 Bad Request` | 🟠 |
| API-004 | `POST /usuario/adicionar` | Novo usuário válido | `{nomeUsuario, email, senha}` | `201 Created` | 🔴 |
| API-005 | `POST /usuario/adicionar` | Email duplicado | Email já existente | `409 Conflict` ou `400` | 🔴 |

### 13.2 Custo Diário

| ID | Endpoint | Cenário | Esperado | Prio |
|---|---|---|---|---|
| API-006 | `GET /formulario-custo-diario/listar` | Com token válido | `200 OK`, array de registros | 🔴 |
| API-007 | `GET /formulario-custo-diario/listar` | Sem token | `401 Unauthorized` | 🔴 |
| API-008 | `POST /formulario-custo-diario/cadastrar` | Payload completo válido | `201 Created` com objeto salvo | 🔴 |
| API-009 | `POST /formulario-custo-diario/cadastrar` | Sem campo obrigatório `item` | `400 Bad Request` | 🟠 |
| API-010 | `PUT /formulario-custo-diario/atualizar/{id}` | ID existente + payload válido | `200 OK` com objeto atualizado | 🔴 |
| API-011 | `PUT /formulario-custo-diario/atualizar/{id}` | ID inexistente | `404 Not Found` | 🟠 |

### 13.3 Banco

| ID | Endpoint | Cenário | Esperado | Prio |
|---|---|---|---|---|
| API-012 | `GET /banco/listar` | Com token | `200 OK`, array de bancos | 🔴 |
| API-013 | `POST /banco/cadastrar` | Nome novo | `201 Created` com banco | 🔴 |
| API-014 | `POST /banco/cadastrar` | Nome vazio | `400 Bad Request` | 🟠 |

### 13.4 Conciliação Bancária

| ID | Endpoint | Cenário | Esperado | Prio |
|---|---|---|---|---|
| API-015 | `POST /conciliacao-bancaria-diaria/conciliar` | Payload válido `{bancoId, data, saldoInicial, saldoFinal}` | `200 OK` ou `201 Created` | 🔴 |
| API-016 | `POST /conciliacao-bancaria-diaria/conciliar` | `saldoInicial <= 0` | `400 Bad Request` | 🟠 |
| API-017 | `GET /conciliacao-bancaria-diaria/listar` | Com token | `200 OK`, array de lançamentos | 🔴 |
| API-018 | `GET /conciliacao-bancaria-diaria/listar-por-usuario-banco` | `?usuarioId=X&bancoId=Y` válidos | `200 OK`, registros filtrados | 🔴 |

### 13.5 DRE

| ID | Endpoint | Cenário | Esperado | Prio |
|---|---|---|---|---|
| API-019 | `GET /dre/calculo?mes=1&ano=2026` | Mês e ano válidos | `200 OK` com campos `receitaBruta`, `tributos`, `receitaLiquida`, `custoOperacional`, `comissoes`, `lucroBruto`, `despesaOperacional`, `resultadoOperacional`, `margemBruta`, `margemOperacional` | 🔴 |
| API-020 | `GET /dre/calculo?mes=13&ano=2026` | Mês inválido (13) | `400 Bad Request` | 🟠 |
| API-021 | `GET /dre/calculo?mes=1&ano=2026` | Sem token | `401 Unauthorized` | 🔴 |

### 13.6 Natureza

| ID | Endpoint | Cenário | Esperado | Prio |
|---|---|---|---|---|
| API-022 | `PUT /natureza/atualizar/{id}` | ID existente + grupoDre válido | `200 OK` | 🟠 |
| API-023 | `PUT /natureza/atualizar/{id}` | ID inexistente | `404 Not Found` | 🟠 |

---

## 14. SEC — Segurança

> ⚠️ Executar apenas em ambiente próprio autorizado (localhost). Lei 12.737/2012 (BR).

| ID | Título | Passos | Resultado esperado | Prio |
|---|---|---|---|---|
| SEC-001 | Endpoint sem token retorna 401 | Chamar `GET /formulario-custo-diario/listar` sem header `Authorization` | `401 Unauthorized`; sem dados retornados | 🔴 |
| SEC-002 | Token de outro usuário não acessa dados alheios (IDOR) | Criar 2 usuários; usar token de A para acessar lançamentos de B via `GET /formulario-custo-diario/listar` | Retorna apenas dados do próprio usuário A; nunca de B | 🔴 |
| SEC-003 | XSS no campo Descrição | Inserir `<script>alert(1)</script>` no campo Descrição e salvar | Payload salvo como texto escapado; sem alert disparado | 🔴 |
| SEC-004 | XSS no campo Observações | Inserir `<img src=x onerror=alert(1)>` em Observações | Payload escapado na exibição; sem execução de JS | 🔴 |
| SEC-005 | SQL Injection no campo email do login | Preencher email com `' OR '1'='1` e qualquer senha | `401 Unauthorized`; sem bypass de autenticação | 🔴 |
| SEC-006 | Token JWT manipulado não é aceito | Alterar o payload do JWT no localStorage (mudar `userId`)<br>Fazer requisição à API | `401 Unauthorized`; sem dados retornados | 🔴 |
| SEC-007 | Credenciais não trafegam em texto plano na URL | Realizar login e inspecionar URL e network | Credenciais enviadas via POST body; não aparecem na URL | 🔴 |
| SEC-008 | Rate limit no login (se implementado) | 20 tentativas de login inválidas em sequência | A partir da Nª resposta, `429 Too Many Requests` ou bloqueio temporário | 🟠 |
| SEC-009 | Resposta de erro não vaza stack trace | Forçar erro 500 (payload inválido)<br>Verificar response body | Mensagem genérica de erro; sem stack Java/SQL exposta | 🟠 |
| SEC-010 | Sessão não persiste após expiração do JWT | Aguardar expiração do token ou simular token expirado | `localStorage["token"]` removido; redirecionamento para login | 🔴 |

---

## 15. Resumo de Cobertura

| Módulo | Total de Casos | 🔴 Crítica | 🟠 Alta | 🟡 Média | 🟢 Baixa |
|---|---|---|---|---|---|
| AUTH — Autenticação e Cadastro | 15 | 9 | 4 | 0 | 2 |
| Lista de Custos Diários | 13 | 6 | 5 | 0 | 2 |
| Formulário Nova Inserção | 10 | 5 | 3 | 2 | 0 |
| Fluxo de Caixa | 8 | 3 | 4 | 1 | 1 |
| DRE | 7 | 4 | 2 | 1 | 0 |
| Conciliação Bancária | 10 | 6 | 4 | 0 | 0 |
| Dashboard (Cards) | 4 | 1 | 3 | 0 | 0 |
| Sidebar e Navegação | 6 | 4 | 2 | 0 | 0 |
| API — Endpoints Backend | 23 | 14 | 8 | 0 | 1 |
| SEC — Segurança | 10 | 8 | 2 | 0 | 0 |
| **TOTAL** | **106** | **60** | **37** | **4** | **6** |

---

> 📌 **Próximos passos sugeridos:**
> 1. Implementar os casos 🔴 Crítica de AUTH e Lista de Custos como primeira sprint de testes
> 2. Configurar Cypress com `cypress/fixtures/seed.json` para dados de teste isolados
> 3. Ativar o `github-issue-reporter.js` para abertura automática de issues ao falhar
> 4. Adicionar os casos de API no JUnit como testes de integração no `flow-flex-backend`
