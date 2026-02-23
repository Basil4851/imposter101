/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, User, Crown, Play, LogOut, ChevronRight, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Room, Player, ServerMessage, ClientMessage } from './types';
import { WORD_CATEGORIES } from './constants';

export default function App() {
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showWord, setShowWord] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      switch (message.type) {
        case 'JOIN_SUCCESS':
          setPlayerId(message.playerId);
          setRoom(message.room);
          setError(null);
          setIsConnecting(false);
          break;
        case 'ROOM_UPDATED':
          setRoom(message.room);
          break;
        case 'ERROR':
          setError(message.message);
          setIsConnecting(false);
          break;
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  const sendMessage = (msg: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setIsConnecting(true);
    sendMessage({ type: 'CREATE_ROOM', playerName });
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCodeInput.trim()) {
      setError('Please enter a room code');
      return;
    }
    setIsConnecting(true);
    sendMessage({ type: 'JOIN_ROOM', roomCode: roomCodeInput, playerName });
  };

  const handleUpdateConfig = (category: string, imposterCount: number) => {
    sendMessage({ type: 'UPDATE_CONFIG', category, imposterCount });
  };

  const handleStartRound = () => {
    sendMessage({ type: 'START_ROUND' });
    setShowWord(false);
  };

  const handleEndRound = () => {
    sendMessage({ type: 'END_ROUND' });
  };

  const currentPlayer = useMemo(() => 
    room?.players.find(p => p.id === playerId), 
    [room, playerId]
  );

  const isHost = currentPlayer?.isHost;

  if (!room) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] p-8"
        >
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-8 italic border-b-2 border-[#141414] pb-4 text-center">
            Imposter Party
          </h1>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 opacity-50">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter display name"
                className="w-full bg-transparent border-2 border-[#141414] p-3 font-mono focus:outline-none focus:bg-[#141414] focus:text-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={handleCreateRoom}
                disabled={isConnecting}
                className="w-full bg-[#141414] text-white p-4 font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 group"
              >
                Create Room <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-[#141414] opacity-20"></div>
                <span className="flex-shrink mx-4 text-xs font-bold uppercase opacity-40">Or Join</span>
                <div className="flex-grow border-t border-[#141414] opacity-20"></div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter 4-digit code"
                  maxLength={4}
                  className="w-full bg-transparent border-2 border-[#141414] p-3 font-mono text-center text-xl tracking-[0.5em] focus:outline-none focus:bg-[#141414] focus:text-white transition-colors"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={isConnecting}
                  className="w-full border-2 border-[#141414] p-4 font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all"
                >
                  Join Game
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-red-600 bg-red-50 p-3 border border-red-200 text-sm font-medium"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </div>

          <p className="mt-8 text-[10px] font-mono uppercase opacity-40 text-center leading-relaxed">
            Local multiplayer. Use your own device.<br/>Talk out loud. Don't show your screen.
          </p>
        </motion.div>
      </div>
    );
  }

  if (room.state === 'lobby') {
    return (
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-4 md:p-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Room Info & Players */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white border-2 border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Room Code</h2>
                  <p className="text-5xl font-black tracking-tighter">{room.code}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Players</h2>
                  <p className="text-3xl font-black">{room.players.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50 border-b border-[#141414] pb-2 mb-4">Player List</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {room.players.map((p) => (
                    <div 
                      key={p.id}
                      className={`flex items-center justify-between p-3 border-2 ${p.id === playerId ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#141414] bg-white'}`}
                    >
                      <div className="flex items-center gap-2">
                        {p.isHost ? <Crown className="w-4 h-4 text-yellow-500" /> : <User className="w-4 h-4 opacity-50" />}
                        <span className="font-bold truncate">{p.name}</span>
                      </div>
                      {p.id === playerId && <span className="text-[10px] font-mono uppercase opacity-50">You</span>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Host Controls */}
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white border-2 border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]"
            >
              <h3 className="text-xs font-bold uppercase tracking-widest mb-6 border-b border-[#141414] pb-2">
                {isHost ? 'Game Settings' : 'Waiting for Host'}
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Category</label>
                  <select
                    disabled={!isHost}
                    value={room.category}
                    onChange={(e) => handleUpdateConfig(e.target.value, room.imposterCount)}
                    className="w-full bg-transparent border-2 border-[#141414] p-3 font-bold focus:outline-none appearance-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    {Object.keys(WORD_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 opacity-50">Imposters: {room.imposterCount}</label>
                  <input
                    type="range"
                    min="1"
                    max={Math.max(1, room.players.length - 1)}
                    disabled={!isHost}
                    value={room.imposterCount}
                    onChange={(e) => handleUpdateConfig(room.category, parseInt(e.target.value))}
                    className="w-full accent-[#141414] cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between mt-1 text-[10px] font-mono opacity-50">
                    <span>1</span>
                    <span>{room.players.length - 1}</span>
                  </div>
                </div>

                {isHost ? (
                  <button
                    onClick={handleStartRound}
                    disabled={room.players.length < 3}
                    className="w-full bg-[#141414] text-white p-4 font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 fill-current" /> Start Round
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-[#141414] opacity-50 italic text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Waiting for host...
                  </div>
                )}

                {room.players.length < 3 && isHost && (
                  <p className="text-[10px] text-red-500 font-bold uppercase text-center">
                    Need at least 3 players to start
                  </p>
                )}
              </div>
            </motion.div>

            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
            >
              <LogOut className="w-4 h-4" /> Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing State
  const role = currentPlayer?.role;
  const isImposter = role === 'imposter';

  return (
    <div className={`min-h-screen font-sans p-4 flex flex-col items-center justify-center transition-colors duration-500 ${isImposter ? 'bg-[#141414] text-white' : 'bg-white text-[#141414]'}`}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full max-w-lg p-8 border-4 ${isImposter ? 'border-white' : 'border-[#141414]'} text-center space-y-8`}
      >
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] opacity-50">Your Private Role</h2>
          <div className={`text-5xl font-black uppercase tracking-tighter italic ${isImposter ? 'text-red-500' : ''}`}>
            {isImposter ? 'Imposter' : 'Citizen'}
          </div>
        </div>

        <div className={`py-12 border-y-2 ${isImposter ? 'border-white/20' : 'border-[#141414]/10'}`}>
          {isImposter ? (
            <div className="space-y-4">
              <p className="text-xl font-bold leading-tight">
                You are the imposter.
              </p>
              <p className="text-sm opacity-60">
                Blend in with the citizens. Listen to their clues and try to guess the word or stay hidden.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-widest opacity-50">Your Word is</p>
              <div className="relative inline-block">
                <button 
                  onClick={() => setShowWord(!showWord)}
                  className={`text-4xl font-black tracking-tight px-4 py-2 transition-all duration-300 ${showWord ? 'blur-0' : 'blur-xl select-none'}`}
                >
                  {room.word}
                </button>
                {!showWord && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Eye className="w-8 h-8 opacity-20" />
                  </div>
                )}
              </div>
              <p className="text-[10px] font-mono uppercase opacity-40">
                {showWord ? 'Tap to hide' : 'Tap to reveal'}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60">
            <Users className="w-4 h-4" />
            <span>{room.imposterCount} Imposter{room.imposterCount > 1 ? 's' : ''} in play</span>
          </div>

          {isHost && (
            <button
              onClick={handleEndRound}
              className={`w-full p-4 font-bold uppercase tracking-widest transition-all ${isImposter ? 'bg-white text-[#141414] hover:bg-gray-200' : 'bg-[#141414] text-white hover:bg-opacity-90'}`}
            >
              End Round & Reset
            </button>
          )}

          {!isHost && (
            <p className="text-xs italic opacity-40">
              Waiting for host to end the round...
            </p>
          )}
        </div>
      </motion.div>

      <div className="mt-12 max-w-md text-center space-y-4 px-4">
        <p className="text-sm font-medium opacity-60">
          "Discuss the word out loud. Give subtle clues. If you're the imposter, lie convincingly."
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">
          Do not show your screen to anyone
        </p>
      </div>
    </div>
  );
}
