# Aiden's Coin Game

A tap-the-coin game for a 4-year-old. Coins appear slowly on the screen, tapping one
adds it to the counter, and coins buy animals that live on a collection page. A silver
5-coin nickel turns up every 20 seconds and asks a math question before it pays out.

Built to be icon-only (no reading required), touch-first, and to run on a tablet.

## How it plays

- **🪙 Play** — coins drift in one at a time. Tap a coin, it goes into the counter.
- **⚪ Nickel** — every 20 seconds a bigger silver coin appears. Tapping it opens one
  addition problem (both numbers and the answer are single digits) with three big
  buttons to choose from. Right answer: **5 coins**. Wrong answer: nothing. Either way
  the nickel is spent and play resumes.
- **🛒 Shop** — 26 animals from a caterpillar (100 coins) up to a dragon (2000 coins).
  Affordable ones bounce; the rest are dimmed. Tapping one asks ✔️ / ✖️ to confirm.
- **🏡 My Animals** — everything bought so far. Tapping an animal makes it wiggle and chirp.

Everyone starts with 0 coins. Progress is saved in the browser on that device
(`localStorage`) under the key `aidenGame.v2`. No accounts, no server data.

At the default coin speed (one every 10 seconds) the first animal takes about 17 minutes
of play. Turn the coin speed down in parent settings if that is too slow for him — at the
fastest setting, one coin per second, the first animal is under two minutes away.

## Parent settings

Press and **hold** the ⚙️ in the top-right corner for **1.5 seconds** — a normal tap does
nothing on purpose, so a curious 4-year-old can't get in. A green ring grows around the
gear while you hold; when it finishes, the settings open. Let go early and it cancels.

From there you can set:

- **Coin speed** — one coin every 1–45 seconds (default 10)
- **Max coins on screen** — 1–10 (default 6)
- **Sound** on/off
- **Reset progress** — requires a 2-second hold

## Run it locally

```bash
npm install
npm start
# open http://localhost:3000
```

To try it on a phone or tablet on the same Wi-Fi, open `http://<your-computer-ip>:3000`.

## Deploying on Render

The repo includes `render.yaml`, so Render can set it up automatically:

1. Push to GitHub.
2. In Render: **New → Web Service** → connect `mschlais90/AidenGame`.
3. Render reads `render.yaml` (Node, `npm install`, `npm start`, free plan). Click **Deploy**.

Every push to `main` redeploys.

Note: on Render's free plan the service sleeps after inactivity, so the very first load
of the day takes ~30 seconds. Everything after that is instant, and the game itself
runs entirely in the browser — it keeps working even if the connection drops.

## Add it to the tablet home screen

Open the Render URL in Safari/Chrome → Share → **Add to Home Screen**. It then launches
full-screen with no browser chrome, which stops little fingers from wandering off.

## Layout

```
server.js          Express static server + /healthz
public/index.html  screens, nav, overlays
public/styles.css  all styling and animations
public/game.js     game state, coin spawning, math challenge, shop, collection, settings
render.yaml        Render blueprint
```

Adding an animal is one line in the `ANIMALS` array in `public/game.js`.
The nickel's timing and payout are the `NICKEL_SECONDS` and `NICKEL_REWARD` constants
just below it.
