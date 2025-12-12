const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

// middleware: to validate JWT Token
const verifyJWTToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({message: 'unauthorized access1'});
    }

    const token = authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({message: 'unauthorized access2'});
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({message: 'unauthorized access3'});
        }
        // console.log('after decoded', decoded);

        req.token_email = decoded.email;
        next();
    })
}

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
        const scholarshipCollection = db.collection('scholarship');

        // jwt related api
        app.post('/getToken', (req, res) => {
            const loggedUser = req.body;
            const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.send({ token: token });
        });

        // create user | login, register, social login page
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'student';
            const email = user.email;

            const userExist = await usersCollection.findOne({ email });
            if (userExist) {
                return res.send({ message: 'user already exists' })
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

        // scholarship related api
        // create scholarship || secure api || 
        app.post('/scholarship', verifyJWTToken, async (req, res) => {
            const email = req.query.email;
            if (email) {
                // verify user have access to create scholarship
                if (email !== req.token_email) {
                    return res.status(403).send({ message: 'forbidden access' });
                }
            }

            const scholarship = req.body;
            const result = await scholarshipCollection.insertOne(scholarship);
            res.send(result);
        });

        // get individual scholarship || secure ip
        app.get('/scholarship/:id', verifyJWTToken, async (req, res) => {
            const email = req.query.email;
            if (email) {
                // verify user have access to create scholarship
                if (email !== req.token_email) {
                    return res.status(403).send({ message: 'forbidden access' });
                }
            }
            
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await scholarshipCollection.findOne(query);
            res.send(result);
        });

        // get all scholarship || public api ||
        app.get('/scholarship', async (req, res) => {
            const cursor = scholarshipCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/latest-scholarship', async (req, res) => {
            const cursor = scholarshipCollection.find().sort({scholarshipPostDate: -1}).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        })

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