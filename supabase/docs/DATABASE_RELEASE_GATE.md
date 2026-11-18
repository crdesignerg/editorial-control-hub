# Critérios pendentes para liberação do Database

> Atualização: as cinco migrações foram aplicadas no projeto Cloud separado de homologação; veja [CLOUD_DEPLOYMENT_RESULTS.md](CLOUD_DEPLOYMENT_RESULTS.md). Produção permanece intocada. A rota Cloud autorizada substitui a dependência de Docker; testes Auth/PostgREST e provisionamento dos dois perfis ainda estão pendentes.

## Escopo confirmado

A baseline pública foi reconstruída de catálogos remotos consultados em READ ONLY em 18/11/2026. Abrange profiles, clients e editorial_contents, enums, constraints, índices, funções, triggers e policies customizados. Os CSVs têm hashes registrados em DATABASE_SECURITY_RESULTS.md. Não constitui exportação completa da plataforma nem confirmação contínua do estado remoto.

As migrações corretivas posteriores alteram intencionalmente funções, triggers e ACLs locais; portanto o estado local corrigido não é idêntico ao remoto observado. Não enviar a baseline ao banco remoto já existente.

## Testes implementados

São 93 asserções pgTAP e 27 cenários concorrentes, além da aplicação de cinco migrações. Consultar reports/latest-local-security.json para a execução mais recente. O executor usa PostgreSQL portátil e Auth mínimo emulado; não substitui Supabase completo.

## Seis cenários mínimos de integração ainda não executados

Os itens abaixo são critérios de aceite planejados, não testes automatizados já implementados. A quantidade não representa toda a cobertura futura.

1. Login real de administrador e membro via GoTrue, com JWT usado no PostgREST para ler o próprio perfil ativo.
2. Acesso anônimo e usuário inativo: comprovar bloqueio na API, incluindo perfil próprio invisível para inativo.
3. Refresh, expiração e encerramento de sessão: verificar comportamento real dos tokens e revalidação de atividade; não presumir revogação imediata de access tokens após logout.
4. Criação de conta/convite pelo Auth real: validar trigger, metadata sem elevação e política de admissão aprovada para evitar acesso interno por cadastro aberto.
5. Exclusão pelo caminho administrativo real do Auth: usuário comum permitido e último administrador protegido; verificar efeitos de soft-delete e banimento separadamente.
6. Migrações e permissões na stack gerenciada local: validar ownership, search_path, EXECUTE, GRANTs e tentativas de elevação via API; repetir pgTAP nessa stack.

## Bloqueios e próximo passo

Docker não foi encontrado no PATH, nos caminhos padrão verificados ou como serviço nesta rechecagem. Preparar Docker com containers Linux e executar a cadeia em Supabase local descartável, após apresentar o comando e o escopo. Não substituir os componentes gerenciados pelo fixture portátil nessa homologação.

O último catálogo remoto confirmou authenticated sem SELECT em profiles e privilégios excessivos, inclusive TRUNCATE. A policy de leitura existente não substitui o GRANT. As correções existem localmente; não houve implantação remota neste trabalho.

Após homologação, qualquer correção remota exige autorização explícita, comparação atualizada em modo somente leitura e estratégia própria para o histórico ausente. Apenas então confirmar leitura de perfil no ambiente de destino e liberar integração de autenticação.

**DATABASE VALIDADO: NÃO**, no escopo completo Supabase e ambiente de destino.

**AUTENTICAÇÃO LIBERADA: NÃO.**

O subconjunto PostgreSQL local pode estar aprovado conforme o relatório de execução sem que esses dois critérios globais estejam satisfeitos.
