const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store game state
let players = [];
let scores = {};
let currentJudge = null;

// Handle socket connections
io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    // Player joins the game
    socket.on("joinGame", (playerName) => {
        if (!players.includes(playerName)) {
            players.push(playerName);
            scores[playerName] = scores[playerName] || 0;
        }

        // Assign judge if this is the first player
        if (!currentJudge) {
            currentJudge = playerName;
        }

        // Send updated player list to everyone
        io.emit("updatePlayers", { players, scores, currentJudge });
    });

    // Handle player disconnection
    socket.on("disconnect", () => {
        console.log("A player disconnected:", socket.id);
        // TODO: Handle player leaving logic
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
