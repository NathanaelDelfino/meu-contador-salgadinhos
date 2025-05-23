// src/components/RankingSalgadinhos.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserServerData } from '@/types/server';

interface RankingSalgadinhosProps {
  currentUserId: string | null; // Para destacar o usuário atual no ranking
  refreshInterval?: number; // Intervalo de atualização em milissegundos
}

export default function RankingSalgadinhos({ currentUserId, refreshInterval = 5000 }: RankingSalgadinhosProps) {
  const [ranking, setRanking] = useState<UserServerData[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState<boolean>(true); // Começa carregando

  const fetchRanking = useCallback(async () => {
    // Não seta isLoadingRanking para true aqui para evitar piscar a cada atualização,
    // a menos que seja a primeira carga. O estado de loading inicial já cuida disso.
    // Se for a primeira carga, isLoadingRanking já é true.
    let response;
    try {
      // console.log("RANKING_COMPONENT: Fetching ranking...");
      response = await fetch('/api/salgadinhos/ranking?limit=10');
      const responseText = await response.text();

      if (!response.ok) {
        console.error(`RANKING_COMPONENT: Fetch ranking not ok. Status: ${response.status}. Body:`, responseText);
        // Mantém o ranking anterior em caso de falha na atualização para não limpar a tela
        // setRanking([]);
        return; // Retorna para não tentar parsear
      }

      if (response.headers.get("content-type")?.includes("application/json")) {
        const data: UserServerData[] = JSON.parse(responseText);
        setRanking(data);
      } else {
        console.warn("RANKING_COMPONENT: Ranking response was OK but not JSON. Body:", responseText);
        // setRanking([]); // Mantém o ranking anterior
      }
    } catch (error) {
      console.error("RANKING_COMPONENT: Error in fetchRanking:", error);
      if (response && !response.headers.get("content-type")?.includes("application/json")) {
        console.error("RANKING_COMPONENT: Server returned non-JSON for ranking. Check server logs.");
      }
      // setRanking([]); // Mantém o ranking anterior
    } finally {
      // Só para de carregar na primeira vez
      if (isLoadingRanking) {
          setIsLoadingRanking(false);
      }
    }
  }, [isLoadingRanking]); // Adicionado isLoadingRanking para a lógica do finally

  // Efeito para buscar o ranking na montagem e configurar o intervalo de atualização
  useEffect(() => {
    fetchRanking(); // Busca inicial

    if (refreshInterval > 0) {
      const intervalId = setInterval(() => {
        // console.log("RANKING_COMPONENT: Interval fetching ranking...");
        fetchRanking();
      }, refreshInterval);

      // Limpa o intervalo quando o componente é desmontado
      return () => clearInterval(intervalId);
    }
  }, [fetchRanking, refreshInterval]); // Depende de fetchRanking e refreshInterval

  return (
    <div className="bg-white p-6 rounded-xl shadow-2xl">
      <h2 className="text-2xl font-bold text-orange-600 mb-6 text-center">🏆 Ranking dos Comilões 🏆</h2>
      {isLoadingRanking ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
          <p className="text-gray-500">Carregando ranking...</p>
        </div>
      ) : ranking.length > 0 ? (
        <ol className="space-y-3 list-decimal list-inside">
          {ranking.map((user, index) => (
            <li
              key={user.id}
              className={`
                p-3 rounded-lg transition-all duration-300 ease-in-out
                ${user.id === currentUserId ? 'bg-orange-100 ring-2 ring-orange-400 shadow-md scale-105' : 'bg-gray-50 hover:bg-gray-100'}
              `}
            >
              <span className="font-semibold">{index + 1}. {user.name}</span>
              <span className="float-right bg-orange-500 text-white text-sm font-bold px-2 py-1 rounded-full">
                {user.count}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-gray-500 text-center py-4">Ninguém no ranking ainda. Seja o primeiro!</p>
      )}
    </div>
  );
}