const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Set the uploads directory
const uploadDir = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Multer for handling chunk uploads
const storage = multer.memoryStorage(); // Use memory storage to handle chunks
const upload = multer({ storage });

// Route: Handle Chunk Upload
app.post('/upload-chunk', upload.single('file'), (req, res) => {
    const { file } = req;
    const { chunkIndex, totalChunks, fileName } = req.body;

    const filePath = path.join(uploadDir, `${fileName}.part`);

    // Append the chunk to the file
    fs.appendFileSync(filePath, file.buffer);

    // Once all chunks are uploaded, rename the final file
    if (parseInt(chunkIndex) + 1 == parseInt(totalChunks)) {
        const finalPath = path.join(uploadDir, fileName);

        // Rename to final file name
        fs.renameSync(filePath, finalPath);

        // Send response
        res.json({
            status: 'success',
            message: 'File upload complete'
        });
    } else {
        res.json({
            status: 'success',
            message: `Chunk ${chunkIndex} uploaded`
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
