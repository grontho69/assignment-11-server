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
    const requestCollections= db.collection('create-request')

    //user 
    app.post('/user', async (req, res) => {
      const userInfo = req.body;
      
      userInfo.createdAt = new Date()
      userInfo.role = 'donor'
      userInfo.status='active'
      const result = await userCollections.insertOne(userInfo)
      res.send(result)
    })

    app.get('/user/role/:email', async (req, res) => {
      const {email} = req.params
      const query = { email: email }
      const result = await userCollections.findOne(query)
      res.send(result)
    })


    // request
    
    app.post('/request', async (req,res) => {
      const data = req.body
      const result = await requestCollections.insertOne(data)
      res.send(result)
    })
    app.get('/request', async (req, res) => {
   
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
