
// Simple backend for Dino Palace: server status + Steam login
// Deploy this separately (Render / Railway / VPS).
// 1) npm install
// 2) set up .env from .env.example
// 3) node server.js

import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as SteamStrategy } from "passport-steam";
import dotenv from "dotenv";
import Gamedig from "gamedig";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*",
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.STEAM_API_KEY && process.env.BACKEND_BASE_URL && process.env.FRONTEND_ORIGIN) {
  passport.use(new SteamStrategy(
    {
      returnURL: process.env.BACKEND_BASE_URL + "/auth/steam/return",
      realm: process.env.BACKEND_BASE_URL,
      apiKey: process.env.STEAM_API_KEY
    },
    (identifier, profile, done) => {
      return done(null, profile);
    }
  ));

  app.get("/auth/steam", passport.authenticate("steam", { failureRedirect: "/" }));

  app.get("/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: "/" }),
    (req, res) => {
      const redirect = process.env.FRONTEND_ORIGIN + "/?loggedIn=1&steamId=" + req.user.id;
      res.redirect(redirect);
    }
  );
} else {
  console.warn("Steam login not fully configured – missing STEAM_API_KEY, BACKEND_BASE_URL or FRONTEND_ORIGIN");
}

// Server status endpoint
app.get("/api/status", async (req, res) => {
  try {
    const state = await Gamedig.query({
      type: process.env.SERVER_TYPE || "protocol-valve",
      host: process.env.SERVER_HOST,
      port: Number(process.env.SERVER_PORT || "27048")
    });

    res.json({
      online: true,
      name: state.name,
      map: state.map,
      players: state.players.length,
      maxPlayers: state.maxplayers
    });
  } catch (err) {
    console.error("Status error:", err.message);
    res.json({ online: false });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Backend listening on port " + port);
});
