const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.Stripe_secret_key);
const port = process.env.PORT || 5000;


///// middleware
app.use(cors());
app.use(express.json());


// mongodb

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_pass}@cluster0.5u6pxxs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        /// database section
        const userCollection = client.db("ServiceProviderDB").collection('users');
        const paymentCollection = client.db("ServiceProviderDB").collection("payments");
        const companyCollection = client.db("ServiceProviderDB").collection("company");
        const assetCollection = client.db("ServiceProviderDB").collection("AssetColletion");
        const requestedAsset = client.db("ServiceProviderDB").collection("RequestedAsset");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.Token_secret, { expiresIn: '24h' })
            res.send({ token })
        })

        /// verify token
        /// middleware
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.Token_secret, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }


        /// for the user
        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if it doesn't exists
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        /// user get
        app.get('/users', async (req, res) => {
            console.log(req.headers)
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        /// manager
        app.get('/users/manager/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let manager = false;
            if (user) {
                manager = user?.role === 'HR_manager';
            }
            res.send({ manager });
        })
        /// manager get logo and other details
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
            console.log(user)
        })


        /// payment
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount ')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            res.send(paymentResult);
        })

        app.get('/payments', async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result)
        })

        app.get('/payments/:email', async (req, res) => {
            const query = { email: req.params.email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        //// company collection
        app.post('/companyHolder', async (req, res) => {
            const user = req.body;
            // insert email if it doesn't exists
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await companyCollection.insertOne(user);
            res.send(result);
        })

        /// get
        app.get('/companyHolder', async (req, res) => {
            console.log(req.headers)
            const result = await companyCollection.find().toArray();
            res.send(result);
        })
        app.get('/companyHolder/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await companyCollection.findOne(query);
            res.send(user);
            console.log(user)
        })


        app.put('/companyHolder/:email', async (req, res) => {
            const email = req.params.email;
            const { limit, Employee_count } = req.body;

            try {
                // Find the document with the specified email and update the limit
                const updatedCompanyHolder = await companyCollection.findOneAndUpdate(
                    { email: email },
                    { $set: { limit: limit, Employee_count: Employee_count } },
                    { new: true } // Return the updated document
                );

                if (!updatedCompanyHolder) {
                    return res.status(404).json({ error: 'Company holder not found' });
                }

                res.json(updatedCompanyHolder); // Send back the updated company holder document
            } catch (error) {
                console.error('Error updating limit:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        /// update empolyee
        app.put('/users/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const user = req.body;

            const updateDoc = {
                $set: {
                    name: user.name,
                    email: user.email,
                    Date_of_Birth: user.Date_of_Birth,
                    role: user.role,
                    Profile_image: user.Profile_image,
                    Company_name: user.Company_name,
                    Company_logo: user.Company_logo
                },
            };
            console.log(updateDoc)
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        })


        //// Asset section
        app.get('/assets', async (req, res) => {
            const result = await assetCollection.find().toArray();
            res.send(result);
        })

        // asset post
        app.post('/assets', async(req, res) => {
            const value = req.body;
            const result = await assetCollection.insertOne(value);
            res.send(result);
        })

        
        app.get('/assets/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id : new ObjectId(id)}
            console.log(query)
            const result = await assetCollection.findOne(query)
            res.send(result)
        });

        // For delete
        app.delete('/assets/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assetCollection.deleteOne(query)
            res.send(result)
        })
        /// for update
        app.put('/assets/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const data = req.body;
            const updateDoc = {
                $set: {
                    Product_name : data.Product_name,
                    Product_Quantity : data.Product_Quantity,
                    Product_type : data.Product_type,
                    Date_added : data.Date_added,
                    Assest_image: data.Assest_image
                },
            };
            const result = await assetCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        })


        /// requested term
        app.post('/requestAsset', async(req, res) => {
            const value = req.body;
            const result = await requestedAsset.insertOne(value);
            res.send(result);
        })

        
        app.get('/requestAsset', async (req, res) => {
            const result = await requestedAsset.find().toArray();
            res.send(result);
        })

        app.get('/requestAsset/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id : new ObjectId(id)}
            console.log(query)
            const result = await requestedAsset.findOne(query)
            res.send(result)
        });

        /// for update
        app.put('/requestAsset/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const data = req.body;
            const updateDoc = {
                $set: {
                    Asset_image : data.Assest_image,
                    Asset_name : data.Asset_name,
                    Asset_type : data.Asset_type,
                    useName : data.useName,
                    userEmail : data.userEmail,
                    requestDate : data.requestDate,
                    additionalNotes : data.additionalNotes,
                    requestStatus : data.requestStatus,
                    ApprovalDate : data.ApprovalDate 
                },
            };
            const result = await requestedAsset.updateOne(filter, updateDoc, options);
            res.send(result)
        })

        app.delete('/requestAsset/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await requestedAsset.deleteOne(query)
            res.send(result)
        })
        


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        ///await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('server is ok now')
})

app.listen(port, () => {
    console.log(`Server is on port :  ${port}`);
})

