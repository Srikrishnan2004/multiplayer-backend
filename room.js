const UPPER_ASCII_START = "A".charCodeAt(0);
const UPPER_ASCII_END = "Z".charCodeAt(0);

function generateRoomCode(codeLength) {
  let code = "";
  for (let i = 0; i < codeLength; i++) {
    const randomUpperAscii = Math.floor(
      UPPER_ASCII_START + Math.random() * (UPPER_ASCII_END - UPPER_ASCII_START)
    );
    code += String.fromCharCode(randomUpperAscii);
  }
  return code;
}

class GameRoom {
  constructor(roomCode) {
    this.playerSockets = new Map();
    this.numPlayers = 0;
    this.roomCode = roomCode;
  }

  addPlayer(playerSocket) {
    this.playerSockets.set(playerSocket.id, playerSocket);
    this.numPlayers++;
    console.log(`${this.roomCode} added ${playerSocket.id}`);
  }

  removePlayer(playerSocket) {
    this.playerSockets.delete(playerSocket.id);
    this.numPlayers--;
  }

  changePlayerRoom(playerSocket) {
    this.removePlayer(playerSocket);
    this.addPlayer(playerSocket);
  }
}

export { GameRoom, generateRoomCode };
