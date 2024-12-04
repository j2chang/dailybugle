const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');
const app = express();

// Database configuration
const DB_URI = "mongodb://localhost:27017";
const DB_NAME = "bugle";
const COLLECTION_ARTICLE = "article";

// Define the port for this microservice
const PORT = 3013;

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

// (POST) Add Comment
app.post('/comment', async (req, res) => {
    const { sessionID, articleId, body } = req.body;

    if (!sessionID || !articleId || !body) {
        return res.status(400).send("Missing fields in request");
    }

    console.log("Received articleId:", articleId, "Type:", typeof articleId);

    try {
        // Fetch user permissions and details from the Auth microservice
        const userResponse = await axios.get(`http://localhost:8080/auth/permissions?sessionID=${sessionID}`);
        const userRoles = userResponse.data.roles;
        const username = userResponse.data.username; // Assuming `auth/permissions` returns the username

        // Check if user has the Reader role
        if (!userRoles || (!userRoles.includes("Reader") && !userRoles.includes("Editor"))) {
            return res.status(403).send("Access denied: Reader/Editor role required");
        }

        const db = client.db(DB_NAME);

        // Create a new comment object
        const newComment = {
            comment_id: `c${Date.now()}`, // Generate unique comment ID
            user_id: sessionID,
            username: username || "Anonymous", // Use fetched username or fallback to "Anonymous"
            body: body,
            date: new Date()
        };

        // Add comment to the article's comments array
        const result = await db.collection(COLLECTION_ARTICLE).updateOne(
            { _id: new ObjectId(articleId) }, // Ensure articleId is parsed correctly
            { $push: { comments: newComment } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send("Article not found");
        }

        res.send("Comment added successfully");
    } catch (error) {
        console.error("Error adding comment", error);
        res.status(500).send("Error adding comment");
    }
});


// (GET) Retrieve Comments for an Article
app.get('/comments/:articleId', async (req, res) => {
    const { articleId } = req.params;

    try {
        const db = client.db(DB_NAME);
        const article = await db.collection(COLLECTION_ARTICLE).findOne({ _id: new ObjectId(articleId) });

        if (!article) {
            return res.status(404).send("Article not found");
        }

        res.send(article.comments || []);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching comments");
    }
});

// (DELETE) Delete a Comment (Optional)
app.delete('/comment/:commentId', async (req, res) => {
    const { commentId } = req.params;
    const { sessionID } = req.body;

    if (!sessionID) {
        return res.status(400).send("Missing sessionID");
    }

    try {
        const db = client.db(DB_NAME);

        // Remove the comment with the specified comment_id
        const result = await db.collection(COLLECTION_ARTICLE).updateOne(
            { "comments.comment_id": commentId },
            { $pull: { comments: { comment_id: commentId, user_id: sessionID } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).send("Comment not found or not authorized to delete");
        }

        res.send("Comment deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting comment");
    }
});

// Start the microservice
app.listen(PORT, () => {
    console.log(`Comment microservice running on http://localhost:${PORT}`);
});
