declare module 'solc' {
  interface CompilerInput {
    language: string;
    sources: Record<string, { content: string }>;
    settings: Record<string, unknown>;
  }
  interface CompilerOutput {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
  }
  function compile(input: string): string;
  export = { compile };
}
