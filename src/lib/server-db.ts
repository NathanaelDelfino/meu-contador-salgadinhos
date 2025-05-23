import fs from 'fs/promises';
import path from 'path';
import { UserServerData } from '@/types/server';

const dataFilePath = path.join(process.cwd(), 'data', 'salgadinhos.json');

export async function readData(): Promise<UserServerData[]> {
    try {
        // Garante que a pasta 'data' exista antes de tentar ler
        // Isso é mais relevante para a escrita, mas pode ajudar em cenários de primeiro uso
        const dataDir = path.dirname(dataFilePath);
        try {
            await fs.access(dataDir);
        } catch {
            console.log(`Pasta de dados ${dataDir} não encontrada, criando...`);
            await fs.mkdir(dataDir, { recursive: true });
        }

        const jsonData = await fs.readFile(dataFilePath, 'utf-8');
        return JSON.parse(jsonData) as UserServerData[];
    } catch (error: any) {
        // Se o erro for ENOENT (arquivo não encontrado), é normal na primeira vez, retorna array vazio.
        if (error.code === 'ENOENT') {
            console.log(`Arquivo ${dataFilePath} não encontrado, retornando array vazio (normal na primeira execução).`);
            return [];
        }
        // Para outros erros de leitura, loga e retorna array vazio.
        console.error("Erro ao ler data.json:", error.message, error.code ? `(Code: ${error.code})` : '');
        return [];
    }
}

export async function writeData(data: UserServerData[]): Promise<void> {
    try {
        // Garante que a pasta 'data' exista antes de tentar escrever
        const dataDir = path.dirname(dataFilePath);
        try {
            await fs.access(dataDir);
        } catch {
            console.log(`Pasta de dados ${dataDir} não encontrada, criando...`);
            await fs.mkdir(dataDir, { recursive: true });
        }

        const jsonData = JSON.stringify(data, null, 2);
        await fs.writeFile(dataFilePath, jsonData, 'utf-8');
        console.log(`Dados escritos com sucesso em ${dataFilePath}`);
    } catch (error: any) { // Especificar 'any' para acessar error.code e error.message
        console.error("--------------------------------------------------");
        console.error("### ERRO DETALHADO AO ESCREVER EM data.json ###");
        console.error("Caminho do arquivo:", dataFilePath);
        console.error("Tipo de Erro:", error.name);
        console.error("Mensagem do Erro:", error.message);
        if (error.code) {
            console.error("Código do Erro do Sistema:", error.code);
        }
        if (error.syscall) {
            console.error("Chamada de Sistema:", error.syscall);
        }
        console.error("Stack do Erro:", error.stack);
        console.error("--------------------------------------------------");
        throw new Error(`Não foi possível salvar os dados no servidor. Detalhes: ${error.message}`);
    }
}