const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const CryptoJS = require('crypto-js');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadDir);

const storage = multer.memoryStorage();
const upload = multer({ storage });

const encryptionKey = 'your-secret-key'; // Replace with your key

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route: Handle File Upload
app.post('/upload-file', upload.single('file'), async (req, res) => {
    const file = req.file;
    const password = req.body.password; // Get password from the request
    const fileName = file.originalname;
    const encryptedFileName = encrypt(fileName);
    const filePath = path.join(uploadDir, encryptedFileName);
    const regFilePath = path.join(uploadDir, `${encryptedFileName}.bin.reg`);

    if (!file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }

    try {
        await fs.writeFile(filePath, file.buffer);

        // Split file into 8-byte chunks
        await splitFileIntoChunks(filePath, regFilePath);

        // Save password if provided
        if (password) {
            const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
            await fs.writeFile(path.join(uploadDir, `${encryptedFileName}.pwd`), passwordHash);
        }

        const downloadUrl = `https://packetshare.onrender.com/download/${encryptedFileName}`;
        res.json({ status: 'success', downloadUrl });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ status: 'error', message: 'Error processing file' });
    }
});

async function splitFileIntoChunks(filePath, regFilePath) {
    const chunkSize = 8;
    const chunksDir = path.join(uploadDir, path.basename(filePath, path.extname(filePath)));
    await fs.ensureDir(chunksDir);

    const data = await fs.readFile(filePath);
    const totalChunks = Math.ceil(data.length / chunkSize);
    const regFile = [];

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, data.length);
        const chunk = data.slice(start, end);
        const chunkFilePath = path.join(chunksDir, `${i}.bin`);

        await fs.writeFile(chunkFilePath, chunk);
        regFile.push({ index: i, path: chunkFilePath });
    }

    await fs.writeJson(regFilePath, regFile);
}

// Route: Handle File Download
app.get('/download/:fileName', async (req, res) => {
    const { fileName } = req.params;
    const decryptedFileName = decrypt(fileName);
    const filePath = path.join(uploadDir, decryptedFileName);
    const regFilePath = path.join(uploadDir, `${decryptedFileName}.bin.reg`);
    const passwordHashPath = path.join(uploadDir, `${decryptedFileName}.pwd`);
    
    // Check if password is provided and validate
    const password = req.query.password;
    if (password) {
        if (!await fs.pathExists(passwordHashPath)) {
            return res.status(404).send('File not found');
        }

        const storedPasswordHash = await fs.readFile(passwordHashPath, 'utf8');
        const providedPasswordHash = crypto.createHash('sha256').update(password).digest('hex');

        if (storedPasswordHash !== providedPasswordHash) {
            return res.status(403).send('Unauthorized');
        }
    }

    if (!await fs.pathExists(filePath) || !await fs.pathExists(regFilePath)) {
        return res.status(404).send('File not found');
    }

    res.json({ filePath, regFilePath });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function encrypt(text) {
    return CryptoJS.AES.encrypt(text, encryptionKey).toString();
}

function decrypt(text) {
    const bytes = CryptoJS.AES.decrypt(text, encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
