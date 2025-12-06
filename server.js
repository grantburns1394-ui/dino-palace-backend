// server.js – Dino Palace backend

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const Gamedig = require("gamedig");
require("dotenv").config();

const app = express();

// ---------- CORS ----------
const frontendOrigin = process.env.FRONTEND_ORIGIN || "*";
app.use(
  cors({
    origin:
      frontendOrigin === "*" ? true : [frontendOrigin, frontendOrigin.replace(/^https?/, "http")],
    credentials: true,
  })
);
app.use(express.json());

// ---------- Sessions ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true behind https proxy if needed
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ---------- Steam login (optional but ready) ----------
if (
  process.env.STEAM_API_KEY &&
  process.env.BACKEND_BASE_URL &&
  process.env.FRONTEND_ORIGIN
) {
  passport.use(
    new SteamStrategy(
      {
        returnURL: process.env.BACKEND_BASE_URL + "/auth/steam/return",
        realm: process.env.BACKEND_BASE_URL,
        apiKey: process.env.STEAM_API_KEY,
      },
      (identifier, profile, done) => {
        return done(null, profile);
      }
    )
  );

  app.get("/auth/steam", passport.authenticate("steam"));

  app.get(
    "/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: "/" }),
    (req, res) => {
      const redirect =
        process.env.FRONTEND_ORIGIN +
        "/?loggedIn=1&steamId=" +
        encodeURIComponent(req.user.id);
      return res.redirect(redirect);
    }
  );
} else {
  console.log(
    "Steam login disabled – missing STEAM_API_KEY, BACKEND_BASE_URL, or FRONTEND_ORIGIN"
  );
}

// ---------- Status endpoint ----------
app.get("/api/status", async (req, res) => {
  const host = process.env.SERVER_HOST;
  const port = Number(process.env.SERVER_PORT || "27048");
  const type = process.env.SERVER_TYPE || "protocol-valve";

  if (!host) {
    return res.status(500).json({ online: false, error: "SERVER_HOST not set" });
  }

  try {
    const state = await Gamedig.query({
      type,
      host,
      port,
    });

    const players =
      Array.isArray(state.players) && state.players.length
        ? state.players.length
        : state.raw?.numplayers ?? 0;

    const maxPlayers =
      state.maxplayers || state.maxPlayers || state.raw?.maxplayers || null;

    res.json({
      online: true,
      name: state.name,
      map: state.map,
      players,
      maxPlayers,
    });
  } catch (err) {
    console.error("Gamedig error:", err.message);
    res.json({ online: false });
  }
});

// ---------- Root ----------
app.get("/", (req, res) => {
  res.send("Dino Palace backend is running.");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Backend listening on port " + port);
});

