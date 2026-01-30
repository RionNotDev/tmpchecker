const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const MietublAPI = require('./mietubl_api');

const app = express();
const api = new MietublAPI();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.post('/mietubl_api', async (req, res) => {
    const { api_action, model, panel, query } = req.body;
    if (api_action === 'search') {
        if (!model) {
            return res.json({ success: false, error: 'Model name is required' });
        }
        const result = await api.searchOnWebsite(model, panel || 'HD clear glass');
        return res.json(result);
    } else if (api_action === 'fetch') {
        try {
            const html = await api.fetchPage(query);
            return res.json({ success: true, html });
        } catch (e) {
            return res.json({ success: false, error: e.message });
        }
    } else {
        return res.json({ success: false, error: 'Invalid API action' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
