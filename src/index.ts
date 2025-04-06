import { Server } from 'socket.io';
import { createServer } from 'http';
import express, {Request, Response} from 'express';
import { GameRoom } from './types/gameRoomType';
import {  Player } from './types/playerType';
import { BingoNumber } from './types/bingoNumberType';
import { BingoWinner } from './types/bingoWinnerType';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

let room: GameRoom | null = null;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())

app.post('/room', (req: Request, res: Response): any => {
  const { roomId, playerName } = req.body;
  console.log(req.body)
  if (!roomId || !playerName) {
    return res.status(400).json({ error: 'ID de sala y nombre de jugador son requeridos' });
  }

  let isHost: boolean = playerName === 'host'

  try{
    const player: Player = {
      id: '',
      name: playerName,
      isHost: isHost
    };
  
    if(isHost){
      room = {
        id: roomId,
        players: [],
        calledNumbers: [],
        currentNumber: null,
        winners: [],
        status: 'waiting'
      };
    }
    
    return res.status(200).json({ success: true, player: player, roomId: room?.id });
  } catch(err){
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    console.log(errorMessage)
    return res.status(400).json({ error: err});  
  }

})

io.on('connection', (socket) => {
  console.log(`🔌 Nuevo cliente conectado: ${socket.id}`);

  // Unirse o crear sala
  socket.on('join_room', (roomId: string, player: Player, callback: (response: {
    success: boolean;
    isHost?: boolean;
    error?: string;
    room?: GameRoom | null;
    player?: Player;
  }) => void) => {
    try {
      console.log(`🛋 ${player.name} intenta unirse a la sala ${roomId}`);
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
      console.log(`🎮 ${playerMatch.name} se unió a la sala ${roomId}`);

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
      console.log(`🚀 Juego iniciado en sala ${roomId}`);

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`❌ Error en start_game: ${errorMessage}`);
      socket.emit('error', errorMessage);
    }
  });

  // Llamar número (solo host)
  socket.on('call_number', (roomId: string, number: BingoNumber) => {
    try {
      if (!room) throw new Error('Sala no encontrada');

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) throw new Error('Solo el host puede llamar números');

      room.calledNumbers.push(number);
      room.currentNumber = number;
      
      io.to(roomId).emit('number_called', number);
      io.to(roomId).emit('room_update', room);
      console.log(`🔢 Número llamado en ${roomId}: ${number.letter}-${number.number}`);

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
        console.log(`⚠ El jugador ${socket.id} ya reclamó BINGO anteriormente`);
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

        console.log(room.winners.length)

        if(room.winners.length === 2){
          room.status = 'finished';
          console.log('Ya hay dos ganadores, el juego ha terminado')
        }
  
        io.to(roomId).emit('bingo_claimed', { winner });
        io.to(roomId).emit('room_update', room);
        console.log(`🎉 BINGO válido por ${player.name} (${socket.id})`);
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
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
    
      if (!room) return;

      const initialCount = room.players.length;

      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length !== initialCount) {
        // Si era el host, asignar nuevo host
        if (room.players.length > 0 && !room.players.some(p => p.isHost)) {
          room.players[0].isHost = true;
        }
        // Eliminar sala si está vacía
        if (room.players.length === 0) {
          console.log(`🗑 Sala ${room.id} eliminada (vacía)`);
        } else {
          io.to(room.id).emit('room_update', room);
        }
      }

  });

  // Manejar errores
  socket.on('error', (error) => {
    console.error(`⚠ Error en cliente ${socket.id}: ${error}`);
  });
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Apagando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});