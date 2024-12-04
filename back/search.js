const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();

// Database configuration
const DB_URI = "mongodb://localhost:27017";
const DB_NAME = "bugle";
const COLLECTION_NAME = "article";

// Define the port for this microservice
const PORT = 3014;

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

app.use(express.json());

// Helper function to get user permissions
async function getUserPermissions(sessionID) {
    try {
        const response = await axios.get(`http://localhost:8080/auth/permissions?sessionID=${sessionID}`);
        return response.data.roles;
    } catch (error) {
        console.error("Error fetching user permissions", error);
        return null;
    }
}

// (GET) Fetch all article titles
app.get('/search', async (req, res) => {
    try {
        const db = client.db(DB_NAME);
        const articles = await db.collection(COLLECTION_NAME).find({}, { projection: { title: 1, _id: 1, date_created: 1 } }).toArray();

        // Sort articles by date_created (most recent first)
        articles.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

        res.send(articles);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching article titles");
    }
});

// (GET) Fetch a single article and redirect based on role
app.get('/redirect/:articleId', async (req, res) => {
    const { articleId } = req.params;
    const { sessionID } = req.query;

    if (!articleId || !sessionID) {
        return res.status(400).send("Missing articleId or sessionID");
    }

    try {
        const db = client.db(DB_NAME);

        // Fetch the article by ID
        const article = await db.collection(COLLECTION_NAME).findOne({ _id: parseInt(articleId) });
        if (!article) {
            return res.status(404).send("Article not found");
        }

        // Get user permissions
        const userPermissions = await getUserPermissions(sessionID);
        if (!userPermissions) {
            return res.status(401).send("Invalid session");
        }

        // Redirect based on role
        if (userPermissions.includes("Reader")) {
            res.redirect(`/reader.html?articleId=${articleId}`);
        } else if (userPermissions.includes("Editor")) {
            res.redirect(`/editor.html?articleId=${articleId}`);
        } else {
            res.status(403).send("Access denied");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Error handling article redirect");
    }
});

// Start the microservice
app.listen(PORT, () => {
    console.log(`Search microservice running on http://localhost:${PORT}`);
});
