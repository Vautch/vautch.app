# Release Strategy — vautch.app

## Visão Geral

Este documento define a estratégia de release para o repositório `vautch.app`, cobrindo ambientes, fluxo de branches, uso de feature toggles e critérios de severidade para bugs.

---

## Ambientes

### Production (`main`)

- Branch de referência: `main`
- Representa o código **estável e liberado para usuários finais**.
- Toda entrega para produção deve ser **tagueada** seguindo [Semantic Versioning](https://semver.org/): `vMAJOR.MINOR.PATCH` (ex: `v1.4.2`).
- **Novas features nunca entram diretamente em produção sem feature toggle ativo.** O código pode ser deployado, mas a feature permanece desabilitada até validação completa em homologação.
- Hotfixes críticos são a **única exceção** à regra acima e podem ir direto para `main` com PR aprovado.

### Dev / Homolog (`develop`)

- Branch de referência: `develop`
- Representa o código **em validação**, integrado e minimamente estável.
- É o ambiente onde novas features são integradas, testadas e validadas antes de promover para produção.
- Deve permanecer **deployável a qualquer momento** — broken builds em `develop` devem ser corrigidos como prioridade imediata.
- Feature toggles devem ser habilitados aqui para validação antes de qualquer promoção.

---

## Fluxo de Branches

```
feature/nome-da-feature  ──┐
                            ├──► develop ──► main (tagged release)
fix/nome-do-fix ───────────┘
                                              ▲
hotfix/nome-do-hotfix ────────────────────────┘  (somente para bugs críticos)
```

| Tipo de branch       | Base         | Merge destino          | Observação                              |
|----------------------|--------------|------------------------|-----------------------------------------|
| `feature/*`          | `develop`    | `develop`              | Sempre com feature toggle               |
| `fix/*`              | `develop`    | `develop` → `main`     | Depende da severidade (ver abaixo)      |
| `hotfix/*`           | `main`       | `main` + `develop`     | Apenas para bugs Críticos               |
| `release/*`          | `develop`    | `main`                 | Para preparação de releases formais     |

---

## Feature Toggles

Toda nova implementação deve ser protegida por um feature toggle.

**Regras:**
- O toggle deve ser criado **antes** de iniciar o desenvolvimento da feature.
- A feature pode ser mergeada em `develop` com toggle **desabilitado por padrão**.
- O toggle é habilitado em `develop`/homologação para validação.
- Só é habilitado em `production` após aprovação explícita.
- Após estabilização completa em produção, o toggle deve ser **removido** (limpeza de dívida técnica).

**Nomenclatura sugerida:**
```
FEATURE_[NOME_DA_FEATURE]   ex: FEATURE_NEW_CHECKOUT_FLOW
```

---

## Critérios de Bugs

Todo bug reportado deve ser catalogado com uma das quatro severidades abaixo. A severidade determina o fluxo de resolução e a urgência do fix.

### 🔴 Crítico

**Definição:** O sistema está completamente indisponível ou há perda/corrupção de dados de usuários. Não existe workaround viável.

**Exemplos:**
- Aplicação fora do ar para todos os usuários
- Falha em fluxo de pagamento/checkout bloqueando 100% das transações
- Vazamento ou corrupção de dados sensíveis
- Erro que impede login de todos os usuários

**SLA de resposta:** Imediato (< 1h)  
**Fluxo:** `hotfix/*` → `main` (com PR aprovado por pelo menos 1 revisor) → cherry-pick em `develop`  
**Tag:** Nova patch release obrigatória (`vX.Y.Z+1`)

---

### 🟠 High

**Definição:** Funcionalidade principal afetada de forma severa, com impacto significativo em parte dos usuários. Workaround pode existir, mas é precário.

**Exemplos:**
- Fluxo de cadastro quebrando para determinado grupo de usuários
- Feature principal retornando erro em condições específicas
- Degradação severa de performance afetando a experiência

**SLA de resposta:** < 4h  
**Fluxo:** `fix/*` → `develop` → `main` no próximo release agendado (ou release emergencial se necessário)

---

### 🟡 Medium

**Definição:** Funcionalidade secundária ou edge case afetado. Impacto limitado e workaround disponível.

**Exemplos:**
- Exibição incorreta de dados em um relatório
- Comportamento inesperado em tela secundária
- Falha em integração não crítica

**SLA de resposta:** < 24h  
**Fluxo:** `fix/*` → `develop` → `main` no próximo release regular

---

### 🟢 Low

**Definição:** Problema cosmético, de UX menor ou inconsistência que não impacta o funcionamento do sistema.

**Exemplos:**
- Erro de tipografia ou tradução
- Alinhamento visual incorreto
- Tooltip ou mensagem de erro com texto inadequado

**SLA de resposta:** Próxima sprint  
**Fluxo:** `fix/*` → `develop` → `main` no release regular seguinte

---

## Tabela Resumo — Bugs

| Severidade | Impacto                        | SLA Resposta | Branch Base | Merge Direto para `main`? |
|------------|-------------------------------|--------------|-------------|---------------------------|
| 🔴 Crítico  | Sistema indisponível / dados  | < 1h         | `main`      | ✅ Sim (hotfix)            |
| 🟠 High     | Feature principal comprometida| < 4h         | `develop`   | ⚠️ Apenas se emergencial   |
| 🟡 Medium   | Feature secundária afetada    | < 24h        | `develop`   | ❌ Não                     |
| 🟢 Low      | Cosmético / UX menor          | Próx. sprint | `develop`   | ❌ Não                     |

---

## Processo de Release para Production

1. Criar branch `release/vX.Y.Z` a partir de `develop`
2. Realizar testes finais e ajustes de última hora
3. Abrir PR de `release/vX.Y.Z` → `main`
4. Aprovação de pelo menos **2 revisores**
5. Merge em `main`
6. Criar tag `vX.Y.Z` no commit de merge
7. Fazer cherry-pick ou merge de volta em `develop`
8. Habilitar feature toggles conforme planejamento

---

## Checklist de PR para `main`

- [ ] Testes automatizados passando
- [ ] Review de pelo menos 1 desenvolvedor (2 para releases)
- [ ] Feature toggle configurado (para novas features)
- [ ] Sem regressões conhecidas em `develop`
- [ ] Changelog atualizado
- [ ] Tag de versão criada após merge
