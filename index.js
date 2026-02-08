const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://assignment-11:cqH2wMuYMmT8G8WY@cluster0.pxios99.mongodb.net/?appName=Cluster0";
app.use(cors())
app.use(express.json())
app.get('/', (req, res) => {
  res.send('Hello World!')
})

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client 
    await client.connect();
   
    const db = client.db('assignment-11')
    const userCollections = db.collection('user')

    //user 
    app.post('/user', async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "doner";
      userInfo.createdAt = new Date()
      const result = await userCollections.insertOne(userInfo)
      res.send(result)
    })

    app.get('/user/role/:email', async (req, res) => {
      const {email} = req.params
      const query = { email: email }
      const result = await userCollections.findOne(query)
      res.send(result)
    })












    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
   // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
