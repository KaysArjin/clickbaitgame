const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const initSocket = require('./socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.static(path.join(__dirname, '../frontend')));

initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Clickbait server running on port ${PORT}`);
});