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
let submittedLinks = [];

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    // Player joins the game
    socket.on("joinGame", (playerName) => {
        if (!players.includes(playerName)) {
            players.push(playerName);
            scores[playerName] = scores[playerName] || 0;
        }

        if (!currentJudge) {
            currentJudge = playerName;
        }

        io.emit("updatePlayers", { players, scores, currentJudge });
    });

    // **NEW: Handle link submission**
    socket.on("submitLink", (data) => {
        submittedLinks.push({ player: data.playerName, link: data.link });

        // Notify the judge that links are submitted
        io.to(currentJudge).emit("linksSubmitted", { count: submittedLinks.length });
    });

    socket.on("disconnect", () => {
        console.log("A player disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
