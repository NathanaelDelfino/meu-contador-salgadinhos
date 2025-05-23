'use client';

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSalgadinhoCountForUser, saveSalgadinhoCountForUser } from '@/lib/db';
import { UserServerData } from '@/types/server';

const USER_ID_STORAGE_KEY = 'salgadinhosContadorUserId';
const USER_NAME_STORAGE_KEY = 'salgadinhosContadorUserName';

export default function HomePage() {
  // 1. ESTADOS
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [inputName, setInputName] = useState<string>('');

  const [quantidadeSalgadinhos, setQuantidadeSalgadinhos] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading principal para dados do usuário
  const hasLoadedFromDB = useRef(false);

  const [ranking, setRanking] = useState<UserServerData[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState<boolean>(false); // Loading específico para o ranking

  // 2. DEFINIÇÃO DE fetchRanking
  const fetchRanking = useCallback(async () => {
    setIsLoadingRanking(true);
    let response;
    try {
      response = await fetch('/api/salgadinhos/ranking?limit=10');
      const responseText = await response.text();

      if (!response.ok) {
        console.error(`CLIENT: Fetch ranking not ok. Status: ${response.status}. Response body:`, responseText);
        throw new Error(`Falha ao buscar ranking. Status: ${response.status}`);
      }

      if (response.headers.get("content-type")?.includes("application/json")) {
        const data: UserServerData[] = JSON.parse(responseText);
        setRanking(data);
      } else {
        console.warn("CLIENT: Ranking response was OK but not JSON. Body:", responseText);
        setRanking([]);
      }
    } catch (error) {
      console.error("CLIENT: Error in fetchRanking:", error);
      if (response && !response.headers.get("content-type")?.includes("application/json")) {
        console.error("CLIENT: Server returned non-JSON for ranking. Check server logs.");
      }
      setRanking([]);
    } finally {
      setIsLoadingRanking(false);
    }
  }, []); // Setters são estáveis

  // 3. DEFINIÇÃO DE syncWithServer
  const syncWithServer = useCallback(async (currentUserId: string, currentUserName: string, currentCount: number) => {
    if (!currentUserId || !currentUserName) return;
    let response;
    try {
      response = await fetch('/api/salgadinhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, userName: currentUserName, count: currentCount }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        console.error(`CLIENT: Sync with server not ok. Status: ${response.status}. Response body:`, responseText);
        return;
      }

      // Opcional: logar resposta JSON se houver
      if (response.headers.get("content-type")?.includes("application/json") && responseText.trim() !== "") {
        try { JSON.parse(responseText); /* console.log('CLIENT: Sync JSON response:', data); */ }
        catch (e) { /* console.warn('CLIENT: Sync response not parsable JSON:', responseText); */ }
      }

      fetchRanking(); // Chama fetchRanking que já está definida
    } catch (error) {
      console.error('CLIENT: Falha na requisição de sincronização:', error);
      if (response && !response.headers.get("content-type")?.includes("application/json")) {
        console.error("CLIENT: Server returned non-JSON for sync. Check server logs.");
      }
    }
  }, [fetchRanking]); // Depende de fetchRanking

  // 4. useEffect: Carregar usuário do localStorage e buscar ranking inicial
  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
    const storedUserName = localStorage.getItem(USER_NAME_STORAGE_KEY);

    if (storedUserId && storedUserName) {
      setUserId(storedUserId);
      setUserName(storedUserName);
      // O próximo useEffect cuidará de carregar os dados do usuário
    } else {
      setIsLoading(false); // Se não há usuário, não há dados do usuário para carregar
    }
    fetchRanking(); // Busca ranking na montagem
  }, [fetchRanking]); // Depende de fetchRanking

  // 5. useEffect: Carregar dados do usuário (IndexedDB) e sincronizar com servidor
  useEffect(() => {
    if (!userId || !userName) {
      // Se não há usuário (ou está deslogando), reseta contagem e para loading de dados do usuário.
      setQuantidadeSalgadinhos(0);
      hasLoadedFromDB.current = false;
      // setIsLoading(false) é chamado no useEffect anterior se não houver usuário,
      // ou no finally deste useEffect.
      return;
    }

    setIsLoading(true); // Inicia loading para dados do usuário
    hasLoadedFromDB.current = false;

    const loadInitialUserData = async () => {
      try {
        const savedCount = await getSalgadinhoCountForUser(userId);
        setQuantidadeSalgadinhos(savedCount);
        hasLoadedFromDB.current = true;

        // Sincroniza o estado atual (que pode ser 0 para novo usuário ou o valor do IndexedDB)
        // Isso também garante que o servidor tenha o nome correto associado ao GUID
        await syncWithServer(userId, userName, savedCount);
      } catch (error) {
        console.error(`Falha ao carregar/sincronizar dados para ${userName} (${userId}):`, error);
      } finally {
        setIsLoading(false); // Termina loading dos dados do usuário
      }
    };

    loadInitialUserData();
  }, [userId, userName, syncWithServer]); // Depende de userId, userName, e syncWithServer

  // 6. useEffect: Salvar no IndexedDB e sincronizar quando a quantidade muda
  useEffect(() => {
    // Só executa se o usuário estiver logado, não estiver carregando, e os dados do DB local já foram carregados.
    // Isso previne salvar o '0' inicial do useState antes de carregar o valor real do IndexedDB.
    if (userId && userName && !isLoading && hasLoadedFromDB.current) {
      saveSalgadinhoCountForUser(userId, quantidadeSalgadinhos)
        .then(() => {
          return syncWithServer(userId, userName, quantidadeSalgadinhos);
        })
        .catch(error => console.error(`Falha ao salvar/sincronizar quantidade para ${userName} (${userId}):`, error));
    }
  }, [quantidadeSalgadinhos, userId, userName, isLoading, syncWithServer]); // Depende de todos esses valores

  // 7. MANIPULADORES DE EVENTOS
  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = inputName.trim();
    if (trimmedName) {
      const newUserId = uuidv4();
      // Define userId e userName, o que disparará o useEffect de carregar dados do usuário
      setUserId(newUserId);
      setUserName(trimmedName);
      localStorage.setItem(USER_ID_STORAGE_KEY, newUserId);
      localStorage.setItem(USER_NAME_STORAGE_KEY, trimmedName);
      setInputName(''); // Limpa o input após o submit
    }
  };

  const adicionarSalgadinho = () => {
    if (quantidadeSalgadinhos <= 50) 
    setQuantidadeSalgadinhos(prevQuantidade => prevQuantidade + 1);
  };

  const removerSalgadinho = () => {
    if (quantidadeSalgadinhos <= 50) 
    setQuantidadeSalgadinhos(prevQuantidade => Math.max(0, prevQuantidade - 1));
  };

  const handleChangeUser = () => {
    localStorage.removeItem(USER_ID_STORAGE_KEY);
    localStorage.removeItem(USER_NAME_STORAGE_KEY);
    setUserId(null); // Dispara reset nos useEffects dependentes
    setUserName(null);
    setInputName('');
    // quantidadeSalgadinhos será resetado pelo useEffect de loadInitialUserData quando userId/userName se tornam null
    // isLoading será gerenciado pelos useEffects
    // fetchRanking ainda pode ser chamado pelo useEffect de montagem para manter o ranking visível
  };

  // JSX ...
  // ---------- RENDERIZAÇÃO ----------

  // Se não tem userId, mostra o formulário de nome
  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-600 p-8">
        <div className="bg-white p-10 rounded-xl shadow-2xl w-full max-w-md text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700 mb-6">
            Quem está contando os salgadinhos?
          </h1>
          <form onSubmit={handleNameSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Seu nome:
              </label>
              <input
                type="text"
                id="name"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg text-black"
                placeholder="Ex: Gulosinho Anônimo"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-md transform transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-300"
            >
              Começar a Contar!
            </button>
          </form>
        </div>
        {/* Ranking visível mesmo sem login */}
        <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-2xl">
          <h2 className="text-2xl font-bold text-orange-600 mb-6 text-center">🏆 Ranking dos Comilões T🏆</h2>
          {isLoadingRanking ? (
            <p className="text-black-500 text-center">Carregando ranking...</p>
          ) : ranking.length > 0 ? (
            <ol className="space-y-3 list-decimal list-inside">
              {ranking.map((user, index) => (
                <li key={user.id} className={`p-3 rounded-lg bg-black-50`}>
                  <span className="font-semibold text-blue-900 ">{index + 1}. {user.name}</span>
                  <span className="float-right bg-orange-500 text-white text-sm font-bold px-2 py-1 rounded-full">
                    {user.count}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-500 text-center">Ninguém no ranking ainda. Seja o primeiro!</p>
          )}
        </div>
        <footer className="mt-12 text-sm text-white opacity-75">
          Contador de Salgadinhos v3.1
        </footer>
      </main>
    );
  }

  // Se tem userId (e portanto userName), mostra o carregamento ou o contador
  // isLoading aqui se refere ao carregamento dos dados DO USUÁRIO (contagem), não do ranking.
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-400 to-yellow-300 p-8">
        <div className="bg-white p-10 rounded-xl shadow-2xl text-center">
          <h1 className="text-3xl font-bold text-orange-600">
            Buscando os salgadinhos de {userName}... 🍪
          </h1>
          <div className="mt-6 animate-spin rounded-full h-12 w-12 border-b-4 border-orange-500 mx-auto"></div>
        </div>
      </main>
    );
  }

  // Contador e Ranking principal
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-400 to-yellow-300 p-4 md:p-8">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <div className="md:col-span-2 bg-white p-6 md:p-10 rounded-xl shadow-2xl transform transition-all hover:scale-105">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg md:text-xl text-gray-700">
              Olá, <span className="font-semibold text-orange-600">{userName}!</span>
            </h2>
            <button
              onClick={handleChangeUser}
              className="text-sm text-indigo-600 hover:text-indigo-800 underline"
            >
              Trocar Usuário
            </button>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-orange-600 mb-4 text-center">
            Contador de Salgadinhos 😋
          </h1>

          <div className="my-8 md:my-10 text-center">
            <p className="text-7xl md:text-8xl lg:text-9xl font-extrabold text-orange-500 drop-shadow-lg">
              {quantidadeSalgadinhos}
            </p>
            <p className="text-lg md:text-xl text-gray-600 mt-2">
              {quantidadeSalgadinhos === 1 ? "salgadinho comido!" : "salgadinhos comidos!"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 md:gap-6">
            <button
              onClick={adicionarSalgadinho}
              className="
                w-full sm:w-auto
                bg-green-500 hover:bg-green-600
                text-white font-bold
                py-3 px-8 md:py-4 md:px-10 text-xl md:text-2xl
                rounded-lg shadow-lg
                transform transition-all hover:scale-110 active:scale-95
                focus:outline-none focus:ring-4 focus:ring-green-300
                "
            >
              +1 Salgadinho
            </button>

            <button
              onClick={removerSalgadinho}
              disabled={quantidadeSalgadinhos === 0}
              className={`
                w-full sm:w-auto
                bg-red-500 hover:bg-red-600
                text-white font-semibold
                py-2 px-6 md:py-3 md:px-8 text-lg md:text-xl
                rounded-lg shadow-md
                transform transition-all hover:scale-105 active:scale-90
                focus:outline-none focus:ring-4 focus:ring-red-300
                ${quantidadeSalgadinhos === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
              -1 Salgadinho
            </button>
          </div>

          {quantidadeSalgadinhos > 35 && quantidadeSalgadinhos < 39  && (
            <p className="mt-8 text-center text-lg text-yellow-700 animate-bounce">
              Quase lá hein 😉
            </p>
          )}

          {quantidadeSalgadinhos > 39 && (
            <p className="mt-8 text-center text-lg text-yellow-700 animate-bounce">
              Acho que já deu por hoje, hein? 😉
            </p>
          )}
          {quantidadeSalgadinhos > 40 && (
            <p className="mt-2 text-center text-lg text-red-700 font-bold">
              🚨 ALERTA GULOSO! 🚨
            </p>
          )}
        </div>

        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-2xl">
          <h2 className="text-2xl font-bold text-orange-600 mb-6 text-center">🏆 Ranking dos Comilões do Salgadinho 🏆</h2>
          {isLoadingRanking ? (
            <p className="text-gray-500 text-center">Carregando ranking...</p>
          ) : ranking.length > 0 ? (
            <ol className="space-y-3 list-decimal list-inside">
              {ranking.map((user, index) => (
                <li key={user.id} className={`p-3 rounded-lg ${user.id === userId ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-50'}`}>
                  <span className="font-semibold text-black">{index + 1}. {user.name}</span>
                  <span className="float-right bg-orange-500 text-white text-sm font-bold px-2 py-1 rounded-full">
                    {user.count}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-500 text-center">Ninguém no ranking ainda. Seja o primeiro!</p>
          )}
        </div>
      </div>
      <footer className="mt-12 text-sm text-white opacity-75 text-center w-full pb-8">
        Contador de Salgadinhos v3.1
      </footer>
    </main>
  );
}