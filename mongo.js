const mongoose = require("mongoose");

mongoose.set("strictQuery", true);
mongoose.connect(
    process.env.MONGO_URI
);

const userSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        username: { type: String, required: true },
        name: { type: String, required: true },
        pwd: { type: String, required: true },
        premium: { type: Boolean, required: true, default: false },
        owned: { type: Array, required: true, default: [] },
        sessions: { type: Array, required: true, default: [] },
    },
    { collection: "users" }
);

const dataSchema = new mongoose.Schema(
    {
        uid: { type: String, required: true },
        pointers: { type: Array, required: true },
        file: { type: String, required: true },
        expires: { type: Date, required: false },
        public: { type: Boolean, required: true },
        shared: { type: Array, required: false },
    },
    { collection: "data" }
);

const User = mongoose.model("users", userSchema);
const Data = mongoose.model("data", dataSchema);

// Generates a unique user ID.
function genID() {
    let result = "";
    const characters = "0123456789ABCDEF";
    for (let i = 0; i < 12; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    if (User.findOne({ id: result })) {
        return genID();
    }
    return result;
}

// Generates a unique session ID.
function genSessionID() {
    let result = "";
    const characters = "0123456789ABCDEF";
    for (let i = 0; i < 12; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Generates a unique session token.
function genSessionToken() {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    for (let i = 0; i < 32; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Function to generate a unique session ID and token.
function generateSession() {
    const sessionID = genSessionID();
    const sessionToken = genSessionToken();
    return { sessionID, sessionToken };
}

// Function to register a property. Property is a reference to a file.
async function registerProperty(id, sessionID, sessionToken, file, public, access_list, expiry = null) {
    try {
        const user = await User.findOne({ id: id });
        if (!user) {
            return { status: false, message: "User does not exist.", code: 2 };
        }
        const session = user.sessions.find((session) => session.sessionID === sessionID);
        if (!session) {
            return { status: false, message: "Session does not exist.", code: 4 };
        }
        if (session.sessionToken !== sessionToken) {
            return { status: false, message: "Invalid session token.", code: 5 };
        }
        const data = new Data({
            uid: id,
            pointers: [],
            file: file,
            expires: expiry,
            public: public,
            shared: access_list,
        });
        await data.save();
        user.owned.push(data.id);
        await user.save();
        return { status: true, code: -1 };
    } catch (error) {
        console.error(`Error occurred while registering property: ${error}`);
        return { status: false, message: "An error occurred.", code: 0 };
    }
}

// Function to associate a pointer with a property. Requires premium access.
async function addPointer(id, sessionID, sessionToken, propertyID, pointer) {
    try {
        const user = await User.findOne({ id: id });
        if (!user) {
            return { status: false, message: "User does not exist.", code: 2 };
        }
        if (!user.premium) {
            return { status: false, message: "User does not have premium access.", code: 6 };
        }
        const session = user.sessions.find((session) => session.sessionID === sessionID);
        if (!session) {
            return { status: false, message: "Session does not exist.", code: 4 };
        }
        if (session.sessionToken !== sessionToken) {
            return { status: false, message: "Invalid session token.", code: 5 };
        }
        const data = await Data.findOne({ uid: id });
        if (!data) {
            return { status: false, message: "Property does not exist.", code: 7 };
        }
        data.pointers.push(pointer);
        await data.save();
        return { status: true, code: -1 };
    }
    catch (error) {
        console.error(`Error occurred while adding pointer: ${error}`);
        return { status: false, message: "An error occurred.", code: 0 };
    }
}

// Function to search for and retrieve a property by uid OR by pointer. If the property is not public, the user must have access to it.
async function getProperty(id, sessionID, sessionToken, propertyID) {
    try {
        const user = await User.findOne({ id: id });
        if (!user) {
            return { status: false, message: "User does not exist.", code: 2 };
        }
        const session = user.sessions.find((session) => session.sessionID === sessionID);
        if (!session) {
            return { status: false, message: "Session does not exist.", code: 4 };
        }
        if (session.sessionToken !== sessionToken) {
            return { status: false, message: "Invalid session token.", code: 5 };
        }
        const data = await Data.findOne({ uid: id });
        if (!data) {
            return { status: false, message: "Property does not exist.", code: 7 };
        }
        if (data.public) {
            return { status: true, data, code: -1 };
        }
        if (data.shared.includes(id)) {
            return { status: true, data, code: -1 };
        }
        if (user.owned.includes(data.id)) {
            return { status: true, data, code: -1 };
        }
        return { status: false, message: "Property does not exist.", code: 7 }; // To maintain privacy, we do not specify why the property does not exist (it could be due to the property not being shared with the user).
    } catch (error) {
        console.error(`Error occurred while getting property: ${error}`);
        return { status: false, message: "An error occurred.", code: 0 };
    }
}

// Function to register a new user. If the user already exists, return false.
async function registerUser(username, name, pwd) {
    try {
        const user = await User.findOne({ username: username });
        if (user) {
            return { status: false, message: "User already exists.", code: 1 };
        }
        console.log("Registered: " + username);
        const newUser = new User({
            id: genID(),
            username: username,
            name: name,
            pwd: pwd,
            premium: false,
            owned: [],
            sessions: [],
        });
        await newUser.save();
        return newUser;
    } catch (error) {
        console.error(`Error occurred while registering user: ${error}`);
        return { status: false, message: "An error occurred.", code: 0 };
    }
}

// Function to login a user. If the user does not exist, return false. Assigns a session ID to the user if the sign-in is successful.
async function loginUser(username, pwd) {
    try {
        const user = await User.findOne({ username: username });
        if (!user) {
            return { status: false, message: "User does not exist.", code: 2 };
        }
        if (user.pwd !== pwd) {
            return { status: false, message: "Incorrect password.", code: 3};
        }
        const session = generateSession();
        const id = user.id;
        user.sessions.push(session);
        await user.save();
        return { status: true, id, session, code: -1 };
    }
    catch (error) {
        console.error(`Error occurred while logging in user: ${error}`);
        return { status: false, message: "An error occurred.", code: 0 };
    }
}

// Function to logout a user. If the user does not exist, return false. If the session ID does not exist, return false.
async function logoutUser(id, sessionID) {
    try {
        const user = await User.findOne({ id: id });
        if (!user) {
            return { status: false, message: "User does not exist.", code: 2};
        }
        const session = user.sessions.find((session) => session.sessionID === sessionID);
        if (!session) {
            return { status: false, message: "Session does not exist.", code: 4};
        }
        user.sessions = user.sessions.filter((session) => session.sessionID !== sessionID);
        await user.save();
        return { status: true, code: -1 };
    }
    catch (error) {
        console.error(`Error occurred while logging out user: ${error}`);
        return { status: false, message: "An error occurred.", code: 0 };
    }
}

// Function to get a user's properties. If the user does not exist, return false. Demands a session pair to access the property.
async function getUserData(id, sessionID, sessionToken) {
    try {
        const user = await User.findOne({ id: id });
        if (!user) {
            return { status: false, message: "User does not exist.", code: 2 };
        }
        const session = user.sessions.find((session) => session.sessionID === sessionID);
        if (!session) {
            return { status: false, message: "Session does not exist.", code: 4 };
        }
        if (session.sessionToken !== sessionToken) {
            return { status: false, message: "Invalid session token.", code: 5 };
        }
        return { status: true, data: user.owned, code: -1 };
    }
    catch (error) {
        console.error(`Error occurred while getting user data: ${error}`);
        return { status: false, message: "An error occurred.", code: 0 };
    }
}

// Function to add a new data entry to the database. If the user does not exist, return false. Demands a session pair to access the property.



console.log("Thread > DB Connected on MAIN");

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
};

