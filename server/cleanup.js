import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function clearOldUsers() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB for cleanup");

        // Delete users missing the new fields
        const result = await User.deleteMany({
            $or: [
                { name: { $exists: false } },
                { email: { $exists: false } },
                { voterId: { $exists: false } }
            ]
        });

        console.log(`Deleted ${result.deletedCount} old user records`);

        await mongoose.disconnect();
        console.log("Disconnected successfully. Ready for new registrations.");
    } catch (e) {
        console.error(e);
    }
}

clearOldUsers();
