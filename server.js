const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const stream = require('stream');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Set the uploads directory
const uploadDir = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Serve static files (like HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for handling chunk uploads
const storage = multer.memoryStorage(); // Use memory storage for handling chunks
const upload = multer({ storage });

// Route: Handle Chunk Upload
app.post('/upload-chunk', upload.single('file'), (req, res) => {
    const { chunkIndex, totalChunks, fileName } = req.body;
    const chunkSize = 1024 * 1024; // 1MB per chunk
    const filePath = path.join(uploadDir, `${fileName}.part`);

    // Append the chunk to the file
    fs.appendFileSync(filePath, req.file.buffer);

    // Check if all chunks are uploaded
    if (parseInt(chunkIndex) + 1 === parseInt(totalChunks)) {
        mergeChunks(fileName, filePath)
            .then(() => {
                const finalPath = path.join(uploadDir, fileName);
                const downloadUrl = `https://packetshare.onrender.com/files/${fileName}`;
                res.json({
                    status: 'success',
                    message: 'File upload complete',
                    downloadUrl: downloadUrl
                });
            })
            .catch(error => {
                console.error('Error merging chunks:', error);
                res.status(500).json({ status: 'error', message: 'Error merging chunks' });
            });
    } else {
        res.json({
            status: 'success',
            message: `Chunk ${chunkIndex} uploaded`
        });
    }
});

function mergeChunks(fileName, filePath) {
    return new Promise((resolve, reject) => {
        const finalPath = path.join(uploadDir, fileName);
        const writeStream = fs.createWriteStream(finalPath);

        fs.createReadStream(filePath)
            .pipe(writeStream)
            .on('finish', () => {
                fs.unlinkSync(filePath); // Remove the chunk file
                resolve();
            })
            .on('error', reject);
    });
}

// Route: Serve uploaded files
app.use('/files', express.static(uploadDir));

// Route: Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
