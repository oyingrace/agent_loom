import { authNonceRepository } from "@/lib/repositories";

export async function generateNonce(): Promise<string> {
  return authNonceRepository.generate();
}

export async function verifyNonce(nonce: string): Promise<boolean> {
  return authNonceRepository.consume(nonce);
}

export async function isNonceValid(nonce: string): Promise<boolean> {
  return authNonceRepository.isValid(nonce);
}
