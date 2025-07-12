const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const serverless = require('serverless-http');

const app = express();
const router = express.Router();

// Middleware
app.use(cors());
app.use(express.json());

// API Proxy Endpoint
router.post('/generateContent', async (req, res) => {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    if (!geminiApiKey) {
        console.error('API key not found.');
        return res.status(500).json({ error: { message: 'Server configuration error: Gemini API key not found.' } });
    }

    try {
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            console.error('Gemini API Error:', errorData);
            return res.status(geminiResponse.status).json(errorData);
        }

        const data = await geminiResponse.json();
        res.json(data);
    } catch (error) {
        console.error('Backend server error:', error);
        res.status(500).json({ error: { message: 'Internal server error processing the request.' } });
    }
});

// Mount the router to the express app with the correct path for Netlify Functions
app.use('/.netlify/functions/api', router);

// Export the handler function
module.exports.handler = serverless(app);