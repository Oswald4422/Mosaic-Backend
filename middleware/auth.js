const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  console.log('\n=== Auth Middleware ===');
  console.log('🔑 Checking authentication...');
  
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    console.log('🔍 Verifying token...');
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified successfully');
    console.log('👤 User ID:', decoded.id);

    // Get user from database
    console.log('🔍 Finding user in database...');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('✅ User found:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    // Add user to request
    req.user = user;
    console.log('=== End Auth Middleware ===\n');
    next();
  } catch (error) {
    console.error('\n🚨 Auth Error:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.log('=== End Auth Error ===\n');
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};
