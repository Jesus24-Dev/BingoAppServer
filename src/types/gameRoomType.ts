import { Player } from './playerType';
import { BingoNumber } from './bingoNumberType';

export type GameRoom = {
  id: string;
  players: Player[];
  calledNumbers: BingoNumber[];
  currentNumber: BingoNumber | null;
  status: 'waiting' | 'playing' | 'finished';
};