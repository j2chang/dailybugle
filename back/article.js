const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Database configuration
const DB_URI = "mongodb://localhost:27017";
const DB_NAME = "bugle";
const COLLECTION_NAME = "article";

// Define the port for this microservice
const PORT = 3011;

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

// Helper function to get user permissions from the Auth Microservice
async function getUserPermissions(sessionID) {
    try {
        const response = await axios.get(`http://localhost:8080/auth/permissions?sessionID=${sessionID}`);
        return response.data.roles;
    } catch (error) {
        console.error("Error fetching user permissions", error);
        return null;
    }
}

// Routes
// (Create) Create Article
app.post('/create', async (req, res) => {
    const { sessionID, articleTitle, articleTeaser, articleAuthor, articleBody, articleTags } = req.body;

    if (!sessionID || !articleTitle || !articleTeaser || !articleAuthor || !articleBody || !articleTags) {
        return res.status(400).send("Missing fields in request");
    }

    const userPermissions = await getUserPermissions(sessionID);
    if (!userPermissions || !userPermissions.includes("Editor")) {
        return res.status(403).send("Access denied: Editor role required");
    }

    try {
        const db = client.db(DB_NAME);
        const latestArticle = await db.collection(COLLECTION_NAME).find().sort({ _id: -1 }).limit(1).toArray();
        // const articleID = latestArticle.length ? latestArticle[0]._id + 1 : 1;

        const articleData = {
            _id: new ObjectId(),
            title: articleTitle,
            teaser: articleTeaser,
            author: articleAuthor,
            body: articleBody,
            date_created: new Date(),
            date_edited: new Date(),
            tags: articleTags,
            comments: []
        };

        await db.collection(COLLECTION_NAME).insertOne(articleData);
        res.send("ARTICLE POST SUCCESS");
    } catch (error) {
        console.error(error);
        res.status(500).send("ARTICLE POST FAILURE");
    }
});

// (Read) Read Articles
app.get('/read', async (req, res) => {
    try {
        const db = client.db(DB_NAME);
        const articles = await db.collection(COLLECTION_NAME).find().toArray();
        res.send(articles);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching articles");
    }
});

// (Update) Update Article
app.put('/update', async (req, res) => {
    const { sessionID, id, articleTitle, articleTeaser, articleBody, articleTags } = req.body;

    if (!sessionID || !id || !articleTitle || !articleTeaser || !articleBody || !articleTags) {
        return res.status(400).send("Missing fields in request");
    }

    const userPermissions = await getUserPermissions(sessionID);
    if (!userPermissions || !userPermissions.includes("Editor")) {
        return res.status(403).send("Access denied: Editor role required");
    }

    try {
        const db = client.db(DB_NAME);
        const articleFilter = { _id: id };
        const updateArticle = {
            $set: {
                title: articleTitle,
                teaser: articleTeaser,
                body: articleBody,
                date_edited: new Date(),
                tags: articleTags
            }
        };

        const result = await db.collection(COLLECTION_NAME).updateOne(articleFilter, updateArticle);
        if (result.matchedCount === 0) {
            return res.status(404).send("ARTICLE NOT FOUND");
        }

        res.send("ARTICLE UPDATE SUCCESS");
    } catch (error) {
        console.error(error);
        res.status(500).send("ARTICLE UPDATE FAILURE");
    }
});

// (Delete) Delete Article
app.delete('/delete', async (req, res) => {
    const { sessionID, id } = req.body;

    if (!sessionID || !id) {
        return res.status(400).send("Missing fields in request");
    }

    const userPermissions = await getUserPermissions(sessionID);
    if (!userPermissions || !userPermissions.includes("Editor")) {
        return res.status(403).send("Access denied: Editor role required");
    }

    try {
        const db = client.db(DB_NAME);
        const result = await db.collection(COLLECTION_NAME).deleteOne({ _id: id });

        if (result.deletedCount === 0) {
            return res.status(404).send("ARTICLE NOT FOUND");
        }

        res.send("ARTICLE DELETE SUCCESS");
    } catch (error) {
        console.error(error);
        res.status(500).send("ARTICLE DELETE FAILURE");
    }
});

// Start the microservice on port 3011
app.listen(PORT, () => {
    console.log(`Article microservice running on http://localhost:${PORT}`);
});
