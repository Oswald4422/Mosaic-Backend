const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log('\n=== New Request ===');
  console.log(`${new Date().toISOString()}`);
  console.log(` ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Log response
  const oldSend = res.send;
  res.send = function(data) {
    console.log('\n=== Response ===');
    console.log(` Response Time: ${Date.now() - start}ms`);
    console.log(` Status: ${res.statusCode}`);
    console.log('Response Body:', typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    console.log('=== End ===\n');
    oldSend.apply(res, arguments);
  };
  next();
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5174', 'https://mosaic-frontend-zr9e.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('\n=== Error ===');
  console.error(' Error Details:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('Body:', req.body);
  console.error('=== End Error ===\n');
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      message: 'Validation Error', 
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({ 
      message: 'Duplicate key error',
      field: Object.keys(err.keyPattern)[0]
    });
  }

  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`\n Server running on port ${PORT}`);
  console.log(' Logging enabled for:');
  console.log('   - All incoming requests');
  console.log('   - Response status and timing');
  console.log('   - Errors and stack traces');
  console.log('   - Database operations\n');
});
