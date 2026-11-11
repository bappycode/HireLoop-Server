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

function toArray(value) {
  if (Array.isArray(value)) return value.flatMap(toArray);
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function monthlySalaryExpression() {
  const salary = {
    $convert: {
      input: '$minSalary',
      to: 'double',
      onError: null,
      onNull: null,
    },
  };

  return {
    $switch: {
      branches: [
        {
          case: { $eq: ['$salaryFrequency', 'per hour'] },
          then: { $multiply: [salary, 160] },
        },
        {
          case: { $eq: ['$salaryFrequency', 'per day'] },
          then: { $multiply: [salary, 20] },
        },
        {
          case: { $eq: ['$salaryFrequency', 'per year'] },
          then: { $divide: [salary, 12] },
        },
      ],
      default: salary,
    },
  };
}

function buildJobQuery(params) {
  const query = {};
  const search = typeof params.search === 'string' ? params.search.trim() : '';
  const location = typeof params.location === 'string' ? params.location.trim() : '';
  const category = typeof params.category === 'string' ? params.category.trim() : '';
  const minSalary = Number(params.minSalary);
  const types = toArray(params.type);

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ jobTitle: pattern }, { companyName: pattern }];
  }

  if (location) {
    query.jobLocation = new RegExp(escapeRegex(location), 'i');
  }

  if (category && category !== 'all') {
    query.jobCategory = category;
  }

  if (types.length > 0) {
    query.jobType = { $in: types };
  }

  if (Number.isFinite(minSalary) && minSalary > 0) {
    query.$expr = { $gte: [monthlySalaryExpression(), minSalary] };
  }

  return query;
}

app.get('/jobs', async (req, res) => {
  const cursor = jobsCollection
    .find(buildJobQuery(req.query))
    .sort({ createdAt: -1 });
  const result = await cursor.toArray();
  res.send(result);
})

app.get('/jobs/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: 'Invalid job id' });
  }

  const job = await jobsCollection.findOne({ _id: new ObjectId(req.params.id) });

  if (!job) {
    return res.status(404).send({ message: 'Job not found' });
  }

  res.send(job);
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