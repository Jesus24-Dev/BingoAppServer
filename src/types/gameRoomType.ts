import { Player } from './playerType';
import { BingoNumber } from './bingoNumberType';
import { BingoWinner } from './bingoWinnerType';

export type GameRoom = {
  id: string;
  players: Player[];
  calledNumbers: BingoNumber[];
  currentNumber: BingoNumber | null;
  winners: BingoWinner[];
  status: 'waiting' | 'playing' | 'finished';
};