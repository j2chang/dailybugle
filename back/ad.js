// const express = require('express');
// const { MongoClient } = require('mongodb');
// const app = express();

// // Database configuration
// const DB_URI = "mongodb://localhost:27017";
// const DB_NAME = "bugle";
// const COLLECTION_AD = "ad";
// const COLLECTION_ADEVENT = "adevent";

// // Define the port for this microservice
// const PORT = 3012;
// const TOTAL_ADS = 5; // Ensure this matches the actual number of ads in your DB

// let client;
// (async () => {
//     try {
//         client = await MongoClient.connect(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//         console.log("Connected to MongoDB");
//     } catch (error) {
//         console.error("Error connecting to MongoDB", error);
//         process.exit(1);
//     }
// })();

// app.use(express.json());

// // Helper function to get IP address
// function getClientIP(req) {
//     return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
// }

// // Helper function to get browser and OS details
// function getClientDetails(req) {
//     const userAgent = req.get('User-Agent');
//     return {
//         browser: userAgent.match(/(firefox|msie|chrome|safari|opera|edg|trident)/i)?.[0] || "Unknown",
//         os: userAgent.match(/\((.*?)\)/)?.[1] || "Unknown",
//     };
// }

// // (GET) Fetch Random Ad and Track Impression
// app.get('/ad', async (req, res) => {
//     const randomID = Math.floor(Math.random() * TOTAL_ADS) + 1;
//     const userID = req.query.userID || "Guest";

//     try {
//         const db = client.db(DB_NAME);

//         // Fetch ad details
//         const adInfo = await db.collection(COLLECTION_AD).findOne({ _id: randomID });
//         if (!adInfo) {
//             return res.status(404).send("Ad not found");
//         }

//         // Record impression event
//         const impressionData = {
//             ad_id: randomID,
//             user_id: userID,
//             date: new Date(),
//             req_ip: getClientIP(req),
//             req_details: getClientDetails(req),
//             event_type: "impression"
//         };
//         await db.collection(COLLECTION_ADEVENT).insertOne(impressionData);

//         // Send ad data
//         res.send({
//             ad_id: randomID,
//             url: adInfo.url,
//             title: adInfo.title,
//             description: adInfo.description,
//             image: adInfo.image
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Error fetching ad");
//     }
// });

// // (POST) Register Ad Interaction (Click)
// app.post('/ad/click', async (req, res) => {
//     const { ad_id, userID } = req.body;

//     if (!ad_id || !userID) {
//         return res.status(400).send("Missing fields in request");
//     }

//     try {
//         const db = client.db(DB_NAME);

//         // Fetch ad details to ensure it exists
//         const adInfo = await db.collection(COLLECTION_AD).findOne({ _id: ad_id });
//         if (!adInfo) {
//             return res.status(404).send("Ad not found");
//         }

//         // Record interaction event
//         const clickData = {
//             ad_id: ad_id,
//             user_id: userID,
//             date: new Date(),
//             req_ip: getClientIP(req),
//             req_details: getClientDetails(req),
//             event_type: "interaction"
//         };
//         await db.collection(COLLECTION_ADEVENT).insertOne(clickData);

//         // Increment click count for the ad
//         await db.collection(COLLECTION_AD).updateOne(
//             { _id: ad_id },
//             { $inc: { clicks: 1 } }
//         );

//         res.send("Ad click registered");
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Error registering click");
//     }
// });

// // Start the microservice
// app.listen(PORT, () => {
//     console.log(`Ad microservice running on http://localhost:${PORT}`);
// });
const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const app = express();

// Database configuration
const DB_URI = "mongodb://localhost:27017";
const DB_NAME = "bugle";
const COLLECTION_AD = "ad";
const COLLECTION_ADEVENT = "adevent";

// Define the port for this microservice
const PORT = 3012;
const TOTAL_ADS = 5; // Ensure this matches the actual number of ads in your DB

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

// Helper function to get IP address
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

// Helper function to get browser and OS details
function getClientDetails(req) {
    const userAgent = req.get('User-Agent');
    return {
        browser: userAgent.match(/(firefox|msie|chrome|safari|opera|edg|trident)/i)?.[0] || "Unknown",
        os: userAgent.match(/\((.*?)\)/)?.[1] || "Unknown",
    };
}

// Helper function to fetch user ID from session ID
async function fetchUserIdFromSession(sessionID) {
    try {
        if (!sessionID) return "Guest";
        const authResponse = await axios.get(`http://localhost:8080/auth/user?sessionID=${sessionID}`);
        return authResponse.data?.user_id || "Guest";
    } catch (error) {
        console.error("Error fetching user ID from session:", error);
        return "Guest";
    }
}

// (GET) Fetch Random Ad and Track Impression
app.get('/ad', async (req, res) => {
    const randomID = Math.floor(Math.random() * TOTAL_ADS) + 1;
    const sessionID = req.query.sessionID;

    try {
        const userID = await fetchUserIdFromSession(sessionID);
        const db = client.db(DB_NAME);

        // Fetch ad details
        const adInfo = await db.collection(COLLECTION_AD).findOne({ _id: randomID });
        if (!adInfo) {
            return res.status(404).send("Ad not found");
        }

        // Record impression event
        const impressionData = {
            ad_id: randomID,
            user_id: userID,
            date: new Date(),
            req_ip: getClientIP(req),
            req_details: getClientDetails(req),
            event_type: "impression",
        };
        await db.collection(COLLECTION_ADEVENT).insertOne(impressionData);

        // Send ad data
        res.send({
            ad_id: randomID,
            url: adInfo.url,
            title: adInfo.title,
            description: adInfo.description,
            image: adInfo.image,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching ad");
    }
});

// (POST) Register Ad Interaction (Click)
app.post('/ad/click', async (req, res) => {
    const { ad_id, sessionID } = req.body;

    if (!ad_id || !sessionID) {
        return res.status(400).send("Missing fields in request");
    }

    try {
        const userID = await fetchUserIdFromSession(sessionID);
        const db = client.db(DB_NAME);

        // Fetch ad details to ensure it exists
        const adInfo = await db.collection(COLLECTION_AD).findOne({ _id: ad_id });
        if (!adInfo) {
            return res.status(404).send("Ad not found");
        }

        // Record interaction event
        const clickData = {
            ad_id: ad_id,
            user_id: userID,
            date: new Date(),
            req_ip: getClientIP(req),
            req_details: getClientDetails(req),
            event_type: "interaction",
        };
        await db.collection(COLLECTION_ADEVENT).insertOne(clickData);

        // Increment click count for the ad
        await db.collection(COLLECTION_AD).updateOne(
            { _id: ad_id },
            { $inc: { clicks: 1 } }
        );

        res.send("Ad click registered");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error registering click");
    }
});

// Start the microservice
app.listen(PORT, () => {
    console.log(`Ad microservice running on http://localhost:${PORT}`);
});
