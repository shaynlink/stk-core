require('dotenv').config();

const http = require('node:http');
const express = require('express');
const { MongoClient } = require('mongodb');
const { createHash } = require('node:crypto');

const PORT = process.env.PORT || 3000;

const client = new MongoClient(process.env.MONGO_URI);
const db = client.db('shortlnk');
const collection = db.collection('links');

const app = express();

app.use(express.json());

const description = `
Hello 👋, this project is a preview of the shortlnk project.
a full version will be released soon.
this project is open source and you can find it on github.
is a simple url shortener.\n<br />
github: https://stk.re/085556
`;

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');

    return res.status(200).send(description);
})

app.get('/:hash', async (req, res) => {
    const { hash } = req.params;

    if (!hash) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(description);
    }

    if (hash === 'favicon.ico') {
        return res.status(404).send('Not found');
    }

    const link = await collection.findOne({ hash });

    if (!link) {
        return res.status(404).send('Not found');
    }

    collection.updateOne({ hash }, { $inc: { views: 1 } })
        .then(() => console.log('[%s] Updated views | total count : %s', hash, link.views + 1));

    const accept = req.accepts(['html', 'json']);

    if (accept === 'html') {
        res.redirect(307, link.url);
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ url: link.url });
    }
})

app.post('/', async (req, res) => {
    if (!req.body) {
        return res.status(400).send('Bad request');
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).send('Missing url field');
    }

    const estimatedCount = await collection.countDocuments({
        url
    });

    if (estimatedCount > 0) {
        return res.status(400).send('Url already exists');
    }

    const hasheur = createHash('sha256');
    hasheur.update(url);
    const hash = hasheur.digest('hex');
    const shortHash = hash.slice(0, 6);

    const createdAt = new Date();

    const result = await collection.insertOne({
        url,
        hash: shortHash,
        createdAt,
        views: 0
    });

    if (!result.insertedId) {
        return res.status(500).send('Cannot create link');
    }

    return res.status(200).send({
        url,
        _id: result.insertedId,
        createdAt,
        views: 0,
        hash: shortHash
    });
})

client.connect().then(() => console.log('Connected to database'))

const server = http.createServer(app);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
