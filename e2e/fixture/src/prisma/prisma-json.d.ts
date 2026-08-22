// The file a prisma-json-types-generator user already has. It is not changed for Prisma 8; the
// extension references these types by name and the emitted contract.d.ts resolves them from here.
declare global {
  namespace PrismaJson {
    interface Settings {
      theme: 'light' | 'dark';
      digestHour?: number;
      tags: string[];
    }
  }
}
export {};
