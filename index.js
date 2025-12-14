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
        return res.status(401).send({ message: 'unauthorized access1' });
    }

    const token = authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access2' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ message: 'unauthorized access3' });
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
        const applicationCollection = db.collection('application');
        const reviewCollection = db.collection('review');

        // jwt related api
        app.post('/getToken', (req, res) => {
            const loggedUser = req.body;
            const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.send({ token: token });
        });

        // middleware with database access
        // must be used after firebaseToken verification middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded_email;
            const query = { email };
            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

        const verifyModerator = async (req, res, next) => {
            const email = req.decoded_email;
            const query = { email };
            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'moderator') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

        const verifyStudent = async (req, res, next) => {
            const email = req.decoded_email;
            const query = { email };
            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'student') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

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

        // get user id | useId Hook
        app.get('/users/:email/id', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ id: user?._id || '000' });
        });

        // get user || secure api || admin verification need || jwt token verification need
        app.get('/users', async (req, res) => {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // secure api || admin only protection needed || jwt validation needed
        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const role = req.body.role;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: role
                }
            }

            const result = await usersCollection.updateOne(query, updatedDoc);
            res.send(result);
        });

        // secure api || for admin, manage scholarship || jwt verify need || admin verify need
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

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

        // get individual scholarship || secure api
        app.get('/scholarship/:id', async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await scholarshipCollection.findOne(query);
            res.send(result);
        });

        // get all scholarship || public api ||
        app.get('/scholarship', async (req, res) => {
            const { limit, skip, sort = 'size', order = 'desc', search } = req.query;
            // search query
            const query = search ? {
                $or: [
                    { scholarshipName: { $regex: search, $options: 'i' } },
                    { universityName: { $regex: search, $options: 'i' } },
                    { degree: { $regex: search, $options: 'i' } }
                ]
            } : {};

            const sortOption = {};
            sortOption[sort || 'size'] = order === 'asc' ? 1 : -1;

            const scholarships = await scholarshipCollection
                .find(query)
                .sort(sortOption)
                .limit(Number(limit))
                .skip(Number(skip))
                .project({ description: 0 })
                .toArray();

            const count = await scholarshipCollection.countDocuments(query);
            res.send({ scholarships, total: count });
        });

        // secure api || for admin, manage scholarship || jwt verify need || admin verify need
        app.delete('/scholarship/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await scholarshipCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/latest-scholarship', async (req, res) => {
            const cursor = scholarshipCollection.find().sort({ scholarshipPostDate: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        });

        // application related api
        // create application || secure api || jwt verify || role === 'student' || no duplicate apply
        app.post('/application', verifyJWTToken, async (req, res) => {
            const email = req.query.email;
            if (email) {
                // verify user have access to create scholarship
                if (email !== req.token_email) {
                    return res.status(403).send({ message: 'forbidden access' });
                }
            }

            const scholarship = req.body;
            const result = await applicationCollection.insertOne(scholarship);
            res.send(result);
        });

        // secure api || moderator only protection needed || jwt validation needed
        app.patch('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.applicationStatus;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    applicationStatus: status
                }
            }

            const result = await applicationCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        // secure api || student only protection needed || jwt validation needed
        app.get('/applications', async (req, res) => {
            const { email } = req.query;
            const query = {};
            if (email) {
                query.userEmail = email;
            }

            const cursor = applicationCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        // secure api || moderator only protection needed || jwt validation needed
        app.get('/applications', async (req, res) => {
            const cursor = applicationCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // mongodb aggregate pipeline
        app.get('/applications/application-status/stats', async (req, res) => {
            const pipeline = [
                {
                    $group: {
                        _id: '$applicationStatus',
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        status: '$_id',
                        count: 1,
                        _id: 0
                    }
                }
            ]

            const result = await applicationCollection.aggregate(pipeline).toArray();
            res.send(result);
        })

        // review related api
        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        app.get('/review', async (req, res) => {
            const email = req.query.email;
            const query = {};
            if (email) {
                query.email = email;
            }
            const cursor = reviewCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/review/:id', async (req, res) => {
            const id = req.params.id;
            const query = { 
                scholarshipId: id
            };
            const cursor = reviewCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
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