/**
 * Contexto de autenticação de uma requisição.
 *
 * Contém a identidade verificada do cliente/dispositivo.
 * O deviceId aqui é a fonte da verdade - não se deve confiar
 * no deviceId enviado no body da operação.
 */
export interface AuthContext {
  readonly clientId: string;
  readonly deviceId: string;
}