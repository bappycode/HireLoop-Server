import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const client = new MongoClient(`mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.bajh3fa.mongodb.net/`);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
const dataBase = connectedClient.db('hireloop');
const usersCollection = dataBase.collection('user');
const jobsCollection = dataBase.collection('jobs');

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/users', async (req, res) => {
  const cursor = usersCollection.find({});
  const users = await cursor.toArray();
  res.send(users);
})

app.get('/jobs', async (req, res) => {
  const cursor = jobsCollection.find({}).sort({ createdAt: -1 });
  const result = await cursor.toArray();
  res.send(result);
})

app.post('/jobs', async (req, res) => {
  const job = req.body ?? {};

  if (!job.jobTitle || !job.companyName) {
    return res.status(400).send({ message: 'jobTitle and companyName are required' });
  }

  const result = await jobsCollection.insertOne({
    ...job,
    createdAt: new Date(),
  });

  res.status(201).send({ ...job, _id: result.insertedId });
})

app.delete('/jobs/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: 'Invalid job id' });
  }

  const result = await jobsCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  if (!result.deletedCount) {
    return res.status(404).send({ message: 'Job not found' });
  }

  res.send({ deleted: true, _id: req.params.id });
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});