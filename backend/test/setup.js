import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
  process.env.JWT_EXPIRES = "7d";

  await mongoose.connect(uri, {
    dbName: "jest",
  });
});

afterEach(async () => {
  // Her testten sonra DB temizle
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
