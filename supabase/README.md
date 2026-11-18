# Database — preparação local

Estado em 18/11/2026: estrutura remota consultada em READ ONLY; baseline pública reconstruída, correções versionadas e testes reais em PostgreSQL portátil. **Remoto não corrigido; stack Supabase completa ainda não validada.** Ver [relatório de segurança](docs/DATABASE_SECURITY_RESULTS.md) e [resultados executados](reports/latest-local-security.json).

- [Diagnóstico e compatibilidade](docs/DATABASE_VALIDATION_DIAGNOSIS.md)
- [Extração somente de leitura e execução futura](docs/LOCAL_DATABASE_RUNBOOK.md)
- [Referência do contrato esperado](docs/DATABASE_SCHEMA_REFERENCE.md)
- `migrations/`: baseline local, hardening original preservado e três correções novas. Não enviar a baseline ao remoto já provisionado.
- `tests/`: suíte original revisada + suíte ampliada; somente banco local vazio.
- `qa/`: PostgreSQL portátil, emulação mínima de Auth e 27 casos de concorrência com duas conexões.
- `scripts/inspect_remote_schema.sql`: consultas de catálogo em transação READ ONLY, não executadas.
- `scripts/preflight.mjs`: checagem estática, sem conexão com banco ou aplicação de SQL.
- `snapshots/`: destino ignorado pelo Git para exportações a revisar.

Na raiz: `node supabase/scripts/preflight.mjs` verifica a rota Supabase/Docker; ausência de Docker continua bloqueando essa rota. A rota portátil executada usa `node supabase/qa/run-local.mjs`; veja os pré-requisitos e limites no relatório. Não executar `db push`: a baseline reflete objetos que já existem remotamente.
