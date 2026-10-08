# StreamOps - Live Streamer Control Center

A single, professional dashboard for running a YouTube livestream: giveaways
(including your Clash of Clans tag-tracking workflow), real-time alerts,
viewer polls, basic chat moderation, and live analytics - all in one place,
styled like a StreamElements/Streamlabs-style SaaS dashboard.

This replaces the two separate tools built earlier (the giveaway system and
the CoC tag manager) with one merged product, and adds the new modules you
asked for: alerts/overlays, polls, moderation, and analytics.

## Quick Start (Windows)

1. Make sure [Node.js 22.5+](https://nodejs.org) is installed.
2. Double-click **`Start-StreamOps.bat`**. The first run installs
   dependencies automatically (takes a minute or two), then opens:
   - Backend API on `http://localhost:4200`
   - Dashboard on `http://localhost:5200`
3. (Optional) Run **`Create Desktop Shortcut.vbs`** once to get a desktop icon.
4. Use **`Stop-StreamOps.bat`** to shut both servers down.

On Mac/Linux, run `npm install && npm start` inside `backend/`, and
`npm install && npm run dev` inside `frontend/`, in two terminals.

## First Steps

1. Open `http://localhost:5200` and **create an account** (this is local
   to your machine - there's no cloud server involved).
2. Create a **Session** from the top bar (one per stream/day).
3. Go to **Chat Connection**, paste your YouTube live video URL and a
   [YouTube Data API key](https://console.cloud.google.com/apis/credentials)
   (API key only - no OAuth/login needed), and click **Start Collection**.
4. Explore the sidebar: **Giveaways**, **Tag Manager**, **Alerts & Overlays**,
   **Polls**, **Moderation**, **Analytics**, **Settings**.

## What Each Module Actually Does

- **Giveaways** - three entry modes: chat keyword (`!enter`), one winner per
  confirmed Clash of Clans tag, or one winner per YouTube user (collapses a
  viewer's multiple tags into one entry). Multi-winner draws, configurable
  backups with accept/reject + automatic backfill, CSV/JSON export, and a
  dedicated full-screen **Draw Screen** you open in a new tab for OBS/TV.
- **Tag Manager** - the Clash of Clans tag tracker: chat-detected tags,
  Pending → Confirmed workflow, duplicate-tag detection, manual add/edit,
  bulk actions, CSV/JSON export. Only active when you turn on "CoC Tag
  Tracking" for a session in Chat Connection.
- **Alerts & Overlays** - listens for the *real* YouTube Live Chat API
  events: new members, Super Chats, Super Stickers, and gifted memberships.
  Each one fires a popup on a transparent OBS Browser Source URL (copy it
  from this tab). There's also a manual "test alert" button for setup.
- **Polls** - create a poll, go live, and viewers vote in chat with
  `!vote 2` (the command is configurable per session). Results show live on
  your dashboard and on a second OBS Browser Source overlay URL.
- **Moderation** - flags chat messages containing banned words, links, or
  (optionally) excessive caps, in real time, with a review queue.
- **Analytics** - chat activity over time plus session totals (messages,
  unique chatters, tags tracked, alerts fired, draws run).

## Honest Limitations (please read)

This connects to YouTube using only a **Data API key**, not OAuth, which is
what keeps setup to "paste a URL and a key" instead of a Google sign-in
flow. That has two real consequences:

- **Alerts are real events, not guesses.** New-member, Super Chat, Super
  Sticker, and gift-membership alerts come from YouTube's own event types -
  they are not simulated. But anything that would require a payment
  processor (e.g. non-YouTube tip alerts) isn't included.
- **Moderation is detect-and-log, not enforce.** This tool cannot delete a
  message or time out/ban a viewer on YouTube itself - that requires
  channel-owner OAuth permissions, which this tool deliberately does not
  request (so you're never asked to grant a third-party app access to your
  channel). The Moderation tab gives you a live flagged-message queue to act
  on in YouTube Studio or chat yourself.

## Architecture

- **Backend**: Node.js + Express + Socket.IO, using Node's built-in
  `node:sqlite` (no native module to compile, so no Visual Studio Build
  Tools needed on Windows). JWT-based account login (local only).
- **Frontend**: React + Vite + Tailwind + daisyUI, custom dashboard shell
  (sidebar/topbar), no charting dependency (charts are inline SVG).
- **Public overlay routes** (`/overlay/alerts/:sessionId`,
  `/overlay/poll/:sessionId`, `/draw/:giveawayId`) require no login, since
  OBS Browser Sources can't log in - they only ever expose the minimum data
  needed to render.

## Project Structure

```
streamops/
  backend/   Express + Socket.IO + SQLite API
  frontend/  React dashboard + public OBS overlay pages
  Start-StreamOps.bat / Stop-StreamOps.bat / Create Desktop Shortcut.vbs
```
