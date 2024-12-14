const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('\n=== Database Connection ===');
    console.log(' Connecting to MongoDB...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(' MongoDB Connected:');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Port: ${conn.connection.port}`);
    console.log('=== End Database Connection ===\n');

    // Log database events
    mongoose.connection.on('error', (err) => {
      console.error('\n MongoDB Error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('\n MongoDB Disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('\n MongoDB Reconnected');
    });

  } catch (error) {
    console.error('\n Database Connection Error:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.log('=== End Database Error ===\n');
    process.exit(1);
  }
};

module.exports = connectDB;
