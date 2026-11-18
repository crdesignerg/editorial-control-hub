export class AppError extends Error {
  constructor(message: string, public code = 'UNKNOWN') { super(message); this.name = 'AppError'; }
}
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const code = typeof error === 'object' && error ? String((error as {code?: string}).code ?? '') : '';
  const messages: Record<string, string> = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
    '42501': 'Você não tem permissão para realizar esta operação.',
    '23503': 'Há registros vinculados ou a referência não existe.',
    '23505': 'Já existe um registro com esses dados.',
    '23514': 'Confira os valores informados e seus limites.',
    PGRST116: 'Registro indisponível ou acesso não permitido.',
    P0001: 'A operação foi bloqueada para preservar a segurança administrativa.',
    '40001': 'Outra operação ocorreu ao mesmo tempo. Tente novamente.',
    over_email_send_rate_limit: 'Aguarde antes de solicitar outro e-mail.',
  };
  return messages[code] ?? 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}
