import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, CheckCircle, XCircle, Loader2, User, Mail, Hash } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const FaceAuth = ({ account, isRegistration, onVerified, addNotification }) => {
    const videoRef = useRef();
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [stream, setStream] = useState(null);
    const [step, setStep] = useState(isRegistration ? 'form' : 'scan'); // 'form' or 'scan'

    // Sync step with isRegistration prop (in case it changes after mount)
    useEffect(() => {
        setStep(isRegistration ? 'form' : 'scan');
    }, [isRegistration]);

    // Registration Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        voterId: ''
    });

    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models')
                ]);
                setIsModelsLoaded(true);
                if (step === 'scan') {
                    startVideo();
                }
            } catch (error) {
                console.error("Error loading models", error);
                addNotification("Failed to load face detection models", "error");
            }
        };
        loadModels();

        return () => stopVideo();
    }, [step]);

    const startVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((currentStream) => {
                setStream(currentStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = currentStream;
                }
            })
            .catch((err) => {
                console.error(err);
                addNotification("Please allow camera access", "error");
            });
    };

    const stopVideo = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.voterId) {
            addNotification("Please fill all details", "warning");
            return;
        }
        setStep('scan');
    };

    const handleScan = async () => {
        if (!isModelsLoaded) return;
        setIsScanning(true);
        addNotification("Scanning face, please hold still...", "info");

        try {
            const detection = await faceapi.detectSingleFace(
                videoRef.current,
                new faceapi.TinyFaceDetectorOptions()
            ).withFaceLandmarks().withFaceDescriptor();

            if (!detection) {
                addNotification("No face detected. Please ensure good lighting and look directly at camera.", "warning");
                setIsScanning(false);
                return;
            }

            const descriptorStr = Array.from(detection.descriptor);

            if (isRegistration) {
                // Register User with Details + Face
                const res = await axios.post(`${API_URL}/auth/register`, {
                    walletAddress: account,
                    name: formData.name,
                    email: formData.email,
                    voterId: formData.voterId,
                    faceDescriptor: descriptorStr
                });

                if (res.data.success) {
                    addNotification("Successfully Registered!", "success");
                    stopVideo();
                    onVerified(res.data.user);
                }
            } else {
                // Verify User
                const res = await axios.post(`${API_URL}/auth/verify`, {
                    walletAddress: account,
                    loginDescriptor: descriptorStr
                });

                if (res.data.success) {
                    addNotification("Face verified successfully!", "success");
                    stopVideo();
                    onVerified(res.data.user);
                }
            }
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || "Authentication failed.";
            addNotification(msg, "error");

            // If registration fails (e.g., duplicate email), go back to form
            if (isRegistration && error.response?.status === 400) {
                stopVideo();
                setStep('form');
            }
        } finally {
            setIsScanning(false);
        }
    };

    if (step === 'form') {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-800/50 rounded-2xl border border-gray-700 backdrop-blur-md w-full max-w-md mx-auto mt-10">
                <h2 className="text-2xl font-bold text-white mb-2">Voter Registration</h2>
                <p className="text-gray-400 text-center text-sm mb-6">
                    Please provide your details before setting up Face ID.
                </p>

                <form onSubmit={handleFormSubmit} className="w-full space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                required
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="email"
                                required
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="john@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Voter ID Card Number</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                required
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="ABC1234567"
                                value={formData.voterId}
                                onChange={e => setFormData({ ...formData, voterId: e.target.value })}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full mt-6 py-3 px-6 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-all flex justify-center items-center"
                    >
                        Proceed to Face Scan
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-800/50 rounded-2xl border border-gray-700 backdrop-blur-md max-w-md mx-auto mt-10">
            <h2 className="text-2xl font-bold text-white mb-2">
                {isRegistration ? "Register Your Face" : "Verify Your Face"}
            </h2>
            <p className="text-gray-400 text-center text-sm mb-6">
                {isRegistration
                    ? "Look directly at the camera to setup your secure face ID."
                    : "Look at the camera to verify your identity before accessing the dashboard."}
            </p>

            <div className="relative rounded-xl overflow-hidden bg-black w-72 h-72 border-4 border-blue-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-blue-900/20">
                {!isModelsLoaded ? (
                    <div className="flex flex-col items-center text-blue-400 gap-2">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-medium">Loading AI Models...</span>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className="w-full h-full object-cover"
                        onPlay={() => console.log('Video playing')}
                    />
                )}
            </div>

            <button
                onClick={handleScan}
                disabled={!isModelsLoaded || isScanning}
                className={`w-full py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                    ${!isModelsLoaded || isScanning
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 shadow-lg shadow-blue-500/20'
                    }`}
            >
                {isScanning ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                ) : (
                    <><Camera className="w-5 h-5" /> Scan Face for {isRegistration ? 'Setup' : 'Login'}</>
                )}
            </button>

            {isRegistration && (
                <button
                    onClick={() => { stopVideo(); setStep('form'); }}
                    className="mt-4 text-sm text-gray-400 hover:text-white"
                >
                    Back to Details Form
                </button>
            )}
        </div>
    );
};

export default FaceAuth;
