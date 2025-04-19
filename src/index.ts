import express, {Request, Response} from 'express';
import { GameRoom } from './types/gameRoomType';
import {  Player } from './types/playerType';
import { BingoNumber } from './types/bingoNumberType';
import { AuthenticatedSocket } from './types/authenticatedSocketType';
import cors from 'cors';
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto';
import { checkHost } from './utils/checkHost';
import 'dotenv/config';

import { initializeServer } from './config/socket';
import { readJsonFile, writeJsonFile } from './utils/jsonReader';

const {app, io, httpServer} = initializeServer();
const PORT = process.env.PORT
const SECRET_KEY = process.env.SECRET_KEY

if (!SECRET_KEY) {
  throw new Error("La variable de entorno SECRET_KEY no está definida");
}

let room: GameRoom | null = null;

const roomId = randomUUID();

async function initRoom(roomId: string) {
  const calledNumbers: BingoNumber[] = await readJsonFile();

  room = {
    id: roomId,
    players: [],
    calledNumbers,
    currentNumber: null,
    winners: [],
    status: 'waiting'
  };

  return room;
}

initRoom(roomId)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.post('/room', (req: Request, res: Response): any => {
  const { playerName } = req.body;
  if (!playerName) {
    return res.status(400).json({ error: 'ID de sala y nombre de jugador son requeridos' });
  }

  const token = jwt.sign({ playerName }, SECRET_KEY, { expiresIn: '4h' });


  let isHost = checkHost(playerName)

  try{
    const player: Player = {
      id: '',
      name: playerName,
      isHost: isHost
    };   
    return res.status(200).json({ success: true, player: player, roomId: room?.id, token: token });
  } catch(err){
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    console.log(errorMessage)
    return res.status(400).json({ error: err});  
  }

})

io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth.token;
  if(!token){
      return next(new Error('Authentication is required'))
  }
  try {
      const decoded = jwt.verify(token, SECRET_KEY);
      socket.user = decoded
      next()
  } catch (err) {
      return next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  // Unirse o crear sala
  socket.on('join_room', (roomId: string, player: Player, callback: (response: {
    success: boolean;
    isHost?: boolean;
    error?: string;
    room?: GameRoom | null;
    player?: Player;
  }) => void) => {
    try {
      if (!roomId || !player.name ) {
        throw new Error('Se requieren ID de sala y nombre de jugador');
      }

      const playerMatch: Player = {
        id: socket.id,
        name: player.name,
        isHost: player.isHost || false
      };

      room?.players.push(playerMatch);
      socket.join(roomId);

      callback({
        success: true,
        isHost: playerMatch.isHost,
        room: room,
        player: playerMatch
      });

      io.to(roomId).emit('room_update', room);

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        console.error(`❌ Error en join_room: ${errorMessage}`);
      callback({
        success: false,
        error: errorMessage
      });
    }
  });

  // Iniciar juego (solo host)
  socket.on('start_game', (roomId: string) => {
    try {
      if (!room) throw new Error('Sala no encontrada');

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) throw new Error('Solo el host puede iniciar el juego');

      room.status = 'playing';
      io.to(roomId).emit('game_started', room);

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`❌ Error en start_game: ${errorMessage}`);
      socket.emit('error', errorMessage);
    }
  });

  socket.on("changeIdRoom", (roomId: string) => {
    if(room){
      room.id = roomId;
    }
    io.to(roomId).emit('room_update', room);
  })

  // Llamar número (solo host)
  socket.on('call_number', async (roomId: string, number: BingoNumber) => {
    try {
      if (!room) throw new Error('Sala no encontrada');
  
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) throw new Error('Solo el host puede llamar números');
  
      room.calledNumbers.push(number);
      room.currentNumber = number;
  
      io.to(roomId).emit('number_called', number);
      io.to(roomId).emit('room_update', room);
  
      // Verificar si se han llamado todos los números
      if (room.calledNumbers.length >= 75) {
        room.status = 'finished';
        io.to(roomId).emit('game_finished');
      }
  
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`❌ Error en call_number: ${errorMessage}`);
      socket.emit('error', errorMessage);
    }
  });
  

  // Cantar BINGO
  socket.on('claim_bingo', (roomId: string, pattern: string, callback?: (valid: boolean) => void) => {
    try {
      if (!room) throw new Error('Sala no encontrada');
      
      // Verificar si este socket (jugador) ya está en la lista de ganadores
      const alreadyWon = room.winners.some(winner => winner.playerId === socket.id);
      if (alreadyWon) {
        if (callback) callback(false);
        return;
      }
  
      const player = room.players.find(p => p.id === socket.id);
      if (!player) throw new Error('Jugador no encontrado');
  
      const isValidBingo = validateBingo(room, socket.id, pattern);
  
      if (isValidBingo) {
        
  
        const winner = {
          playerId: socket.id,  // Usamos el socket.id como identificador único
          playerName: player.name,
          pattern: pattern
        };
        
        room.winners.push(winner);

        // if(room.winners.length === 2){
        //   room.status = 'finished';
        //   console.log('Ya hay dos ganadores, el juego ha terminado')
        // }

        room.status = 'finished';
  
        io.to(roomId).emit('bingo_claimed', { winner });
        io.to(roomId).emit('room_update', room);
      } else {
        console.log(`⚠ Intento de BINGO inválido por ${player.name}`);
      }
  
      if (callback) callback(isValidBingo);
  
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`❌ Error en claim_bingo: ${errorMessage}`);
      if (callback) callback(false);
    }
  });

  socket.on('reset_bingo', (roomId: string) => {
    if (!room) return;
    room.calledNumbers = [];
    room.currentNumber = null;
    room.status = 'waiting';
    io.to(roomId).emit('bingo_claimed', null)
    io.to(roomId).emit('room_update', room);
  })
  
  // Función de ejemplo para validar BINGO
  function validateBingo(room: GameRoom, playerId: string, pattern: string): boolean {
    // Implementa tu lógica real de validación aquí
    return true; // Simplificado para el ejemplo
  }

  // Manejar desconexión
  socket.on('disconnect', () => {
    if (!room) return;
  
    const initialCount = room.players.length;
  
    room.players = room.players.filter(p => p.id !== socket.id);
  
    if (room.players.length !== initialCount) {
      // Solo emitimos la actualización, pero NO eliminamos la sala
      io.to(room.id).emit('room_update', room);

    }
  });
  

  // Manejar errores
  socket.on('error', (error) => {
    console.error(`⚠ Error en cliente ${socket.id}: ${error}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Apagando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});
