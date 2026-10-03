const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check whether the environment variable exists
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    console.log('Connecting to MongoDB...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log('====================================');
    console.log('MongoDB connected successfully');
    console.log(`MongoDB host: ${conn.connection.host}`);
    console.log(`MongoDB database: ${conn.connection.name}`);
    console.log('====================================');

    return conn;
  } catch (error) {
    console.error('====================================');
    console.error('MongoDB connection error');
    console.error(error.message);
    console.error('====================================');

    process.exit(1);
  }
};

module.exports = connectDB;