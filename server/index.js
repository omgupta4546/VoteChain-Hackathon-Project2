import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
// Set higher limit for json parsing if faceDescriptor arrays are large
app.use(express.json({ limit: '10mb' }));

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/votechain';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Routes

// 1. Register a new user with face descriptor & details
app.post('/api/auth/register', async (req, res) => {
    try {
        const { walletAddress, faceDescriptor, name, email, voterId } = req.body;

        if (!walletAddress || !faceDescriptor || !name || !email || !voterId) {
            return res.status(400).json({ success: false, message: 'All fields (wallet, face, name, email, voterId) are required' });
        }

        // Check if user already exists (by wallet, email, or voterId)
        const existingUser = await User.findOne({
            $or: [
                { walletAddress: walletAddress.toLowerCase() },
                { email: email.toLowerCase() },
                { voterId: voterId }
            ]
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User with this Wallet, Email, or Voter ID already exists' });
        }

        // Create new user
        const newUser = new User({
            walletAddress: walletAddress.toLowerCase(),
            name,
            email: email.toLowerCase(),
            voterId,
            faceDescriptor: faceDescriptor
        });

        await newUser.save();
        res.status(201).json({ success: true, message: 'User registered successfully', user: newUser });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 2. Login/Verify user face descriptor
app.post('/api/auth/verify', async (req, res) => {
    try {
        const { walletAddress, loginDescriptor } = req.body;

        if (!walletAddress || !loginDescriptor) {
            return res.status(400).json({ success: false, message: 'Wallet address and face descriptor are required' });
        }

        // Find user
        const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please register first.' });
        }

        // Verify face distance (Euclidean distance Euclidean distance < 0.6 is a match)
        const storedDescriptor = user.faceDescriptor;
        if (storedDescriptor.length !== loginDescriptor.length) {
            return res.status(400).json({ success: false, message: 'Invalid descriptor length.' });
        }

        let distance = 0;
        for (let i = 0; i < storedDescriptor.length; i++) {
            distance += Math.pow(storedDescriptor[i] - loginDescriptor[i], 2);
        }
        distance = Math.sqrt(distance);

        const threshold = 0.5; // Stricter threshold for better security 

        if (distance < threshold) {
            return res.status(200).json({ success: true, message: 'Face verified successfully', distance, user });
        } else {
            return res.status(401).json({ success: false, message: 'Face verification failed. Unrecognized face.', distance });
        }

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// 3. Get user status
app.get('/api/users/:walletAddress', async (req, res) => {
    try {
        const user = await User.findOne({ walletAddress: req.params.walletAddress.toLowerCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Exclude faceDescriptor from basic fetch response to save bandwidth
        const userProfile = {
            walletAddress: user.walletAddress,
            isRegistered: user.isRegistered,
            role: user.role,
            name: user.name,
            email: user.email,
            voterId: user.voterId,
            createdAt: user.createdAt
        };
        res.status(200).json({ success: true, user: userProfile });
    } catch (error) {
        console.error('Fetch user error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
