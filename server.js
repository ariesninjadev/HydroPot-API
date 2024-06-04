const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");

require("dotenv").config();

const DB = require("./mongo");

const app = express();
app.set("view engine", "ejs");
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));



// Ping the server
app.get("/api/ping", async (req, res) => {
    res.send("pong");
});





// Create HTTPS server
const options = {
    key: fs.readFileSync("private.key"),
    cert: fs.readFileSync("certificate.crt"),
};

const PORT = 4768;

const server = https.createServer(options, app);

// If user connects to the server on this port from HTTP, redirect them to HTTPS

const http = express();
http.get("*", (req, res) => {
    res.redirect("https://" + req.headers.host + req.url);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
