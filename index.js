const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
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
        // await client.connect();

        // create database
        const db = client.db('scholar-stream');

        // create collection
        const usersCollection = db.collection('users');
        const scholarshipCollection = db.collection('scholarship');
        const applicationCollection = db.collection('application');
        const reviewCollection = db.collection('review');

        // jwt related api || generate access token
        app.post('/getToken', (req, res) => {
            const loggedUser = req.body;
            const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.send({ token: token });
        });

        // middleware with database access | authorization
        // must be used after firebaseToken verification middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.token_email;
            const query = { email };
            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

        const verifyModerator = async (req, res, next) => {
            const email = req.token_email;
            const query = { email };
            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'moderator') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

        const verifyStudent = async (req, res, next) => {
            const email = req.token_email;
            const query = { email };
            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'student') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }

        // create user | public api | but email validation will improve it | used in login, register, social login page
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

        // get user role | secure api | used in useRole Hook |
        app.get('/users/:email/role', verifyJWTToken, async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role || 'student' });
        });

        // get user id | secure api | useId Hook which is used in scholarship details page to apply scholarship
        app.get('/users/:email/id', verifyJWTToken, verifyStudent, async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ id: user?._id || '000' });
        });

        // get user || secure api || admin verification need || jwt token verification need | use in UserManagement page
        app.get('/users', verifyJWTToken, verifyAdmin, async (req, res) => {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // secure api || Verify Admin Only Access || JWT Token Verified | used in UserManagement Page
        app.patch('/users/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
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

        // secure api || Verify Admin Only Access || JWT Token Verified | used in UserManagement Page
        app.delete('/users/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // scholarship related api
        // secure api || Verify Admin Only Access || JWT Token Verified | used in AddScholarship Page
        app.post('/scholarship', verifyJWTToken, verifyAdmin, async (req, res) => {
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

        // get individual scholarship || secure api | JWT Verified | used in Scholarship Details Page
        app.get('/scholarship/:id', verifyJWTToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await scholarshipCollection.findOne(query);
            res.send(result);
        });

        // get all scholarship || public api || used in AllScholarship Page
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

        // secure api || Verify Admin Only Access || JWT Token Verified | used in ManageScholarship Page
        app.delete('/scholarship/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await scholarshipCollection.deleteOne(query);
            res.send(result);
        })

        // get latest scholarship | public api | used in Home Page
        app.get('/latest-scholarship', async (req, res) => {
            const { search } = req.query;

            // search query
            const query = search ? {
                $or: [
                    { scholarshipName: { $regex: search, $options: 'i' } },
                    { universityName: { $regex: search, $options: 'i' } },
                    { degree: { $regex: search, $options: 'i' } }
                ]
            } : {};

            const cursor = scholarshipCollection
                .find(query)
                .sort({ scholarshipPostDate: -1 })
                .limit(6);
            const result = await cursor.toArray();
            res.send(result);
        });

        // application related api
        // secure api || JWT Token Verified || Student Role Verified
        // stripe payment get way integration
        app.post('/application', verifyJWTToken, verifyStudent, async (req, res) => {
            const applicationInfo = req.body;

            const amount = (parseInt(applicationInfo.applicationFees) + parseInt(applicationInfo.serviceCharge)) * 100;
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: amount,
                            product_data: {
                                name: `Please pay for ${applicationInfo.scholarshipName}`,
                            }
                        },
                        quantity: 1,
                    },
                ],
                customer_email: applicationInfo.userEmail,
                mode: 'payment',
                metadata: {
                    scholarshipId: applicationInfo.scholarshipId,
                    scholarshipName: applicationInfo.scholarshipName,
                    userId: applicationInfo.userId,
                    userName: applicationInfo.userName,
                    universityName: applicationInfo.universityName,
                    scholarshipCategory: applicationInfo.scholarshipCategory,
                    degree: applicationInfo.degree,
                    serviceCharge: applicationInfo.serviceCharge,
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/application-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/application-cancelled?scholarshipId=${applicationInfo.scholarshipId}`,
            })

            res.send({ url: session.url });
        });

        // create application || after payment success || no duplicate apply | secure api | JWT Verified | Student Verified
        app.post('/application-success', verifyJWTToken, verifyStudent, async (req, res) => {
            const sessionId = req.query.session_id;
            const session = await stripe.checkout.sessions.retrieve(sessionId);

            // prevent second time insertion
            const transactionId = session.payment_intent;
            const query = { transactionId: transactionId };
            const paymentExist = await applicationCollection.findOne(query);
            if (paymentExist) {
                return res.send({
                    message: 'already exist',
                    transactionId,
                    trackingId: paymentExist.trackingId
                });
            }

            // use the previous tracking id created during the parcel create which was set to the session metadata during session creation
            if (session.payment_status === 'paid') {
                const application = {
                    scholarshipId: session.metadata.scholarshipId,
                    scholarshipName: session.metadata.scholarshipName,
                    userName: session.metadata.userName,
                    userId: session.metadata.userId,
                    universityName: session.metadata.universityName,
                    scholarshipCategory: session.metadata.scholarshipCategory,
                    degree: session.metadata.degree,
                    serviceCharge: session.metadata.serviceCharge,
                    transactionId: transactionId,
                    currency: session.currency,
                    userEmail: session.customer_email,
                    applicationFees: session.amount_total / 100,
                    applicationStatus: 'pending',
                    paymentStatus: session.payment_status,
                    applicationDate: new Date(),
                    feedback: ''
                }

                const result = await applicationCollection.insertOne(application);
                res.send(result);
            }
        });

        // secure api | JWT Verified | Moderator Verified | Used in ManageAppliedApplication Page
        app.patch('/applications/:id', verifyJWTToken, verifyModerator, async (req, res) => {
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

        //  get individuals user's all application | secure api | JWT Verified | Student Verified | Email Verified | Used In | Also Need To Implement UserId Verification In Future
        app.get('/applications', verifyJWTToken, verifyStudent, async (req, res) => {
            const { email } = req.query;
            const query = {};
            if (email) {
                query.userEmail = email;
            }

            const cursor = applicationCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        // secure api | JWT Verified | Moderator Verified | 
        app.get('/applications/moderator', verifyJWTToken, verifyModerator, async (req, res) => {
            const cursor = applicationCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // mongodb aggregate pipeline | secure api | JWT Verified | Moderator Verified | Used In Analytics Page
        app.get('/applications/application-status/stats', verifyJWTToken, verifyAdmin, async (req, res) => {
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

        // review related api | secure api | JWT Token Verified | Used In Scholarship Details Page
        app.post('/review', verifyJWTToken, async (req, res) => {
            const review = req.body;

            const { scholarshipId } = review;
            const query = { _id: new ObjectId(scholarshipId) };
            const scholarship = await scholarshipCollection.findOne(query);
            review.scholarshipName = scholarship.scholarshipName;
            review.universityName = scholarship.universityName;

            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        // delete review | secure api | Verified By JWT Token | Verified By User Email
        app.delete('/review/:id', verifyJWTToken, verifyStudent, async (req, res) => {
            const tokenEmail = req.token_email;
            const { email } = req.query;

            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await reviewCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/review', async (req, res) => {
            const email = req.query.email;
            const query = {};
            if (email) {
                query.reviewerEmail = email;
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
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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