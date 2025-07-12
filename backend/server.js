require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors()); // Allows your front-end to make requests
app.use(express.json()); // Parses incoming JSON payloads

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// --- API Proxy Endpoint ---
app.post('/api/generateContent', async (req, res) => {
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
            body: JSON.stringify(req.body), // Forward the request body from the front-end
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            console.error('Gemini API Error:', errorData);
            return res.status(geminiResponse.status).json(errorData);
        }

        const data = await geminiResponse.json();
        res.json(data); // Send the Gemini response back to the front-end
    } catch (error) {
        console.error('Backend server error:', error);
        res.status(500).json({ error: { message: 'Internal server error processing the request.' } });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});