const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const WebTorrent = require('webtorrent');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3001;

app.use(express.static('public'));
app.set('view engine', 'ejs');

const client = new WebTorrent();
const downloadProgressMap = {}; // Map to store download progress by random string id

app.get('/', (req, res) => {
  res.render('index', { downloadProgressMap });
});

io.on('connection', (socket) => {
  socket.on('startDownload', (magnetLink, progressId) => {
    if (!downloadProgressMap[progressId]) {

        
      const torrent = client.add(magnetLink, { path: './downloads' });

      downloadProgressMap[progressId] = { percent: 0, torrent };

      torrent.on('download', () => {
        const percent = (torrent.progress * 100).toFixed(2);
        downloadProgressMap[progressId].percent = percent;
        io.emit('updateProgress', { progressId, percent });
      });

      torrent.on('done', () => {
        downloadProgressMap[progressId].percent = '100.00';
        io.emit('updateProgress', { progressId, percent: '100.00' });
        delete downloadProgressMap[progressId];
      });
    }
  });

  socket.on('stopDownload', (progressId) => {
    const downloadEntry = downloadProgressMap[progressId];
    if (downloadEntry) {
      const { torrent } = downloadEntry;
      torrent.destroy(() => {
        delete downloadProgressMap[progressId];
        io.emit('removeProgress', progressId);
      });
    }
  });
});



app.get('/list', async (req, res) => {
    try {
      const directoryPath = './downloads'; // Specify the directory path where downloads are stored
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  
      const folders = [];
      const files = [];
  
      for (const entry of entries) {
        if (entry.isDirectory()) {
          folders.push({ name: entry.name });
        } else {
          files.push({ name: entry.name });
        }
      }
  
      res.render('filesList', { folders, files });
    } catch (error) {
      console.error('Error reading directory:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/downloads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'downloads', req.params.filename);
    res.sendFile(filePath);
  });

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});