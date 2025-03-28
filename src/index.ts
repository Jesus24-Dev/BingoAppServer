import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';

// Tipos TypeScript
type Player = {
  id: string;
  name: string;
  isHost: boolean;
};

type BingoNumber = {
  number: number;
  letter: 'B' | 'I' | 'N' | 'G' | 'O';
};

type GameRoom = {
  id: string;
  players: Player[];
  calledNumbers: BingoNumber[];
  currentNumber: BingoNumber | null;
  status: 'waiting' | 'playing' | 'finished';
};

// Configuración del servidor
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
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutos
    skipMiddlewares: true
  }
});

// Almacenamiento en memoria (en producción usa Redis)
const rooms = new Map<string, GameRoom>();

// Eventos de conexión
io.on('connection', (socket) => {
  console.log(`🔌 Nuevo cliente conectado: ${socket.id}`);

  // Unirse o crear sala
  socket.on('join_room', (roomId: string, playerName: string, callback: (response: {
    success: boolean;
    isHost?: boolean;
    error?: string;
    room?: GameRoom;
  }) => void) => {
    try {
      if (!roomId || !playerName) {
        throw new Error('Se requieren ID de sala y nombre de jugador');
      }

      let room = rooms.get(roomId);
      const isHost = !room;

      // Crear nueva sala si no existe
      if (!room) {
        room = {
          id: roomId,
          players: [],
          calledNumbers: [],
          currentNumber: null,
          status: 'waiting'
        };
        rooms.set(roomId, room);
        console.log(`🏠 Nueva sala creada: ${roomId}`);
      }

      // Validar estado de la sala
      if (room.status === 'playing') {
        throw new Error('La partida ya está en curso');
      }

      if (room.players.length >= 15) {
        throw new Error('La sala está llena (máximo 15 jugadores)');
      }

      // Añadir jugador
      const player: Player = {
        id: socket.id,
        name: playerName,
        isHost
      };

      room.players.push(player);
      socket.join(roomId);

      // Responder al cliente
      callback({
        success: true,
        isHost,
        room
      });

      // Notificar a todos en la sala
      io.to(roomId).emit('room_update', room);
      console.log(`🎮 ${playerName} se unió a la sala ${roomId}`);

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
      const room = rooms.get(roomId);
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
      const room = rooms.get(roomId);
      if (!room) throw new Error('Sala no encontrada');

      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) throw new Error('Solo el host puede llamar números');

      room.calledNumbers.push(number);
      room.currentNumber = number;
      
      io.to(roomId).emit('number_called', number);
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
      const room = rooms.get(roomId);
      if (!room) throw new Error('Sala no encontrada');
  
      const player = room.players.find(p => p.id === socket.id);
      if (!player) throw new Error('Jugador no encontrado');
  
      // Implementa tu lógica de validación real aquí
      const isValidBingo = validateBingo(room, socket.id, pattern); 
  
      if (isValidBingo) {
        room.status = 'finished';
        io.to(roomId).emit('bingo_claimed', {
          playerName: player.name,
          pattern,
          timestamp: new Date()
        });
        console.log(`🎉 BINGO válido en ${roomId} por ${player.name}`);
      } else {
        console.log(`⚠ BINGO inválido en ${roomId} por ${player.name}`);
      }
  
      // Solo llamar al callback si existe
      if (typeof callback === 'function') {
        callback(isValidBingo);
      }
  
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`❌ Error en claim_bingo: ${errorMessage}`);
      
      if (typeof callback === 'function') {
        callback(false);
      }
    }
  });
  
  // Función de ejemplo para validar BINGO
  function validateBingo(room: GameRoom, playerId: string, pattern: string): boolean {
    // Implementa tu lógica real de validación aquí
    return true; // Simplificado para el ejemplo
  }

  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
    
    rooms.forEach((room, roomId) => {
      const initialCount = room.players.length;
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length !== initialCount) {
        // Si era el host, asignar nuevo host
        if (room.players.length > 0 && !room.players.some(p => p.isHost)) {
          room.players[0].isHost = true;
        }

        // Eliminar sala si está vacía
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`🗑 Sala ${roomId} eliminada (vacía)`);
        } else {
          io.to(roomId).emit('room_update', room);
        }
      }
    });
  });

  // Manejar errores
  socket.on('error', (error) => {
    console.error(`⚠ Error en cliente ${socket.id}: ${error}`);
  });
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Manejar cierre limpio
process.on('SIGTERM', () => {
  console.log('🛑 Apagando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});