declare module '@wecom/crypto' {
  export function decrypt(encodingAESKey: string, echostr: string): { message: string; id: string; random: string };
  export function getSignature(token: string, timestamp: string, nonce: string, echostr: string): string;
}
