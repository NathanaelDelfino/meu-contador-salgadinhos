// src/app/api/salgadinhos/ranking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readData } from '@/lib/server-db';
import { UserServerData } from '@/types/server';

export async function GET(request: NextRequest) { // A função DEVE se chamar GET
  console.log("SERVER: API /api/salgadinhos/ranking GET endpoint hit");
  try {
    const allUsersData: UserServerData[] = await readData();
    // console.log("SERVER: API Ranking GET: Dados lidos, total de usuários:", allUsersData.length);

    const rankedUsers: UserServerData[] = [...allUsersData].sort((a, b) => {
      if (b.count === a.count) {
        return a.name.localeCompare(b.name);
      }
      return b.count - a.count;
    });

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const result: UserServerData[] = limit ? rankedUsers.slice(0, limit) : rankedUsers;
    // console.log("SERVER: API Ranking GET: Ranking processado, enviando", result.length, "usuários.");

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error('SERVER: API Salgadinhos Ranking GET Error:', error);
    return NextResponse.json({ message: 'Erro interno do servidor ao buscar ranking', error: error.message || 'Erro desconhecido' }, { status: 500 });
  }
}

// Você NÃO DEVE ter outras funções exportadas com nomes de métodos HTTP aqui
// a menos que você queira suportá-los (ex: POST, PUT, etc., para este endpoint específico).
// Se houver uma função POST aqui por engano, e o Next.js tentar usá-la para GET, pode dar problema.