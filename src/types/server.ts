// src/types/server.ts
export interface UserServerData {
    id: string;        // AGORA SERÁ O GUID
    name: string;      // nome original do usuário, ex: "João Silva"
    count: number;
    lastUpdated: string; // ISO string da última atualização
}