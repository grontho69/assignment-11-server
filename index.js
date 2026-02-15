const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);

const verifyFBToken = async (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).send({ message: 'unauthorize access' });
    }
    try {
        const idToken = token.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        req.decoded_email = decoded.email;
        next();
    } catch (error) {
        return res.status(401).send({ message: 'unauthorize access' });
    }
}

const uri = "mongodb+srv://assignment-11:cqH2wMuYMmT8G8WY@cluster0.pxios99.mongodb.net/?appName=Cluster0";
app.use(cors());
app.use(express.json());

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const db = client.db('assignment-11');
        const userCollections = db.collection('user');
        const requestCollections = db.collection('request');
 
      //user
      
      
        app.post('/user', async (req, res) => {
            const userInfo = req.body;
            userInfo.createdAt = new Date();
            userInfo.role = 'donor';
            userInfo.status = 'active';
            const result = await userCollections.insertOne(userInfo);
            res.send(result);
        });

        app.get('/user', verifyFBToken, async (req, res) => {
            const result = await userCollections.find().toArray();
            res.status(200).send(result);
        });

        app.get('/user/role/:email', async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const result = await userCollections.findOne(query);
            res.send(result);
        });

        app.patch('/update/user/status/:email', verifyFBToken, async (req, res) => {
            const email = req.params.email;
            const status = req.query.status;
            const query = { email: email };
            const updateStatus = { $set: { status: status } };
            const result = await userCollections.updateOne(query, updateStatus);
            res.send(result);
        });

      
      // request
      
      
        app.post('/request', verifyFBToken, async (req, res) => {
            const data = req.body;
            const result = await requestCollections.insertOne(data);
            res.send(result);
        });

        app.get('/my-request', verifyFBToken, async (req, res) => {
            const email = req.decoded_email;
            const size = Number(req.query.size);
            const page = Number(req.query.page);
            const query = { email: email };
            const result = await requestCollections
                .find(query)
                .limit(size)
                .skip(size * page)
                .toArray();
            const totalRequest = await requestCollections.countDocuments(query);
            res.send({ request: result, totalRequest });
        });

        app.get('/all-requests', verifyFBToken, async (req, res) => {
            const { status, urgency, page, size } = req.query;
            const skip = parseInt(page) * parseInt(size);
            const limit = parseInt(size);
            let query = {};
            if (status && status !== 'All Status') query.donation_status = status.toLowerCase();
            if (urgency && urgency !== 'All Urgencies') query.urgency = urgency.toLowerCase();

            const result = await requestCollections.find(query).skip(skip).limit(limit).toArray();
            const total = await requestCollections.countDocuments(query);
            
            const pending = await requestCollections.countDocuments({ donation_status: 'pending' });
            const approved = await requestCollections.countDocuments({ donation_status: 'approved' });
            const completed = await requestCollections.countDocuments({ donation_status: 'completed' });

            res.send({ requests: result, total, stats: { pending, approved, completed } });
        });

        app.patch('/request-status/:id', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = { $set: { donation_status: status } };
            const result = await requestCollections.updateOne(query, updateDoc);
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
    } finally {}
}
run().catch(console.dir);

app.get('/', (req, res) => { res.send('Server Running') });
app.listen(port);