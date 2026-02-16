const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SC);
const crypto = require('crypto')
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

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.pxios99.mongodb.net/?appName=Cluster0`;
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
   //     await client.connect();
        const db = client.db('assignment-11');
        const userCollections = db.collection('user');
        const requestCollections = db.collection('request');
        const fundingCollections = db.collection('funding');
        const donationCollections = db.collection('donations');

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
      
      // Update user role (Admin only)
app.patch('/update-user-role/:email', verifyFBToken, async (req, res) => {
  try {
    const adminEmail = req.decoded_email;
    const { role } = req.body; // new role
    const userEmail = req.params.email;

    // Check if the requester is admin
    const adminUser = await userCollections.findOne({ email: adminEmail });
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).send({ message: 'Forbidden: Only admins can change roles' });
    }

    // Prevent invalid role
    const allowedRoles = ['donor', 'volunteer', 'admin'];
    if (!allowedRoles.includes(role.toLowerCase())) {
      return res.status(400).send({ message: 'Invalid role' });
    }

    const result = await userCollections.updateOne(
      { email: userEmail },
      { $set: { role: role.toLowerCase() } }
    );

    res.send({ message: 'User role updated', result });
  } catch (err) {
    console.error("ROLE UPDATE ERROR:", err);
    res.status(500).send({ message: 'Failed to update role' });
  }
});


        app.patch('/update/user/status/:email', verifyFBToken, async (req, res) => {
            const email = req.params.email;
            const status = req.query.status;
            const query = { email: email };
            const updateStatus = { $set: { status: status } };
            const result = await userCollections.updateOne(query, updateStatus);
            res.send(result);
        });

        app.post('/request', verifyFBToken, async (req, res) => {
            const data = req.body;
            const result = await requestCollections.insertOne(data);
            res.send(result);
        });

        app.get('/my-request', verifyFBToken, async (req, res) => {
            const email = req.decoded_email;
            const size = Number(req.query.size) || 10;
            const page = Number(req.query.page) || 0;
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
            const skip = parseInt(page || 0) * parseInt(size || 10);
            const limit = parseInt(size || 10);
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

        app.get('/funding-campaigns', async (req, res) => {
            const result = await fundingCollections.find().toArray();
            res.send(result);
        });

        app.post('/donate', verifyFBToken, async (req, res) => {
            const { campaignId, amount } = req.body;
            const donorEmail = req.decoded_email;

            const donationData = {
                campaignId: new ObjectId(campaignId),
                amount: parseInt(amount),
                donorEmail,
                date: new Date()
            };
            await donationCollections.insertOne(donationData);

            const query = { _id: new ObjectId(campaignId) };
            const updateDoc = {
                $inc: { raisedAmount: parseInt(amount) }
            };
            
            const result = await fundingCollections.updateOne(query, updateDoc);
            res.send(result);
        });
      
      // payment

      app.post('/create-payment-checkout', async (req, res) => {
    try {
        const information = req.body;
        
      
        const amountInCents = parseInt(information.donateAmount) * 100;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        unit_amount: amountInCents, 
                        product_data: {
                            name: information.campaignName || 'Donation Campaign',
                        }
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            customer_email: information.donorEmail, 
            metadata: {
                donorName: information.donorName,
                donorEmail: information.donorEmail,
                campaignId: information.campaignId 
            },
            
            success_url: `${process.env.SITE_DOMEN }/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_DOMEN }/payment-cancelled`,
        });

        res.send({ url: session.url });
    } catch (error) {
        console.error("Stripe Session Error:", error);
        res.status(500).send({ error: "Failed to create Stripe checkout session" });
    }
      });
      

      // search

      app.get('/search-request', async (req, res) => {
        const { blood, district, upazila } = req.query
       
        const query = {}
        if (!query) {
          return
        }
        if (blood) {
          const fixed = blood.replace(/ /g,"+").trim()
  query.blood = fixed
        }
        if (district) {
          query.district=district
        }
        if (upazila) {
          query.upazila=upazila
        }
        const result = await requestCollections.find(query).toArray()
        res.send(result)
      })

      // dashboard

      app.get('/dashboard-stats', verifyFBToken, async (req, res) => {
  try {
    const totalDonors = await userCollections.countDocuments({ role: 'donor' });
    const totalVolunteers = await userCollections.countDocuments({ role: 'volunteer' });

    const pendingRequests = await requestCollections.countDocuments({
      donation_status: 'pending'
    });

    const completedRequests = await requestCollections.countDocuments({
      donation_status: 'completed'
    });

    res.send({
      totalDonors,
      totalVolunteers,
      pendingRequests,
      completedRequests
    });
  } catch (err) {
    res.status(500).send({ message: 'Failed to load stats' });
  }
});

      
      app.get('/recent-requests', verifyFBToken, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;

    const result = await requestCollections
      .find()
      .sort({ _id: -1 })   
      .limit(limit)
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Failed to load recent requests' });
  }
});

      // profile

     app.get('/my-profile', verifyFBToken, async (req, res) => {
  try {
    const email = req.decoded_email;

    const user = await userCollections.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);

  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to load profile" });
  }
});


app.patch('/update-profile', verifyFBToken, async (req, res) => {
  try {
    const email = req.decoded_email;
    const updateData = { ...req.body };

    // NEVER update _id
    delete updateData._id;
    delete updateData.email; // optionally protect email from changes

    const result = await userCollections.updateOne(
      { email },
      { $set: updateData }
    );

    res.send({ message: 'Profile updated', result });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).send({ message: "Failed to update profile" });
  }
});




      
      

 //       await client.db("admin").command({ ping: 1 });
        console.log("Connected to MongoDB");
    } finally {}
}
run().catch(console.dir);

app.get('/', (req, res) => { res.send('Server Running') });
app.listen(port);