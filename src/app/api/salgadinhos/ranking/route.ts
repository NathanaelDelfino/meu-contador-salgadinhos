// src/app/api/salgadinhos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/server-db';
import { UserServerData } from '@/types/server';
// UserServerData não é estritamente usado para o corpo de sucesso aqui, então pode ser omitido se não usado.
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

export async function POST(request: NextRequest) {
    console.log("SERVER: API /api/salgadinhos POST endpoint hit");
    try {
        const body = await request.json(); // Isso pode falhar se o corpo não for JSON
        const { userId, userName, count } = body;

        if (!userId || typeof userName !== 'string' || typeof count !== 'number') {
            console.error("SERVER: API Salgadinhos POST: Dados inválidos no body", body);
            return NextResponse.json({ message: 'Dados inválidos: userId, userName (string), e count (number) são obrigatórios.' }, { status: 400 });
        }
        console.log("SERVER: API Salgadinhos POST: Body recebido:", body);

        const allUsersData = await readData();
        const userIndex = allUsersData.findIndex(u => u.id === userId);
        const now = new Date().toISOString();

        if (userIndex > -1) {
            allUsersData[userIndex].count = count;
            allUsersData[userIndex].name = userName;
            allUsersData[userIndex].lastUpdated = now;
            console.log("SERVER: API Salgadinhos POST: Usuário atualizado:", allUsersData[userIndex]);
        } else {
            const newUser = { id: userId, name: userName, count, lastUpdated: now };
            allUsersData.push(newUser);
            console.log("SERVER: API Salgadinhos POST: Novo usuário adicionado:", newUser);
        }

        await writeData(allUsersData);
        console.log("SERVER: API Salgadinhos POST: Dados escritos no arquivo.");

        return NextResponse.json({ message: 'Dados sincronizados com sucesso', userId, userName, count }, { status: 200 });

    } catch (error: any) {
        console.error('SERVER: API Salgadinhos POST Error:', error);
        if (error instanceof SyntaxError && error.message.includes("JSON")) { // Erro ao parsear o JSON do request
            return NextResponse.json({ message: 'Corpo da requisição não é um JSON válido ou está vazio.', details: error.message }, { status: 400 });
        }
        return NextResponse.json({ message: 'Erro interno do servidor ao sincronizar', error: error.message || 'Erro desconhecido' }, { status: 500 });
    }
}