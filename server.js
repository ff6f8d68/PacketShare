const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Set the uploads directory
const uploadDir = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
fs.ensureDirSync(uploadDir);

// Configure Multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Encryption key and algorithm
const encryptionKey = 'your-secret-key'; // Replace with your key

// Route: Handle File Upload
app.post('/upload-file', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }

    const fileName = file.originalname;
    const encryptedFileName = encrypt(fileName);
    const filePath = path.join(uploadDir, encryptedFileName);
    const regFilePath = path.join(uploadDir, `${encryptedFileName}.bin.reg`);

    fs.writeFile(filePath, file.buffer, err => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).json({ status: 'error', message: 'Error processing file' });
        }

        splitFileIntoChunks(filePath, regFilePath)
            .then(() => {
                const downloadUrl = `https://packetshare.onrender.com/download/${encryptedFileName}`;
                res.json({ status: 'success', downloadUrl: downloadUrl });
            })
            .catch(err => {
                console.error('Error splitting file:', err);
                res.status(500).json({ status: 'error', message: 'Error splitting file' });
            });
    });
});

function splitFileIntoChunks(filePath, regFilePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) return reject(err);

            const chunkSize = 8;
            const chunksDir = path.join(uploadDir, path.basename(filePath, path.extname(filePath)));
            fs.ensureDirSync(chunksDir);

            const totalChunks = Math.ceil(data.length / chunkSize);
            const regFile = [];

            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, data.length);
                const chunk = data.slice(start, end);
                const chunkFilePath = path.join(chunksDir, `${i}.bin`);

                fs.writeFile(chunkFilePath, chunk, err => {
                    if (err) return reject(err);
                });

                regFile.push({ index: i, path: chunkFilePath });
            }

            fs.writeJson(regFilePath, regFile, err => {
                if (err) return reject(err);
                resolve();
            });
        });
    });
}

// Route: Handle File Download
app.get('/download/:fileName', (req, res) => {
    const { fileName } = req.params;
    const decryptedFileName = decrypt(fileName);
    const filePath = path.join(uploadDir, decryptedFileName);
    const regFilePath = path.join(uploadDir, `${decryptedFileName}.bin.reg`);

    if (!fs.existsSync(filePath) || !fs.existsSync(regFilePath)) {
        return res.status(404).send('File not found');
    }

    res.json({
        filePath: filePath,
        regFilePath: regFilePath
    });
});

// Route: Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Encryption function
function encrypt(text) {
    return CryptoJS.AES.encrypt(text, encryptionKey).toString();
}

// Decryption function
function decrypt(text) {
    const bytes = CryptoJS.AES.decrypt(text, encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
