// src/lib/db.ts
const DB_NAME = 'SalgadinhoContadorDB_v3'; // Mantenha ou incremente se fizer mudanças de schema
const DB_VERSION = 1; // Incremente se mudar a estrutura das stores
const STORE_NAME = 'contadoresPorUsuario';

interface UserCounterData {
    id: string; // Este é o userId (GUID)
    count: number;
    // name?: string; // Opcional: se quiser salvar o nome também no IndexedDB
}

let db: IDBDatabase | null = null;

// Função para abrir/inicializar o banco de dados
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        // Se já temos uma conexão e a versão é a correta, reutilize-a
        if (db && db.objectStoreNames.contains(STORE_NAME) && db.version === DB_VERSION) {
            // console.log("Reutilizando conexão IndexedDB existente.");
            resolve(db);
            return;
        }

        // Verifica se estamos no ambiente do navegador
        if (typeof window === 'undefined') {
            console.warn("IndexedDB não está disponível fora do navegador.");
            // Rejeita a promessa para que as funções chamadoras possam tratar isso
            reject(new Error("IndexedDB não está disponível fora do navegador."));
            return;
        }

        console.log(`Tentando abrir IndexedDB '${DB_NAME}' v${DB_VERSION}...`);
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            const error = (event.target as IDBOpenDBRequest).error;
            console.error("Erro ao abrir o IndexedDB:", error);
            reject(new Error(`Erro ao abrir o IndexedDB: ${error?.message || 'Erro desconhecido'}`));
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result;
            console.log(`IndexedDB '${DB_NAME}' v${db.version} aberto com sucesso.`);
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log(`Atualizando IndexedDB para '${DB_NAME}' v${DB_VERSION} (versão antiga: ${event.oldVersion})...`);
            const tempDb = (event.target as IDBOpenDBRequest).result;
            if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
                console.log(`Criando object store '${STORE_NAME}' com keyPath 'id'.`);
                tempDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
            } else {
                console.log(`Object store '${STORE_NAME}' já existe.`);
                // Se você precisar limpar a store antiga e recriar (por exemplo, mudou o keyPath)
                // tempDb.deleteObjectStore(STORE_NAME);
                // tempDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onblocked = (event) => {
            // Isso geralmente acontece se há outras abas abertas com uma conexão antiga
            // que está impedindo a atualização da versão do banco de dados.
            console.warn("Abertura do IndexedDB bloqueada. Por favor, feche outras abas com esta aplicação e tente novamente.", event);
            reject(new Error("Abertura do IndexedDB bloqueada. Feche outras abas desta aplicação."));
        };
    });
};

// Função para obter a contagem
export const getSalgadinhoCountForUser = async (userId: string): Promise<number> => {
    if (typeof window === 'undefined' || !userId) {
        // console.log("getSalgadinhoCountForUser: Abortando - Sem window ou userId.");
        return 0;
    }

    // console.log(`getSalgadinhoCountForUser: Buscando para userId: ${userId}`);
    try {
        const currentDb = await openDB();
        return new Promise((resolve, reject) => {
            if (!currentDb) { // Defesa extra, openDB() deveria rejeitar se não conseguir
                reject(new Error("Banco de dados não inicializado para get."));
                return;
            }
            if (!currentDb.objectStoreNames.contains(STORE_NAME)) {
                console.error(`getSalgadinhoCountForUser: Object store '${STORE_NAME}' não encontrado.`);
                reject(new Error(`Object store '${STORE_NAME}' não encontrado.`));
                return;
            }

            const transaction = currentDb.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(userId);

            request.onerror = (event) => {
                const error = (event.target as IDBRequest).error;
                console.error("Erro ao buscar contagem para o usuário:", userId, error);
                reject(new Error(`Erro ao buscar contagem para ${userId}: ${error?.message || 'Erro desconhecido'}`));
            };

            request.onsuccess = (event) => {
                const result = (event.target as IDBRequest<UserCounterData | undefined>).result;
                // console.log(`Contagem buscada para ${userId}:`, result);
                resolve(result ? result.count : 0); // Retorna 0 se não encontrado
            };
        });
    } catch (error) {
        console.error(`Exceção ao tentar obter contagem para ${userId}:`, error);
        return 0; // Retorna um valor padrão seguro em caso de erro na abertura do DB
    }
};

// Função para salvar/atualizar a contagem
export const saveSalgadinhoCountForUser = async (userId: string, count: number): Promise<void> => {
    if (typeof window === 'undefined' || !userId) {
        // console.log("saveSalgadinhoCountForUser: Abortando - Sem window ou userId.");
        return;
    }

    // console.log(`saveSalgadinhoCountForUser: Salvando ${count} para userId: ${userId}`);
    try {
        const currentDb = await openDB();
        return new Promise<void>((resolve, reject) => { // Explicitando Promise<void>
            if (!currentDb) {
                reject(new Error("Banco de dados não inicializado para save."));
                return;
            }
            if (!currentDb.objectStoreNames.contains(STORE_NAME)) {
                console.error(`saveSalgadinhoCountForUser: Object store '${STORE_NAME}' não encontrado.`);
                reject(new Error(`Object store '${STORE_NAME}' não encontrado.`));
                return;
            }

            const transaction = currentDb.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const dataToStore: UserCounterData = { id: userId, count: count };
            // Se você decidir salvar o nome no IndexedDB também:
            // dataToStore.name = userName; // Você precisaria passar userName para esta função

            const request = store.put(dataToStore);

            request.onerror = (event) => {
                const error = (event.target as IDBRequest).error;
                console.error("Erro ao salvar contagem para o usuário:", userId, error);
                reject(new Error(`Erro ao salvar contagem para ${userId}: ${error?.message || 'Erro desconhecido'}`));
            };

            request.onsuccess = () => {
                // console.log(`Contagem ${count} salva para ${userId}.`);
                resolve();
            };
        });
    } catch (error) {
        console.error(`Exceção ao tentar salvar contagem para ${userId}:`, error);
        // Não relança para não quebrar a UI, mas o erro foi logado.
    }
};