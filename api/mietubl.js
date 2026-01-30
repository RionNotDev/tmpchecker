import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

function decodeHTMLEntities(text) {
    return text.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function normalizeText(text) {
    return text.replace(/\s+/g, ' ').trim().toUpperCase();
}

async function fetchPage(query = null) {
    const url = 'https://www.mietubl.com/Compatible/modelsearch/';
    let options = {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
    };
    if (query) {
        options.method = 'POST';
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.body = new URLSearchParams({ model: query });
    }
    const res = await fetch(url, options);
    if (!res.ok) throw new Error('Failed to fetch page from ' + url);
    return await res.text();
}

function extractModelsFromHtml(htmlText, panelTitle = 'HD clear glass') {
    const dom = new JSDOM(htmlText);
    const document = dom.window.document;
    const panels = Array.from(document.querySelectorAll('.wrapper.compatible-panel .compatible-models'));
    let targetPanel = null;
    if (panelTitle) {
        for (const panel of panels) {
            const h3 = panel.querySelector('.clear h3');
            if (h3 && h3.textContent.trim().toLowerCase() === panelTitle.toLowerCase()) {
                targetPanel = panel;
                break;
            }
        }
    } else {
        targetPanel = panels[0] || null;
    }
    if (!targetPanel) return [];
    const mboxElements = Array.from(targetPanel.querySelectorAll('.data-wrapper .mbox'));
    const groups = [];
    for (const mbox of mboxElements) {
        const modelSpans = Array.from(mbox.querySelectorAll('span.model'));
        const models = [];
        const seen = new Set();
        for (const span of modelSpans) {
            let text = span.textContent.replace(/\s+/g, ' ').trim();
            text = decodeHTMLEntities(text);
            if (text && !seen.has(text)) {
                seen.add(text);
                models.push(text);
            }
        }
        if (models.length > 0) groups.push(models);
    }
    return groups;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed' });
        return;
    }
    const { api_action, model, panel, query } = req.body;
    if (api_action === 'search') {
        if (!model) {
            res.json({ success: false, error: 'Model name is required' });
            return;
        }
        try {
            const htmlContent = await fetchPage(model);
            const websiteGroups = extractModelsFromHtml(htmlContent, panel || 'HD clear glass');
            const normalizedQuery = normalizeText(model);
            const websiteMatches = [];
            const matchingGroups = [];
            for (const group of websiteGroups) {
                let hasMatch = false;
                for (const modelText of group) {
                    if (normalizeText(modelText).includes(normalizedQuery)) {
                        websiteMatches.push(modelText);
                        hasMatch = true;
                    }
                }
                if (hasMatch) matchingGroups.push(group);
            }
            res.json({
                success: true,
                matches: websiteMatches,
                groups: matchingGroups.length > 0 ? matchingGroups : [],
                raw_html: htmlContent
            });
        } catch (e) {
            res.json({ success: false, error: e.message, matches: [], groups: [] });
        }
    } else if (api_action === 'fetch') {
        try {
            const html = await fetchPage(query);
            res.json({ success: true, html });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    } else {
        res.json({ success: false, error: 'Invalid API action' });
    }
}
