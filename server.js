const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");

/* 
  Descriptions of all database functions:
   registerUser: Registers a new user. If the user already exists, return false.
   loginUser: Logs in a user. If the user does not exist, return false. Assigns a session ID to the user if the sign-in is successful.
   logoutUser: Logs out a user. If the user does not exist, return false. If the session ID does not exist, return false.
   getUserData: Gets a user's properties. If the user does not exist, return false. Demands a session pair to access the property.
   getProperty: Searches for and retrieves a property by uid OR by pointer. If the property is not public, the user must have access to it.
   registerProperty: Registers a property. Property is a reference to a file.
   addPointer: Associates a pointer with a property. Requires premium access.
   updateAccessList: Updates the access list of a property. Requires ownership.
*/

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

// Register a new user
app.post("/api/register", async (req, res) => {
    const { username, name, password } = req.body;
    const result = await DB.registerUser(username, name, password);
    res.send(result);
});

// Log in a user
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const result = await DB.loginUser(username, password);
    res.send(result);
});

// Log out a user
app.post("/api/logout", async (req, res) => {
    const { id } = req.body;
    const sessionToken = req.headers.authorization;
    const result = await DB.logoutUser(id, sessionToken);
    res.send(result);
});

// Get user data
app.get("/api/user/get/:id", async (req, res) => {
    const id = req.params.id;
    const sessionToken = req.headers.authorization;
    const result = await DB.getUserData(id, sessionToken);
    res.send(result);
});

// Register a new property
app.post("/api/property/register", async (req, res) => {
    const { id, name, file, public, access_list, expiry } = req.body;
    const sessionToken = req.headers.authorization;
    const result = await DB.registerProperty(id, sessionToken, name, file, public, access_list, expiry);
    res.send(result);
});

// Get property data. Search query is either a pointer or a property ID.
app.get("/api/property/get/:id/:searchQuery", async (req, res) => {
    const id = req.params.id;
    const searchQuery = req.params.searchQuery;
    const sessionToken = req.headers.authorization;
    const result = await DB.getProperty(id, sessionToken, searchQuery);
    res.send(result);
});

// Add a pointer to a property
app.post("/api/property/pointer/add", async (req, res) => {
    const { id, pointer, property } = req.body;
    const sessionToken = req.headers.authorization;
    const result = await DB.addPointer(id, sessionToken, property, pointer);
    res.send(result);
});

// Update the access list of a property
app.post("/api/property/access/update", async (req, res) => {
    const { id, property, access_list } = req.body;
    const sessionToken = req.headers.authorization;
    const result = await DB.updateAccessList(id, sessionToken, property, access_list);
    res.send(result);
});

let server;

// Check if the key and certificate files exist
if (fs.existsSync('private.key') && fs.existsSync('certificate.crt')) {
    const options = {
        key: fs.readFileSync('private.key'),
        cert: fs.readFileSync('certificate.crt'),
    };

    server = https.createServer(options, app);
    console.log('HTTPS Server created');
} else {
    server = http.createServer(app);
    console.log('HTTP Server created');
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
