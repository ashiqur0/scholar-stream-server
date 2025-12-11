const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors())

// mongodb connection uri
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.edix7i0.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // create database
        const db = client.db('scholar-stream');

        // create collection
        const usersCollection = db.collection('users');

        // create user | login, register, social login page
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'student';
            const email = user.email;

            const userExist = await usersCollection.findOne({ email });
            if (userExist) {
                return res.send({message: 'user already exists'})
            }
            
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // get user role | useRole Hook
        app.get('/users/:email/role', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role || 'student' });
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from scholar stream server');
});

app.listen(port, (req, res) => {
    console.log(`server is running at http://localhost:${port}`);
})