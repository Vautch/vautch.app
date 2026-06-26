---
name: Hotfix
about: Correção de bug crítico direto para main
---

## 🔴 Severidade do Bug

- [ ] 🔴 Crítico — sistema indisponível / perda de dados (merge direto em `main`)
- [ ] 🟠 High — feature principal comprometida (avaliar release emergencial)
- [ ] 🟡 Medium — feature secundária afetada (próximo release regular)
- [ ] 🟢 Low — cosmético / UX menor (próxima sprint)

> ⚠️ Este template é indicado para bugs **Críticos** e **High**. Para Medium e Low, use o fluxo padrão via `develop`.

## 🐛 Descrição do Bug

> Descreva o problema encontrado: o que acontece, onde, quando e com que frequência.

## 🔗 Issue / Ticket

Fixes #<!-- número da issue -->

## 💥 Impacto

> Quem está sendo afetado? Quantos usuários? Qual funcionalidade está indisponível?

## 🛠️ Root Cause

> Qual foi a causa raiz identificada?

## ✅ Solução Aplicada

> Descreva o que foi alterado para corrigir o problema.

## 🧪 Como testar

1. 
2. 
3. 

## 📸 Evidências

> Logs, screenshots, traces ou qualquer evidência do bug e da correção.

## 🔍 Checklist

- [ ] Branch criada a partir de `main`
- [ ] Fix validado localmente
- [ ] Testes automatizados adicionados/atualizados
- [ ] Testes passando
- [ ] Cherry-pick ou merge agendado para `develop` após aprovação
- [ ] Sem regressões introduzidas pela correção
- [ ] Tag de versão patch será criada após merge (`vX.Y.Z+1`)

## ⚡ Aprovação Emergencial

> Para bugs **Críticos**, este PR requer aprovação de **pelo menos 1 revisor** antes do merge.
> Identifique o revisor disponível e sinalize no canal de incidentes.

**Revisor notificado:** @
**Canal de incidente:** 
