const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;


///// middleware
app.use(cors());
app.use(express.json());


// mongodb

const { MongoClient, ServerApiVersion } = require('mongodb');
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

