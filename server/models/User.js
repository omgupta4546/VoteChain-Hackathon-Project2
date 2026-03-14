import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    voterId: {
        type: String,
        required: true,
        unique: true
    },
    faceDescriptor: {
        type: [Number],
        required: true,
    },
    isRegistered: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['voter', 'admin'],
        default: 'voter'
    }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
