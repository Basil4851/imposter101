export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  role: 'citizen' | 'imposter' | null;
}

export interface Room {
  code: string;
  players: Player[];
  state: 'lobby' | 'playing';
  category: string;
  word: string | null;
  imposterCount: number;
  imposterIds: string[];
}

export type ServerMessage =
  | { type: 'ROOM_UPDATED'; room: Room }
  | { type: 'ERROR'; message: string }
  | { type: 'JOIN_SUCCESS'; playerId: string; room: Room };

export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'UPDATE_CONFIG'; category: string; imposterCount: number }
  | { type: 'START_ROUND' }
  | { type: 'END_ROUND' };
