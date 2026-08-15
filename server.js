const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// The game is fully client-side; the server just hands out the static files.
app.use(
  express.static(PUBLIC_DIR, {
    // index.html changes on every deploy, so never let a tablet cache it.
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// Health check for Render.
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// Anything else falls back to the game.
app.use((req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`Aiden's game running on port ${PORT}`);
});
