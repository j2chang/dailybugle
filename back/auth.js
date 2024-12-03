const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Database configuration
const DB_URI = "mongodb://localhost:27017";
const DB_NAME = "bugle";
const COLLECTION_NAME = "auth";

// Define the port for this microservice
const PORT = 3010;

let client;
(async () => {
    try {
        client = await MongoClient.connect(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        process.exit(1);
    }
})();

// Helper function to generate session IDs
function makeID(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// Routes
// (Create) Register User
app.post('/register', async (req, res) => {
    const { username, password, roles } = req.body;

    if (!username || !password || !roles) {
        return res.status(400).send("Missing fields in request");
    }

    try {
        const db = client.db(DB_NAME);
        const user = await db.collection(COLLECTION_NAME).findOne({ Username: username });

        if (user) {
            return res.status(400).send("User already exists");
        }

        await db.collection(COLLECTION_NAME).insertOne({
            Username: username,
            Password: password,
            Roles: roles,
            currSessID: null,
        });

        res.send("User registered successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error registering user");
    }
});

// (Update) Login User
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send("Missing fields in request");
    }

    try {
        const db = client.db(DB_NAME);
        const user = await db.collection(COLLECTION_NAME).findOne({ Username: username });

        if (!user || user.Password !== password) {
            return res.status(401).send("Invalid username or password");
        }

        const sessionID = makeID(16);
        await db.collection(COLLECTION_NAME).updateOne(
            { Username: username },
            { $set: { currSessID: sessionID } }
        );

        res.send({ message: "Login successful", sessionID });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error logging in");
    }
});

// (Read) Check Permissions for User
app.get('/permissions', async (req, res) => {
    const { sessionID } = req.query;

    if (!sessionID) {
        return res.status(400).send("Session ID is required");
    }

    try {
        const db = client.db(DB_NAME);
        const user = await db.collection(COLLECTION_NAME).findOne({ currSessID: sessionID });

        if (!user) {
            return res.status(401).send("Invalid session");
        }

        res.send({ roles: user.Roles });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error checking permissions");
    }
});

// (Delete) Delete User
app.post('/delete', async (req, res) => {
    const { sessionID } = req.body;

    if (!sessionID) {
        return res.status(400).send("Session ID is required");
    }

    try {
        const db = client.db(DB_NAME);
        const result = await db.collection(COLLECTION_NAME).deleteOne({ currSessID: sessionID });

        if (result.deletedCount === 0) {
            return res.status(400).send("User not found or invalid session");
        }

        res.send("User deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting user");
    }
});

// Start the microservice on port 3010
app.listen(PORT, () => {
    console.log(`Authentication microservice running on http://localhost:${PORT}`);
});
