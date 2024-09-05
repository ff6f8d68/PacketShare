const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadDir);

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route: Handle File Upload
app.post('/upload-file', upload.single('file'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }

    try {
        const fileName = file.originalname;
        const filePath = path.join(uploadDir, fileName);
        const regFilePath = path.join(uploadDir, `${fileName}.bin.reg`);

        await fs.writeFile(filePath, file.buffer);

        await splitFileIntoChunks(filePath, regFilePath);

        const encryptedFileName = encryptFileName(fileName);
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

    try {
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
    } catch (err) {
        console.error('Error splitting file into chunks:', err);
        throw err;
    }
}

// Function to encrypt the file name
function encryptFileName(fileName) {
    const cipher = crypto.createCipher('aes-256-cbc', 'secret_key');
    let encrypted = cipher.update(fileName, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

// Route: Handle File Download
app.get('/download/:fileName', async (req, res) => {
    const { fileName } = req.params;
    const decryptedFileName = decryptFileName(fileName);
    const filePath = path.join(uploadDir, decryptedFileName);
    const regFilePath = path.join(uploadDir, `${decryptedFileName}.bin.reg`);

    if (!await fs.pathExists(filePath) || !await fs.pathExists(regFilePath)) {
        return res.status(404).send('File not found');
    }

    res.json({ filePath, regFilePath });
});

// Function to decrypt the file name
function decryptFileName(encryptedFileName) {
    const decipher = crypto.createDecipher('aes-256-cbc', 'secret_key');
    let decrypted = decipher.update(encryptedFileName, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
